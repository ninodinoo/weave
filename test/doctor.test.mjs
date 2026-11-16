import { test } from "node:test";
import assert from "node:assert/strict";
import { runDoctor } from "../lib/doctor.mjs";
import { tempDir, write } from "./helpers.mjs";

const rules = (result) => result.findings.map((f) => f.rule).sort();

test("an empty project is told to onboard", () => {
  assert.deepEqual(rules(runDoctor(tempDir())), ["no-instructions"]);
});

test("a lean, accurate setup scores 100", () => {
  const dir = tempDir();
  write(dir, "package.json", { scripts: { test: "vitest", lint: "eslint ." } });
  write(dir, "src/db/schema.ts", "");
  write(dir, "AGENTS.md", "# Shop\n\n## Commands\n- Verify with `pnpm run test` and `pnpm run lint`.\n\n## Rules\n- Money is integer cents; never floats.\n- Schema changes go through `src/db/schema.ts`.\n");
  write(dir, "CLAUDE.md", "@AGENTS.md\n");
  const result = runDoctor(dir);
  assert.deepEqual(result.findings, []);
  assert.equal(result.score, 100);
});

test("flags what makes instruction files worse", () => {
  const dir = tempDir();
  write(dir, "package.json", { scripts: { test: "vitest" } });
  write(dir, ".prettierrc", "{}");
  write(dir, "AGENTS.md", [
    "# App",
    "You are an expert senior engineer.",
    "Always write clean code and follow best practices.",
    "Use 2 spaces for indentation.",
    "Run `npm run typecheck` before committing.",
    "The entry point is `src/missing/main.ts`.",
    "Deploy key: ghp_abcdefghijklmnopqrstuvwxyz0123456789",
    "Version `1.2.3` and `https://example.com/a.html` and `foo()` are not paths.",
  ].join("\n"));
  const found = rules(runDoctor(dir));
  for (const rule of ["vague", "linter-job", "dead-script", "dead-path", "secret"]) assert.ok(found.includes(rule), `expected ${rule} in ${found}`);
  assert.equal(found.filter((r) => r === "dead-path").length, 1);
});

test("flags length, tree dumps and shouting", () => {
  const dir = tempDir();
  const tree = Array.from({ length: 14 }, (_, i) => `├── dir${i}/`).join("\n");
  const shout = Array.from({ length: 7 }, (_, i) => `IMPORTANT: rule number ${i} about thing ${i}`).join("\n");
  const filler = Array.from({ length: 320 }, (_, i) => `- fact ${i}`).join("\n");
  write(dir, "AGENTS.md", `# App\n${tree}\n${shout}\n${filler}\n`);
  const found = rules(runDoctor(dir));
  for (const rule of ["too-long", "tree-dump", "emphasis"]) assert.ok(found.includes(rule), `expected ${rule} in ${found}`);
});

test("flags CLAUDE.md and AGENTS.md drifting apart", () => {
  const dir = tempDir();
  const shared = "- All database access goes through the repository layer in the data package.";
  write(dir, "AGENTS.md", `# App\n${shared}\n`);
  write(dir, "CLAUDE.md", `# App\n${shared}\n`);
  const found = rules(runDoctor(dir));
  assert.ok(found.includes("two-sources"));
  assert.ok(found.includes("duplicate"));
});

test("flags missing verification commands", () => {
  const dir = tempDir();
  write(dir, "package.json", { scripts: { test: "vitest", build: "tsc" } });
  write(dir, "AGENTS.md", "# App\n- Money is integer cents.\n");
  assert.deepEqual(rules(runDoctor(dir)), ["no-verification"]);
});

test("checks skills and subagents", () => {
  const dir = tempDir();
  write(dir, "AGENTS.md", "# App\n- Money is integer cents.\n");
  write(dir, ".claude/skills/release/SKILL.md", "---\nname: release\ndescription: Cuts a release by bumping the version, tagging and publishing. Use when asked to release or publish.\n---\nSteps A\n");
  write(dir, ".agents/skills/release/SKILL.md", "---\nname: release\ndescription: Cuts a release by bumping the version, tagging and publishing. Use when asked to release or publish.\n---\nSteps B\n");
  write(dir, ".claude/skills/bad/SKILL.md", "---\nname: Other_Name\ndescription: short\n---\nbody\n");
  write(dir, ".claude/skills/none/SKILL.md", "no frontmatter\n");
  write(dir, ".claude/agents/reviewer.md", "---\nrole: reviews things\n---\nbody\n");
  const found = rules(runDoctor(dir));
  for (const rule of ["skill-drift", "skill-description", "skill-name", "skill-frontmatter", "agent-frontmatter"]) assert.ok(found.includes(rule), `expected ${rule} in ${found}`);
});

test("multi-line YAML descriptions are read", () => {
  const dir = tempDir();
  write(dir, "AGENTS.md", "# App\n- Money is integer cents.\n");
  write(dir, ".claude/skills/release/SKILL.md", "---\nname: release\ndescription: >\n  Cuts a release by bumping the version and tagging.\n  Use when asked to release.\n---\nbody\n");
  assert.deepEqual(runDoctor(dir).findings, []);
});
