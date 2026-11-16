// Installs Weave into a project for Claude Code and/or Codex, and removes it again.
// Idempotent: running init twice leaves the same files as running it once.
import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
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

// Identifies hook entries that belong to Weave: they run Weave's CLI with the `hook` subcommand.
const WEAVE_HOOK = /[\\/]cli[\\/]weave\.mjs"?\s+hook\s/;
const isWeaveHook = (h) => WEAVE_HOOK.test(`${h?.command ?? ""}`) || WEAVE_HOOK.test(`${h?.commandWindows ?? ""}`);
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

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * Reads a settings/hooks file that Weave is about to merge into. A file that exists but
 * cannot be understood is an error: writing over it would destroy the user's settings.
 */
function readHooksFile(file, label) {
  const text = readText(file);
  if (text === null || text.trim() === "") return {};
  let config;
  try {
    config = JSON.parse(text);
  } catch {
    throw new Error(`${label} is not valid JSON (comments and trailing commas are not supported). Fix it and run init again; nothing was changed.`);
  }
  const shapeOk = isObject(config) && (config.hooks === undefined || (isObject(config.hooks) && Object.values(config.hooks).every(Array.isArray)));
  if (!shapeOk) throw new Error(`${label}: "hooks" must be an object that maps each event to a list. Fix it and run init again; nothing was changed.`);
  return config;
}

/** Drop Weave's handlers from a hooks map. Groups without a Weave handler are returned as they are. */
function stripWeaveHooks(hooks) {
  if (!isObject(hooks)) return {};
  for (const event of Object.keys(hooks)) {
    if (!Array.isArray(hooks[event])) continue;
    const kept = [];
    let touched = false;
    for (const group of hooks[event]) {
      if (!isObject(group) || !Array.isArray(group.hooks) || !group.hooks.some(isWeaveHook)) {
        kept.push(group);
        continue;
      }
      touched = true;
      const rest = group.hooks.filter((h) => !isWeaveHook(h));
      if (rest.length) kept.push({ ...group, hooks: rest });
    }
    if (kept.length || !touched) hooks[event] = kept;
    else delete hooks[event];
  }
  return hooks;
}

const CLAUDE_SETTINGS = [".claude", "settings.json"];
const CODEX_HOOKS = [".codex", "hooks.json"];

function installClaude(projectDir) {
  installSkills(join(projectDir, ".claude", "skills"));
  const file = join(projectDir, ...CLAUDE_SETTINGS);
  const settings = readHooksFile(file, CLAUDE_SETTINGS.join("/"));
  const hooks = stripWeaveHooks(settings.hooks);
  (hooks.UserPromptSubmit ??= []).push({ hooks: [{ type: "command", command: claudeHook("prompt"), timeout: 5 }] });
  (hooks.SessionStart ??= []).push({ matcher: "startup", hooks: [{ type: "command", command: claudeHook("session-start"), timeout: 5 }] });
  settings.hooks = hooks;
  writeJson(file, settings);
}

function installCodex(projectDir) {
  installSkills(join(projectDir, ".agents", "skills"));
  const file = join(projectDir, ...CODEX_HOOKS);
  const config = readHooksFile(file, CODEX_HOOKS.join("/"));
  const hooks = stripWeaveHooks(config.hooks);
  (hooks.UserPromptSubmit ??= []).push({ hooks: [codexHook("prompt")] });
  (hooks.SessionStart ??= []).push({ matcher: "startup", hooks: [codexHook("session-start")] });
  config.hooks = hooks;
  writeJson(file, config);
}

function uninstallHooks(file) {
  const config = readJson(file, null);
  if (!isObject(config) || !isObject(config.hooks)) return; // missing or unreadable: not ours to touch
  const hooks = stripWeaveHooks(config.hooks);
  if (Object.keys(hooks).length) config.hooks = hooks;
  else delete config.hooks;
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
  const runtime = paths(projectDir).runtime;

  // Check everything that could fail before the first write, so a failed init changes nothing.
  if (resolve(PACKAGE_ROOT) === resolve(runtime) || !exists(join(PACKAGE_ROOT, "skills"))) {
    throw new Error("init has to run from the weave package (npx weave-ai init), not from the copy inside .weave/runtime.");
  }
  if (platforms.includes("claude")) readHooksFile(join(projectDir, ...CLAUDE_SETTINGS), CLAUDE_SETTINGS.join("/"));
  if (platforms.includes("codex")) readHooksFile(join(projectDir, ...CODEX_HOOKS), CODEX_HOOKS.join("/"));

  const legacy = removeLegacy(projectDir);
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
  const hooked = (parts) => {
    const hooks = readJson(join(projectDir, ...parts), null)?.hooks;
    return isObject(hooks) && Object.values(hooks).flat().some((g) => Array.isArray(g?.hooks) && g.hooks.some(isWeaveHook));
  };
  return {
    config: readJson(paths(projectDir).config, null),
    claude: { skills: has(".claude", "skills", "weave-evolve", "SKILL.md"), hooks: hooked(CLAUDE_SETTINGS) },
    codex: { skills: has(".agents", "skills", "weave-evolve", "SKILL.md"), hooks: hooked(CODEX_HOOKS) },
  };
}
