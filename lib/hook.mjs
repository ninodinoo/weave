// Hook entry points. Called by Claude Code and Codex as `weave hook <event>`
// with the event JSON on stdin. Two rules: be fast, and never break a session.
// So: no model calls, no network, and every failure exits 0 silently.
import { dirname, join } from "node:path";
import { detectFeedback } from "./analyze.mjs";
import { appendInbox, loadConfig, loadInbox, loadState, saveState } from "./state.mjs";
import { exists } from "./util.mjs";

const DAY = 86400000;
export const NUDGE = { standing: 3, sessions: 20, everyDays: 7 };

function readStdin(timeoutMs = 1500) {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve("");
    let data = "";
    const done = () => resolve(data);
    const timer = setTimeout(done, timeoutMs);
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => {
      clearTimeout(timer);
      done();
    });
    process.stdin.on("error", done);
  });
}

/** Nearest ancestor that has been set up with Weave, or null. Hooks do nothing elsewhere. */
export function findProject(start) {
  let dir = start;
  for (let i = 0; i < 30 && dir; i++) {
    if (exists(join(dir, ".weave", "config.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** UserPromptSubmit: remember rules the user states out loud ("from now on…", "never…"). */
export function onPrompt(projectDir, input, platform) {
  const prompt = typeof input.prompt === "string" ? input.prompt : "";
  if (!prompt || prompt.length > 4000 || prompt.trimStart().startsWith("/")) return null;
  // Corrections need the surrounding conversation to judge, so those are left to
  // transcript analysis. Standing instructions are unambiguous enough to keep now.
  const found = detectFeedback(prompt);
  if (found?.kind !== "standing") return null;
  appendInbox(projectDir, {
    ts: new Date().toISOString(),
    kind: "standing",
    platform,
    session: input.session_id ?? null,
    quote: found.quote,
  });
  return null;
}

/** SessionStart: count sessions and, rarely, tell the user that evidence has piled up. */
export function onSessionStart(projectDir, input, platform, now = Date.now()) {
  const source = input.source ?? "startup";
  if (source !== "startup") return null;
  const state = loadState(projectDir);
  state.sessionsSinceEvolve = (state.sessionsSinceEvolve ?? 0) + 1;

  const last = state.lastEvolvedAt;
  const pending = loadInbox(projectDir).filter((i) => !last || (i.ts ?? "") > last).length;
  const quietUntil = state.lastNudgeAt ? new Date(state.lastNudgeAt).getTime() + NUDGE.everyDays * DAY : 0;
  let message = null;
  if (now >= quietUntil && (pending >= NUDGE.standing || state.sessionsSinceEvolve >= NUDGE.sessions)) {
    const parts = [];
    if (pending) parts.push(`${pending} standing instruction${pending === 1 ? "" : "s"} you gave`);
    parts.push(`${state.sessionsSinceEvolve} sessions`);
    const command = platform === "codex" ? "$weave-evolve" : loadConfig(projectDir)?.mode === "plugin" ? "/weave:evolve" : "/weave-evolve";
    message = `Weave: ${parts.join(" and ")} since the setup was last tuned. Run ${command} to turn them into rules, skills or hooks.`;
    state.lastNudgeAt = new Date(now).toISOString();
  }
  saveState(projectDir, state);
  // systemMessage is shown to the user and costs the model no context.
  return message ? { systemMessage: message } : null;
}

export async function runHook(event, platform = "claude") {
  try {
    const text = await readStdin();
    let input = {};
    try {
      input = text ? JSON.parse(text) : {};
    } catch {
      input = {};
    }
    const start = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const projectDir = findProject(start);
    if (!projectDir) return;
    // A project install has its own hooks; the plugin's copy steps aside so nothing is captured twice.
    if (process.env.CLAUDE_PLUGIN_ROOT && loadConfig(projectDir)?.mode === "project") return;
    let out = null;
    if (event === "prompt") out = onPrompt(projectDir, input, platform);
    else if (event === "session-start") out = onSessionStart(projectDir, input, platform);
    if (out) process.stdout.write(JSON.stringify(out));
  } catch {
    // Never let a Weave hook interrupt someone's work.
  }
}
