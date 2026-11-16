// Reads Codex CLI rollouts ($CODEX_HOME/sessions/YYYY/MM/DD/rollout-*.jsonl) and
// normalizes them into the shape documented in ./index.mjs.
//
// Line format (codex-rs/rollout): { timestamp, type, payload }
//   session_meta   payload.cwd, payload.id
//   event_msg      payload.type = user_message | turn_aborted | ...
//   response_item  payload.type = function_call | function_call_output | custom_tool_call | ...
import { readdirSync, openSync, readSync, closeSync } from "node:fs";
import { homedir } from "node:os";
import { join, basename, sep } from "node:path";
import { readJsonl, exists } from "../util.mjs";

const SHELL_TOOLS = new Set(["exec_command", "shell", "shell_command", "local_shell", "unified_exec", "container.exec"]);
const READERS = new Set(["cat", "head", "tail", "sed", "nl", "bat", "less"]);

export function codexHome() {
  return process.env.CODEX_HOME || join(homedir(), ".codex");
}

function listDir(dir) {
  try {
    return readdirSync(dir).sort();
  } catch {
    return [];
  }
}

/** First line of a rollout is its session_meta; read just enough of the file to get it. */
function readMeta(file) {
  let fd;
  try {
    fd = openSync(file, "r");
    const buf = Buffer.alloc(64 * 1024);
    const n = readSync(fd, buf, 0, buf.length, 0);
    const first = buf.subarray(0, n).toString("utf8").split("\n")[0];
    const line = JSON.parse(first);
    return line.type === "session_meta" ? line.payload : null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

function insideProject(cwd, projectDir) {
  return typeof cwd === "string" && (cwd === projectDir || cwd.startsWith(projectDir + sep));
}

/** Rollouts are stored for all projects together, bucketed by date; keep the ones started in this project. */
export function listCodexSessionFiles(projectDir, since) {
  const root = join(codexHome(), "sessions");
  if (!exists(root)) return [];
  // Compare on day granularity, one day early, because folders use local time.
  const floor = since ? new Date(since.getTime() - 86400000).toISOString().slice(0, 10) : null;
  const files = [];
  for (const y of listDir(root)) {
    for (const m of listDir(join(root, y))) {
      for (const d of listDir(join(root, y, m))) {
        if (floor && `${y}-${m}-${d}` < floor) continue;
        const dir = join(root, y, m, d);
        for (const f of listDir(dir)) {
          // Compressed cold rollouts (.jsonl.zst) are skipped: reading them needs a zstd dependency.
          if (!f.startsWith("rollout-") || !f.endsWith(".jsonl")) continue;
          const file = join(dir, f);
          if (insideProject(readMeta(file)?.cwd, projectDir)) files.push(file);
        }
      }
    }
  }
  return files;
}

function parseArgs(raw) {
  if (raw && typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/** exec_command takes { cmd: "…" }; the older shell tool takes { command: ["bash", "-lc", "…"] }. */
function shellCommand(args) {
  const value = args.cmd ?? args.command;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const flag = value.findIndex((v) => v === "-lc" || v === "-c");
    return flag >= 0 && value[flag + 1] ? String(value[flag + 1]) : value.join(" ");
  }
  return "";
}

function outputText(output) {
  if (typeof output === "string") return output;
  if (Array.isArray(output)) return output.map((item) => item?.text ?? "").join("\n");
  return "";
}

function exitCode(text) {
  const match = /^(?:Exit code:|Process exited with code) (-?\d+)/m.exec(text);
  if (match) return Number(match[1]);
  try {
    const code = JSON.parse(text)?.metadata?.exit_code; // older rollouts wrapped output in JSON
    return typeof code === "number" ? code : null;
  } catch {
    return null;
  }
}

/** Codex reads files through the shell; surface `cat path`-style reads so hot-file detection works. */
function readsFrom(command) {
  const out = [];
  for (const segment of command.split(/&&|\|\||;|\n|\|/)) {
    const tokens = segment.trim().split(/\s+/);
    if (!READERS.has(tokens[0])) continue;
    const path = tokens.slice(1).reverse().find((t) => /^[\w./@+-]+$/.test(t) && /[./]/.test(t) && !/^\d/.test(t));
    if (path) out.push(path.replace(/^\.\//, ""));
  }
  return out;
}

export function parseCodexSession(file) {
  const lines = readJsonl(file);
  const events = [];
  const pending = new Map(); // call_id -> tool event
  const fallbackUsers = [];
  let meta = null;
  let sawUserEvent = false;

  for (const line of lines) {
    const ts = line.timestamp ?? null;
    const p = line.payload ?? {};

    if (line.type === "session_meta") {
      meta ??= p;
      continue;
    }

    if (line.type === "event_msg") {
      if (p.type === "user_message" && typeof p.message === "string" && p.message.trim()) {
        sawUserEvent = true;
        events.push({ kind: "user", ts, text: p.message });
      } else if (p.type === "turn_aborted" && p.reason === "interrupted") {
        events.push({ kind: "interrupt", ts });
      }
      continue;
    }

    if (line.type !== "response_item") continue;

    if (p.type === "function_call" || p.type === "custom_tool_call" || p.type === "local_shell_call") {
      let event;
      if (p.type === "local_shell_call") {
        event = { kind: "tool", ts, name: "Bash", input: { command: shellCommand({ command: p.action?.command }) }, ok: true, output: "" };
      } else if (SHELL_TOOLS.has(p.name)) {
        event = { kind: "tool", ts, name: "Bash", input: { command: shellCommand(parseArgs(p.arguments)) }, ok: true, output: "" };
      } else if (p.name === "apply_patch") {
        event = { kind: "tool", ts, name: "apply_patch", input: { patch: p.input ?? p.arguments ?? "" }, ok: true, output: "" };
      } else {
        event = { kind: "tool", ts, name: p.name ?? "unknown", input: parseArgs(p.arguments ?? p.input), ok: true, output: "" };
      }
      if (p.call_id) pending.set(p.call_id, event);
      events.push(event);
      if (event.name === "Bash") {
        for (const path of readsFrom(event.input.command)) {
          events.push({ kind: "tool", ts, name: "Read", input: { file_path: path }, ok: true, output: "", synthetic: true });
        }
      }
      continue;
    }

    if (p.type === "function_call_output" || p.type === "custom_tool_call_output" || p.type === "local_shell_call_output") {
      const event = pending.get(p.call_id);
      if (!event) continue;
      event.output = outputText(p.output);
      const code = exitCode(event.output);
      event.ok = code === null ? true : code === 0;
      pending.delete(p.call_id);
      continue;
    }

    // Older rollouts have no user_message events; fall back to raw user messages,
    // skipping the context blocks Codex injects (<environment_context>, AGENTS.md, …).
    if (p.type === "message" && p.role === "user" && Array.isArray(p.content)) {
      const text = p.content.filter((c) => c?.type === "input_text").map((c) => c.text).join("\n").trim();
      if (text && !text.startsWith("<") && !text.startsWith("# AGENTS.md")) fallbackUsers.push({ kind: "user", ts, text });
    }
  }

  if (!sawUserEvent && fallbackUsers.length) {
    events.push(...fallbackUsers);
    events.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
  }

  return {
    platform: "codex",
    id: meta?.id ?? basename(file, ".jsonl"),
    file,
    cwd: meta?.cwd ?? null,
    startedAt: meta?.timestamp ?? lines[0]?.timestamp ?? null,
    events,
  };
}
