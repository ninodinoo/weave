import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { init, uninstall, SKILLS } from "../lib/install.mjs";
import { runDoctor } from "../lib/doctor.mjs";
import { tempDir, write } from "./helpers.mjs";

const json = (dir, file) => JSON.parse(readFileSync(join(dir, file), "utf8"));
const both = { platforms: ["claude", "codex"] };

test("init installs skills, hooks and a runnable runtime for both tools", () => {
  const dir = tempDir();
  const result = init(dir, both);
  assert.deepEqual(result.platforms, ["claude", "codex"]);
  for (const skill of SKILLS) {
    for (const root of [".claude/skills", ".agents/skills"]) {
      const text = readFileSync(join(dir, root, `weave-${skill}`, "SKILL.md"), "utf8");
      assert.match(text, new RegExp(`^name: weave-${skill}$`, "m"));
      assert.ok(!text.includes("CLAUDE_PLUGIN_ROOT"), "plugin path must be rewritten");
      assert.ok(!text.includes("/weave:"), "plugin command names must be rewritten");
      assert.ok(text.includes("node .weave/runtime/cli/weave.mjs"));
    }
    assert.ok(existsSync(join(dir, ".agents/skills", `weave-${skill}`, "agents/openai.yaml")));
  }
  assert.ok(existsSync(join(dir, ".claude/skills/weave-evolve/references/hooks.md")));
  assert.equal(readFileSync(join(dir, ".weave/.gitignore"), "utf8"), "local/\n");
  assert.equal(json(dir, ".weave/config.json").mode, "project");

  // The vendored runtime must work on its own, from the project directory.
  const out = execFileSync("node", [".weave/runtime/cli/weave.mjs", "doctor", "--json"], { cwd: dir, encoding: "utf8" });
  assert.equal(JSON.parse(out).findings[0].rule, "no-instructions");
});

test("installed skills pass Weave's own linter", () => {
  const dir = tempDir();
  write(dir, "AGENTS.md", "# App\n- Money is integer cents.\n");
  init(dir, both);
  const result = runDoctor(dir);
  assert.equal(result.files.skills, SKILLS.length * 2);
  assert.deepEqual(result.findings, []);
});

test("init keeps other people's hooks and settings, and is idempotent", () => {
  const dir = tempDir();
  write(dir, ".claude/settings.json", {
    permissions: { allow: ["Bash(npm test)"] },
    hooks: { PostToolUse: [{ matcher: "Edit", hooks: [{ type: "command", command: "prettier --write" }] }], SessionStart: [{ hooks: [{ type: "command", command: "echo hi" }] }] },
  });
  write(dir, ".codex/hooks.json", { hooks: { Stop: [{ hooks: [{ type: "command", command: "make check" }] }] } });
  init(dir, both);
  const once = readFileSync(join(dir, ".claude/settings.json"), "utf8");
  init(dir, both);
  assert.equal(readFileSync(join(dir, ".claude/settings.json"), "utf8"), once);

  const claude = json(dir, ".claude/settings.json");
  assert.deepEqual(claude.permissions, { allow: ["Bash(npm test)"] });
  assert.equal(claude.hooks.PostToolUse[0].hooks[0].command, "prettier --write");
  assert.equal(claude.hooks.SessionStart.length, 2);
  assert.equal(claude.hooks.UserPromptSubmit.length, 1);
  assert.match(claude.hooks.UserPromptSubmit[0].hooks[0].command, /\$CLAUDE_PROJECT_DIR\/\.weave\/runtime\/cli\/weave\.mjs" hook prompt/);

  const codex = json(dir, ".codex/hooks.json");
  assert.deepEqual(Object.keys(codex), ["hooks"]); // Codex rejects unknown top-level keys
  assert.equal(codex.hooks.Stop[0].hooks[0].command, "make check");
  assert.match(codex.hooks.SessionStart[0].hooks[0].command, /hook session-start --platform codex/);
  assert.ok(codex.hooks.SessionStart[0].hooks[0].commandWindows);
});

test("init for one tool leaves the other alone", () => {
  const dir = tempDir();
  init(dir, { platforms: ["codex"] });
  assert.ok(existsSync(join(dir, ".agents/skills/weave-evolve")));
  assert.ok(!existsSync(join(dir, ".claude")));
});

test("init cleans up what Weave 0.x left behind", () => {
  const dir = tempDir();
  // 0.x named its commands "weave:<name>.md", which Windows cannot even create.
  const colonOk = process.platform !== "win32";
  if (colonOk) write(dir, ".claude/commands/weave:onboarding.md", "old");
  write(dir, ".claude/commands/weave-instructions/agents.md", "old");
  write(dir, ".claude/commands/mine.md", "keep");
  write(dir, ".claude/hooks/evolve-hook.js", "old");
  write(dir, ".claude/agents/weave-sync-agent.md", "old");
  const { legacy } = init(dir, both);
  assert.equal(legacy.length, colonOk ? 4 : 3);
  assert.ok(existsSync(join(dir, ".claude/commands/mine.md")));
  assert.ok(!existsSync(join(dir, ".claude/commands/weave:onboarding.md")));
});

test("uninstall removes Weave and nothing else; history survives unless purged", () => {
  const dir = tempDir();
  write(dir, ".claude/settings.json", { hooks: { PostToolUse: [{ matcher: "Edit", hooks: [{ type: "command", command: "prettier --write" }] }] } });
  write(dir, ".claude/skills/mine/SKILL.md", "---\nname: mine\ndescription: x\n---\n");
  init(dir, both);
  write(dir, ".weave/history.jsonl", "{}\n");
  uninstall(dir);
  assert.deepEqual(json(dir, ".claude/settings.json"), { hooks: { PostToolUse: [{ matcher: "Edit", hooks: [{ type: "command", command: "prettier --write" }] }] } });
  assert.ok(!existsSync(join(dir, ".codex/hooks.json")), "a hooks file that only held Weave's hooks is removed");
  assert.ok(existsSync(join(dir, ".claude/skills/mine/SKILL.md")));
  assert.ok(!existsSync(join(dir, ".claude/skills/weave-evolve")));
  assert.ok(!existsSync(join(dir, ".weave/runtime")));
  assert.ok(existsSync(join(dir, ".weave/history.jsonl")));
  uninstall(dir, { purge: true });
  assert.ok(!existsSync(join(dir, ".weave")));
});

test("plugin mode only creates state and never downgrades a project install", () => {
  const dir = tempDir();
  assert.equal(init(dir, { plugin: true }).mode, "plugin");
  assert.ok(!existsSync(join(dir, ".weave/runtime")));
  assert.ok(!existsSync(join(dir, ".claude")));
  init(dir, both);
  assert.equal(init(dir, { plugin: true }).mode, "project");
  assert.equal(json(dir, ".weave/config.json").mode, "project");
});
