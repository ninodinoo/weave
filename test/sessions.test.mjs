import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { loadSessions } from "../lib/sessions/index.mjs";
import { encodeProjectDir } from "../lib/sessions/claude.mjs";
import { tempDir, write, jsonl } from "./helpers.mjs";

const PROJECT = "/home/dev/my.app";

function claudeFixture(home) {
  const base = { cwd: PROJECT, sessionId: "s1", isSidechain: false };
  write(home, join("projects", encodeProjectDir(PROJECT), "s1.jsonl"), jsonl([
    { type: "queue-operation", operation: "enqueue" },
    { ...base, type: "user", timestamp: "2026-10-01T10:00:00Z", message: { role: "user", content: "Fix the flaky login test" } },
    { ...base, type: "user", timestamp: "2026-10-01T10:00:01Z", message: { role: "user", content: "<system-reminder>ignore me</system-reminder>" } },
    { ...base, type: "assistant", timestamp: "2026-10-01T10:00:02Z", message: { role: "assistant", content: [
      { type: "thinking", thinking: "…" },
      { type: "tool_use", id: "t1", name: "Bash", input: { command: "npm test" } },
      { type: "tool_use", id: "t2", name: "Read", input: { file_path: `${PROJECT}/src/login.ts` } },
    ] } },
    { ...base, type: "user", timestamp: "2026-10-01T10:00:05Z", message: { role: "user", content: [
      { type: "tool_result", tool_use_id: "t1", is_error: true, content: "npm ERR! Missing script" },
      { type: "tool_result", tool_use_id: "t2", content: [{ type: "text", text: "export function login() {}" }] },
    ] } },
    { ...base, type: "user", timestamp: "2026-10-01T10:00:09Z", message: { role: "user", content: [{ type: "text", text: "[Request interrupted by user]" }] } },
    { ...base, type: "user", isSidechain: true, timestamp: "2026-10-01T10:00:10Z", message: { role: "user", content: "subagent prompt, not the user" } },
    { ...base, type: "user", timestamp: "2026-10-01T10:00:11Z", message: { role: "user", content: "No, use pnpm here" } },
  ]) + "{ this line is cut off");
}

function codexFixture(home, cwd = PROJECT, day = "01") {
  const meta = { id: `cx-${day}`, cwd, timestamp: `2026-10-${day}T09:00:00Z`, cli_version: "1.0.0" };
  write(home, join("sessions", "2026", "10", day, `rollout-2026-10-${day}T09-00-00-cx.jsonl`), jsonl([
    { timestamp: `2026-10-${day}T09:00:00Z`, type: "session_meta", payload: meta },
    { timestamp: `2026-10-${day}T09:00:01Z`, type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "<environment_context>…</environment_context>" }] } },
    { timestamp: `2026-10-${day}T09:00:02Z`, type: "event_msg", payload: { type: "user_message", message: "Bump the version and tag a release" } },
    { timestamp: `2026-10-${day}T09:00:03Z`, type: "response_item", payload: { type: "function_call", name: "exec_command", arguments: JSON.stringify({ cmd: "cat package.json && cargo test" }), call_id: "c1" } },
    { timestamp: `2026-10-${day}T09:00:04Z`, type: "response_item", payload: { type: "function_call_output", call_id: "c1", output: "Exit code: 101\nWall time: 2.1 seconds\nOutput:\nerror: test failed" } },
    { timestamp: `2026-10-${day}T09:00:05Z`, type: "response_item", payload: { type: "function_call", name: "shell", arguments: JSON.stringify({ command: ["bash", "-lc", "cargo build"] }), call_id: "c2" } },
    { timestamp: `2026-10-${day}T09:00:06Z`, type: "response_item", payload: { type: "function_call_output", call_id: "c2", output: "Exit code: 0\nWall time: 9 seconds\nOutput:\nFinished" } },
    { timestamp: `2026-10-${day}T09:00:07Z`, type: "response_item", payload: { type: "custom_tool_call", name: "apply_patch", input: "*** Begin Patch", call_id: "c3" } },
    { timestamp: `2026-10-${day}T09:00:08Z`, type: "event_msg", payload: { type: "turn_aborted", reason: "interrupted" } },
  ]));
}

function withHomes(fn) {
  const claude = tempDir();
  const codex = tempDir();
  const saved = { a: process.env.CLAUDE_CONFIG_DIR, b: process.env.CODEX_HOME };
  process.env.CLAUDE_CONFIG_DIR = claude;
  process.env.CODEX_HOME = codex;
  try {
    return fn(claude, codex);
  } finally {
    for (const [key, value] of [["CLAUDE_CONFIG_DIR", saved.a], ["CODEX_HOME", saved.b]]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("project paths are encoded the way Claude Code names its transcript folders", () => {
  assert.equal(encodeProjectDir("/home/user/weave"), "-home-user-weave");
  assert.equal(encodeProjectDir(PROJECT), "-home-dev-my-app");
});

test("Claude Code transcripts are normalized", () => {
  withHomes((claude) => {
    claudeFixture(claude);
    const [s] = loadSessions(PROJECT, { platforms: ["claude"] });
    assert.equal(s.platform, "claude");
    assert.equal(s.startedAt, "2026-10-01T10:00:00Z");
    assert.deepEqual(s.events.map((e) => e.kind), ["user", "tool", "tool", "interrupt", "user"]);
    assert.equal(s.events[0].text, "Fix the flaky login test");
    assert.equal(s.events[1].ok, false);
    assert.match(s.events[1].output, /Missing script/);
    assert.equal(s.events[2].output, "export function login() {}");
    assert.equal(s.events[4].text, "No, use pnpm here");
  });
});

test("Codex rollouts are normalized and filtered to this project", () => {
  withHomes((_, codex) => {
    codexFixture(codex, PROJECT, "01");
    codexFixture(codex, `${PROJECT}/packages/api`, "02"); // started in a subdirectory: still this project
    codexFixture(codex, "/home/dev/other", "03");
    codexFixture(codex, `${PROJECT}-two`, "04"); // shares a prefix but is a different project
    const sessions = loadSessions(PROJECT, { platforms: ["codex"] });
    assert.deepEqual(sessions.map((s) => s.id), ["cx-01", "cx-02"]);
    const s = sessions[0];
    assert.equal(s.events[0].text, "Bump the version and tag a release");
    const tools = s.events.filter((e) => e.kind === "tool");
    assert.deepEqual(tools.map((t) => t.name), ["Bash", "Read", "Bash", "apply_patch"]);
    assert.equal(tools[0].input.command, "cat package.json && cargo test");
    assert.equal(tools[0].ok, false);
    assert.equal(tools[1].input.file_path, "package.json");
    assert.equal(tools[2].input.command, "cargo build");
    assert.equal(tools[2].ok, true);
    assert.equal(s.events.at(-1).kind, "interrupt");
  });
});

test("both platforms merge into one timeline; missing homes are fine", () => {
  withHomes((claude, codex) => {
    assert.deepEqual(loadSessions(PROJECT), []);
    claudeFixture(claude);
    codexFixture(codex, PROJECT, "02");
    assert.deepEqual(loadSessions(PROJECT).map((s) => s.platform), ["claude", "codex"]);
  });
});
