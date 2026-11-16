import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze, commandKey, splitCommands, detectFeedback } from "../lib/analyze.mjs";
import { session, user, bash, read, edit } from "./helpers.mjs";

test("commandKey keeps the verb and drops arguments", () => {
  assert.equal(commandKey("npm run test:unit -- --watch"), "npm run test:unit");
  assert.equal(commandKey("CI=1 pnpm test src/foo.test.ts"), "pnpm test");
  assert.equal(commandKey("cargo build --release"), "cargo build");
  assert.equal(commandKey("docker compose up -d"), "docker compose up");
  assert.equal(commandKey("python -m pytest"), null); // python itself is not a project command
  assert.equal(commandKey("./scripts/deploy.sh staging"), "./scripts/deploy.sh");
  assert.equal(commandKey("pytest -x tests/"), "pytest");
});

test("commandKey ignores commands that say nothing about the project", () => {
  for (const cmd of ["ls -la", "cat foo.txt", "git status", "cd src", "echo hi", "-rl foo"]) {
    assert.equal(commandKey(cmd), null, cmd);
  }
});

test("splitCommands ignores heredocs and quoted scripts", () => {
  const line = "cd app && node -e 'const a = 1; console.log(a)' && npm test | tail -5\npython3 - <<'EOF'\nimport os; x = 1\nEOF";
  assert.deepEqual(splitCommands(line).map(commandKey).filter(Boolean), ["npm test"]);
});

test("detectFeedback separates standing instructions from corrections", () => {
  assert.equal(detectFeedback("From now on, use pnpm instead of npm.").kind, "standing");
  assert.equal(detectFeedback("Ab sofort bitte keine Kommentare mehr im Code.").kind, "standing");
  assert.equal(detectFeedback("Never commit directly to main").kind, "standing");
  assert.equal(detectFeedback("No, that's wrong, the config lives in app/settings").kind, "correction");
  assert.equal(detectFeedback("Nein, nicht so. Nimm die bestehende Funktion.").kind, "correction");
  assert.equal(detectFeedback("why did you delete the test?").kind, "correction");
  assert.equal(detectFeedback("Add a login page with email and password"), null);
});

test("always/never in a long task description is not a standing instruction", () => {
  const task = "Implement the cache layer. " + "It stores entries by key and evicts the oldest. ".repeat(8) + "The getter should never return undefined.";
  assert.equal(detectFeedback(task), null);
});

test("the quote is the sentence that carries the rule", () => {
  const found = detectFeedback("Looks good, thanks. From now on run the linter before you commit. Now on to the next task.");
  assert.equal(found.quote, "From now on run the linter before you commit.");
});

test("analyze finds failing commands and what fixed them", () => {
  const mk = (id, day) =>
    session(id, `2026-10-${day}T10:00:00Z`, [
      user("Fix the date parsing bug in the importer module"),
      bash("npm test", false, "npm ERR! Missing script: \"test\"\nnpm ERR! code 1"),
      bash("pnpm test"),
      edit("/repo/src/importer.ts"),
    ]);
  const report = analyze([mk("a", "01"), mk("b", "02"), mk("c", "03")], { projectDir: "/repo", instructionsText: "" });
  const failing = report.failingCommands.find((f) => f.command === "npm test");
  assert.equal(failing.sessions, 3);
  assert.equal(failing.usuallyFixedBy[0].command, "pnpm test");
  assert.match(failing.errors[0], /Missing script/);
  const frequent = report.frequentCommands.find((f) => f.command === "pnpm test");
  assert.equal(frequent.sessions, 3);
  assert.equal(frequent.documented, false);
});

test("analyze marks commands the instructions already mention", () => {
  const sessions = ["a", "b", "c"].map((id) => session(id, "2026-10-01T10:00:00Z", [user("run the checks please now"), bash("pnpm test")]));
  const report = analyze(sessions, { projectDir: "/repo", instructionsText: "Run `pnpm test` before committing." });
  assert.equal(report.frequentCommands[0].documented, true);
});

test("a correction only counts after the agent has done something", () => {
  const report = analyze(
    [
      session("a", "2026-10-01T10:00:00Z", [user("No idea why the build is red, can you look?"), bash("pnpm build"), user("No, don't touch the lockfile")]),
    ],
    { projectDir: "/repo" },
  );
  assert.equal(report.summary.corrections, 1);
  assert.match(report.feedback[0].quote, /lockfile/);
});

test("analyze finds hot files and repeated prompts across sessions", () => {
  const sessions = ["a", "b", "c", "d"].map((id, i) =>
    session(id, `2026-10-0${i + 1}T10:00:00Z`, [
      user("Write the release notes for the latest merged pull requests"),
      read("/repo/docs/architecture.md"),
      read(`/repo/src/file${i}.ts`),
      edit("/repo/CHANGELOG.md"),
    ]),
  );
  const report = analyze(sessions, { projectDir: "/repo" });
  assert.deepEqual(report.hotFiles.map((f) => f.file), ["docs/architecture.md"]);
  assert.equal(report.hotFiles[0].share, 100);
  assert.equal(report.repeatedPrompts[0].sessions, 4);
  assert.equal(report.summary.avgToolCallsBeforeFirstEdit, 2);
});

test("analyze copes with no sessions", () => {
  const report = analyze([], { projectDir: "/repo" });
  assert.equal(report.summary.sessions, 0);
  assert.deepEqual(report.feedback, []);
});
