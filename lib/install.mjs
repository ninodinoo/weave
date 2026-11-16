// Installs Weave into a project for Claude Code and/or Codex, and removes it again.
// Idempotent: running init twice leaves the same files as running it once.
import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, writeJson, readText, exists } from "./util.mjs";
import { paths } from "./state.mjs";

export const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const VERSION = readJson(join(PACKAGE_ROOT, "package.json"), {}).version ?? "0.0.0";
export const SKILLS = ["onboard", "evolve", "doctor"];

// How a skill invokes the CLI. The sources are written for the plugin layout;
// a project install points them at the vendored runtime instead.
const PLUGIN_CLI = 'node "${CLAUDE_PLUGIN_ROOT}/cli/weave.mjs"';
const PROJECT_CLI = "node .weave/runtime/cli/weave.mjs";

const MARK = "weave.mjs"; // identifies hook entries that belong to Weave
const GUARD = "command -v node >/dev/null 2>&1 &&";

const claudeHook = (event) =>
  `${GUARD} node "$CLAUDE_PROJECT_DIR/.weave/runtime/cli/weave.mjs" hook ${event} || true`;
const codexHook = (event) => ({
  type: "command",
  command: `${GUARD} node "$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.weave/runtime/cli/weave.mjs" hook ${event} --platform codex || true`,
  commandWindows: `node .weave\\runtime\\cli\\weave.mjs hook ${event} --platform codex`,
  timeout: 5,
});

function onPath(bin) {
  try {
    execFileSync(process.platform === "win32" ? "where" : "which", [bin], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function detectPlatforms(projectDir) {
  const has = (...p) => exists(join(projectDir, ...p));
  const found = [];
  if (has(".claude") || has("CLAUDE.md") || onPath("claude")) found.push("claude");
  if (has(".codex") || has(".agents") || onPath("codex")) found.push("codex");
  return found.length ? found : ["claude", "codex"];
}

function installSkills(targetRoot) {
  for (const skill of SKILLS) {
    const dest = join(targetRoot, `weave-${skill}`);
    rmSync(dest, { recursive: true, force: true });
    cpSync(join(PACKAGE_ROOT, "skills", skill), dest, { recursive: true });
    const file = join(dest, "SKILL.md");
    const text = readFileSync(file, "utf8")
      .replace(/^name: .*$/m, `name: weave-${skill}\nallowed-tools: Bash(${PROJECT_CLI} *)`)
      .replaceAll(PLUGIN_CLI, PROJECT_CLI)
      .replaceAll("/weave:", "/weave-");
    writeFileSync(file, text);
  }
}

function removeSkills(targetRoot) {
  for (const skill of SKILLS) rmSync(join(targetRoot, `weave-${skill}`), { recursive: true, force: true });
}

/** Drop Weave's handlers from a hooks map, leaving everyone else's untouched. */
function stripWeaveHooks(hooks) {
  for (const event of Object.keys(hooks ?? {})) {
    if (!Array.isArray(hooks[event])) continue;
    hooks[event] = hooks[event]
      .map((group) => ({ ...group, hooks: (group.hooks ?? []).filter((h) => !String(h.command ?? "").includes(MARK)) }))
      .filter((group) => group.hooks.length > 0);
    if (hooks[event].length === 0) delete hooks[event];
  }
  return hooks ?? {};
}

function installClaude(projectDir) {
  installSkills(join(projectDir, ".claude", "skills"));
  const file = join(projectDir, ".claude", "settings.json");
  const settings = readJson(file, {}) ?? {};
  const hooks = stripWeaveHooks(settings.hooks);
  (hooks.UserPromptSubmit ??= []).push({ hooks: [{ type: "command", command: claudeHook("prompt"), timeout: 5 }] });
  (hooks.SessionStart ??= []).push({ matcher: "startup", hooks: [{ type: "command", command: claudeHook("session-start"), timeout: 5 }] });
  settings.hooks = hooks;
  writeJson(file, settings);
}

function installCodex(projectDir) {
  installSkills(join(projectDir, ".agents", "skills"));
  const file = join(projectDir, ".codex", "hooks.json");
  const config = readJson(file, {}) ?? {};
  const hooks = stripWeaveHooks(config.hooks);
  (hooks.UserPromptSubmit ??= []).push({ hooks: [codexHook("prompt")] });
  (hooks.SessionStart ??= []).push({ matcher: "startup", hooks: [codexHook("session-start")] });
  config.hooks = hooks;
  writeJson(file, config);
}

function uninstallHooks(file, key = "hooks") {
  const config = readJson(file, null);
  if (!config) return;
  const hooks = stripWeaveHooks(config[key]);
  if (Object.keys(hooks).length) config[key] = hooks;
  else delete config[key];
  if (Object.keys(config).length === 0) rmSync(file, { force: true });
  else writeJson(file, config);
}

/** Files that Weave 0.x scattered around; none of them did anything useful. */
function removeLegacy(projectDir) {
  const removed = [];
  const drop = (...p) => {
    const full = join(projectDir, ...p);
    if (exists(full)) {
      rmSync(full, { recursive: true, force: true });
      removed.push(p.join("/"));
    }
  };
  const commands = join(projectDir, ".claude", "commands");
  if (exists(commands)) {
    for (const f of readdirSync(commands)) if (f.startsWith("weave:") || f === "weave-instructions") drop(".claude", "commands", f);
  }
  for (const a of ["architect-agent", "onboarding-agent", "optimizer-agent", "sync-agent"]) drop(".claude", "agents", `weave-${a}.md`);
  for (const h of ["evolve-hook.js", "context-guard.js"]) drop(".claude", "hooks", h);
  for (const h of ["weave-evolve-hook.js", "weave-context-guard.js"]) drop(".codex", "hooks", h);
  drop(".agents", "skills", "weave-instructions");
  drop(".weave", "platforms.json");
  drop(".weave", "signals.json");
  return removed;
}

function writeState(projectDir, platforms, mode) {
  const p = paths(projectDir);
  mkdirSync(p.local, { recursive: true });
  writeFileSync(join(p.root, ".gitignore"), "local/\n");
  const previous = readJson(p.config, {}) ?? {};
  writeJson(p.config, {
    version: VERSION,
    mode, // "project": runtime vendored into the repo; "plugin": provided by the Claude Code plugin
    platforms,
    installedAt: previous.installedAt ?? new Date().toISOString(),
  });
}

/**
 * @param {object} opts { platforms?: string[], plugin?: boolean }
 * @returns {{ platforms: string[], legacy: string[], mode: string }}
 */
export function init(projectDir, opts = {}) {
  if (opts.plugin) {
    // Skills and hooks come from the plugin; the project only needs its state folder.
    const existing = readJson(paths(projectDir).config, null);
    if (existing?.mode === "project") return { platforms: existing.platforms, legacy: [], mode: "project" };
    writeState(projectDir, ["claude"], "plugin");
    return { platforms: ["claude"], legacy: [], mode: "plugin" };
  }
  const platforms = opts.platforms?.length ? opts.platforms : detectPlatforms(projectDir);
  const legacy = removeLegacy(projectDir);

  const runtime = paths(projectDir).runtime;
  rmSync(runtime, { recursive: true, force: true });
  for (const dir of ["cli", "lib"]) cpSync(join(PACKAGE_ROOT, dir), join(runtime, dir), { recursive: true });
  writeJson(join(runtime, "package.json"), { name: "weave-runtime", version: VERSION, private: true, type: "module" });

  if (platforms.includes("claude")) installClaude(projectDir);
  if (platforms.includes("codex")) installCodex(projectDir);
  writeState(projectDir, platforms, "project");
  return { platforms, legacy, mode: "project" };
}

/** Removes skills, hooks and the runtime. History and config stay unless purge is set. */
export function uninstall(projectDir, opts = {}) {
  removeSkills(join(projectDir, ".claude", "skills"));
  removeSkills(join(projectDir, ".agents", "skills"));
  uninstallHooks(join(projectDir, ".claude", "settings.json"));
  uninstallHooks(join(projectDir, ".codex", "hooks.json"));
  removeLegacy(projectDir);
  const p = paths(projectDir);
  rmSync(p.runtime, { recursive: true, force: true });
  if (opts.purge) rmSync(p.root, { recursive: true, force: true });
}

export function installedSummary(projectDir) {
  const has = (...p) => exists(join(projectDir, ...p));
  return {
    config: readJson(paths(projectDir).config, null),
    claude: { skills: has(".claude", "skills", "weave-evolve", "SKILL.md"), hooks: (readText(join(projectDir, ".claude", "settings.json")) ?? "").includes(MARK) },
    codex: { skills: has(".agents", "skills", "weave-evolve", "SKILL.md"), hooks: (readText(join(projectDir, ".codex", "hooks.json")) ?? "").includes(MARK) },
  };
}
