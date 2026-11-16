// Reads Claude Code session transcripts (~/.claude/projects/<encoded-cwd>/*.jsonl)
// and normalizes them into the shape documented in ./index.mjs.
import { readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, basename } from "node:path";
import { readJsonl, exists } from "../util.mjs";

const NOISE_PREFIXES = [
  "<command-name>",
  "<command-message>",
  "<local-command",
  "<system-reminder>",
  "<task-notification>",
  "Caveat:",
  "[Artifact comment",
];

export function claudeHome() {
  return process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
}

/** Claude Code names a project's transcript folder after its path, with every non-alphanumeric character replaced by "-". */
export function encodeProjectDir(projectDir) {
  return projectDir.replace(/[^a-zA-Z0-9]/g, "-");
}

export function listClaudeSessionFiles(projectDir) {
  const dir = join(claudeHome(), "projects", encodeProjectDir(projectDir));
  if (!exists(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => join(dir, f));
}

function blockText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((b) => b && b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("\n");
}

function isNoise(text) {
  const t = text.trimStart();
  return NOISE_PREFIXES.some((p) => t.startsWith(p));
}

export function parseClaudeSession(file) {
  const lines = readJsonl(file);
  const events = [];
  const pending = new Map(); // tool_use id -> tool event
  let cwd = null;
  let startedAt = null;

  for (const line of lines) {
    if (line.isSidechain || line.isMeta) continue;
    if (line.type !== "user" && line.type !== "assistant") continue;
    cwd ??= line.cwd ?? null;
    startedAt ??= line.timestamp ?? null;
    const ts = line.timestamp ?? null;
    const content = line.message?.content;

    if (line.type === "assistant") {
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (block.type !== "tool_use") continue;
        const event = { kind: "tool", ts, name: block.name, input: block.input ?? {}, ok: true, output: "" };
        pending.set(block.id, event);
        events.push(event);
      }
      continue;
    }

    // User lines carry either a real prompt or tool results.
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type !== "tool_result") continue;
        const event = pending.get(block.tool_use_id);
        if (!event) continue;
        event.ok = block.is_error !== true;
        event.output = blockText(block.content);
        pending.delete(block.tool_use_id);
      }
    }
    const text = blockText(content);
    if (!text.trim()) continue;
    if (text.includes("[Request interrupted by user")) {
      events.push({ kind: "interrupt", ts });
      continue;
    }
    if (isNoise(text)) continue;
    events.push({ kind: "user", ts, text });
  }

  return {
    platform: "claude",
    id: basename(file, ".jsonl"),
    file,
    cwd,
    startedAt: startedAt ?? statSync(file).mtime.toISOString(),
    events,
  };
}
