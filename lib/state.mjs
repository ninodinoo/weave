// Weave's on-disk state inside a project.
//
//   .weave/config.json      committed   which platforms are set up
//   .weave/history.jsonl    committed   every change evolve applied, with its evidence
//   .weave/runtime/         committed   vendored copy of this CLI (hooks and skills call it)
//   .weave/local/           gitignored  per-developer state: counters, captured feedback
import { join } from "node:path";
import { readJson, writeJson, readJsonl, appendJsonl } from "./util.mjs";

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

export function loadState(projectDir) {
  return { ...DEFAULT_STATE, ...readJson(paths(projectDir).state, {}) };
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
