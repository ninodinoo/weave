// Weave's on-disk state inside a project.
//
//   .weave/config.json      committed   which platforms are set up
//   .weave/history.jsonl    committed   every change evolve applied, with its evidence
//   .weave/runtime/         committed   vendored copy of this CLI (hooks and skills call it)
//   .weave/local/           gitignored  per-developer state: counters, captured feedback
import { join, dirname } from "node:path";
import { readJson, writeJson, readJsonl, appendJsonl, exists } from "./util.mjs";

export const paths = (projectDir) => {
  const root = join(projectDir, ".weave");
  return {
    root,
    config: join(root, "config.json"),
    history: join(root, "history.jsonl"),
    runtime: join(root, "runtime"),
    local: join(root, "local"),
    state: join(root, "local", "state.json"),
    inbox: join(root, "local", "inbox.jsonl"),
  };
};

const DEFAULT_STATE = { lastEvolvedAt: null, lastNudgeAt: null, sessionsSinceEvolve: 0 };

/** Returns null when the file exists but cannot be read, so callers do not overwrite it with defaults. */
export function loadState(projectDir, { strict = false } = {}) {
  const file = paths(projectDir).state;
  const stored = readJson(file, null);
  const usable = stored && typeof stored === "object" && !Array.isArray(stored);
  if (!usable && strict && exists(file)) return null;
  const state = { ...DEFAULT_STATE, ...(usable ? stored : {}) };
  if (!Number.isFinite(state.sessionsSinceEvolve)) state.sessionsSinceEvolve = 0;
  return state;
}

/** Nearest ancestor that has been set up with Weave, or null. */
export function findProject(start) {
  let dir = start;
  for (let i = 0; i < 40 && dir; i++) {
    if (exists(join(dir, ".weave", "config.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export function saveState(projectDir, state) {
  writeJson(paths(projectDir).state, state);
}

export function loadConfig(projectDir) {
  return readJson(paths(projectDir).config, null);
}

export function loadHistory(projectDir) {
  return readJsonl(paths(projectDir).history);
}

export function loadInbox(projectDir) {
  return readJsonl(paths(projectDir).inbox);
}

export function appendInbox(projectDir, entry) {
  appendJsonl(paths(projectDir).inbox, entry);
}

export function appendHistory(projectDir, entry) {
  appendJsonl(paths(projectDir).history, entry);
}
