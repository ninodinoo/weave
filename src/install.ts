#!/usr/bin/env node

import pc from "picocolors";
import { existsSync, mkdirSync, cpSync, readdirSync, writeFileSync, readFileSync, rmSync, unlinkSync, statSync } from "fs";
import { resolve, join, dirname } from "path";
import { fileURLToPath } from "url";
import { createInterface } from "readline";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = resolve(__dirname, "..");

const BANNER = `
 ${pc.bold(pc.white("██╗    ██╗███████╗ █████╗ ██╗   ██╗███████╗"))}
 ${pc.bold(pc.white("██║    ██║██╔════╝██╔══██╗██║   ██║██╔════╝"))}
 ${pc.bold(pc.white("██║ █╗ ██║█████╗  ███████║██║   ██║█████╗  "))}
 ${pc.bold(pc.white("██║███╗██║██╔══╝  ██╔══██║╚██╗ ██╔╝██╔══╝  "))}
 ${pc.bold(pc.white("╚███╔███╔╝███████╗██║  ██║ ╚████╔╝ ███████╗"))}
 ${pc.bold(pc.white(" ╚══╝╚══╝ ╚══════╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝"))}

  🧶 ${pc.dim("Your AI workflow, woven to perfection.")}
`;

interface Platform {
  id: string;
  name: string;
  detected: boolean;
}

function detectPlatforms(projectDir: string): Platform[] {
  return [
    {
      id: "claude-code",
      name: "Claude Code",
      detected: existsSync(join(projectDir, ".claude")),
    },
    {
      id: "openclaw",
      name: "OpenClaw",
      detected: existsSync(join(projectDir, "skills")) || existsSync(join(projectDir, ".openclaw")),
    },
    {
      id: "cursor",
      name: "Cursor",
      detected: existsSync(join(projectDir, ".cursor")),
    },
    {
      id: "codex",
      name: "Codex",
      detected: existsSync(join(projectDir, ".codex")) || existsSync(join(projectDir, "AGENTS.md")),
    },
  ];
}

// Line-buffered stdin reader that works with both TTY and piped input
const stdinLines: string[] = [];
let stdinReady = false;
let stdinResolvers: ((line: string) => void)[] = [];

const rl = createInterface({ input: process.stdin, terminal: false });
rl.on("line", (line) => {
  const resolver = stdinResolvers.shift();
  if (resolver) {
    resolver(line.trim());
  } else {
    stdinLines.push(line.trim());
  }
});
rl.on("close", () => {
  stdinReady = true;
  // Resolve any pending asks with empty string
  for (const r of stdinResolvers) r("");
  stdinResolvers = [];
});

function ask(question: string): Promise<string> {
  process.stdout.write(question);
  return new Promise((resolve) => {
    const buffered = stdinLines.shift();
    if (buffered !== undefined) {
      resolve(buffered);
    } else if (stdinReady) {
      resolve("");
    } else {
      stdinResolvers.push(resolve);
    }
  });
}

function copyDir(src: string, dest: string, prefix: string): number {
  if (!existsSync(src)) return 0;
  try {
    mkdirSync(dest, { recursive: true });
  } catch (err: any) {
    console.error(`  ${pc.red("✗")} Failed to create directory ${dest}: ${err.message}`);
    return 0;
  }
  let count = 0;
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.isDirectory() ? entry.name : `${prefix}${entry.name}`);
    if (entry.isDirectory()) {
      count += copyDir(srcPath, destPath, prefix);
    } else {
      try {
        cpSync(srcPath, destPath);
        count++;
      } catch (err: any) {
        console.error(`  ${pc.red("✗")} Failed to copy ${entry.name}: ${err.message}`);
      }
    }
  }
  return count;
}

function readMasterInstructions(): string {
  const instrDir = join(packageRoot, "master-instructions");
  const parts: string[] = [];
  if (existsSync(instrDir)) {
    for (const file of readdirSync(instrDir).sort()) {
      if (file.endsWith(".md")) {
        parts.push(readFileSync(join(instrDir, file), "utf-8"));
      }
    }
  }
  return parts.join("\n\n");
}

function readAgentDefinitions(): string {
  const agentsDir = join(packageRoot, "agents");
  const parts: string[] = [];
  if (existsSync(agentsDir)) {
    for (const file of readdirSync(agentsDir).sort()) {
      if (file.endsWith(".md")) {
        parts.push(readFileSync(join(agentsDir, file), "utf-8"));
      }
    }
  }
  return parts.join("\n\n");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Claude Code — full native support
// Skills (.claude/commands/), Subagents, Hooks
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function installClaudeCode(projectDir: string): void {
  const claudeDir = join(projectDir, ".claude");
  mkdirSync(join(claudeDir, "commands"), { recursive: true });
  mkdirSync(join(claudeDir, "agents"), { recursive: true });

  // Skills → .claude/commands/weave:*.md
  const skillCount = copyDir(join(packageRoot, "commands"), join(claudeDir, "commands"), "weave:");
  console.log(`  ${pc.green("✓")} ${skillCount} skills installed`);

  // Subagents → .claude/agents/weave-*.md
  const agentCount = copyDir(join(packageRoot, "agents"), join(claudeDir, "agents"), "weave-");
  console.log(`  ${pc.green("✓")} ${agentCount} subagents installed`);

  // Master-instructions as skill references
  const instrCount = copyDir(join(packageRoot, "master-instructions"), join(claudeDir, "commands", "weave-instructions"), "");
  console.log(`  ${pc.green("✓")} ${instrCount} master-instructions installed`);

  // Hooks → .claude/hooks/
  const hookCount = copyDir(join(packageRoot, "hooks"), join(claudeDir, "hooks"), "");
  console.log(`  ${pc.green("✓")} ${hookCount} hooks installed`);

  // CLAUDE.md — ensure Weave section exists so Claude knows about the plugin
  const claudeMdPath = join(projectDir, "CLAUDE.md");
  const weaveSection = [
    "",
    "<!-- Generated by Weave 🧶 — Do not edit this section manually -->",
    "## Weave Workflow",
    "",
    "This project uses the Weave AI workflow framework.",
    "Run `/weave:onboarding` to set up your personalized workflow.",
    "Run `/weave:status` to see the current setup.",
    "Run `/weave:evolve` to optimize the workflow based on project changes.",
    "Read `.weave/config.json` for project and user context.",
    "<!-- End Weave section -->",
    "",
  ].join("\n");

  if (existsSync(claudeMdPath)) {
    const existing = readFileSync(claudeMdPath, "utf-8");
    if (!existing.includes("Generated by Weave")) {
      writeFileSync(claudeMdPath, existing.trimEnd() + "\n" + weaveSection);
      console.log(`  ${pc.green("✓")} Weave section added to CLAUDE.md`);
    }
  } else {
    writeFileSync(claudeMdPath, weaveSection.trimStart());
    console.log(`  ${pc.green("✓")} CLAUDE.md created`);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// OpenClaw — skills + sub-skills + hooks
// SKILL.md, SOUL.md, STYLE.md, AGENTS.md, hooks/
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function installOpenClaw(projectDir: string): void {
  const skillDir = join(projectDir, "skills", "weave");
  mkdirSync(skillDir, { recursive: true });

  // Main SKILL.md — master instructions + agent definitions
  const skillMd = [
    "---",
    "name: weave",
    "description: AI workflow framework — personalized agents, teams, and rules",
    "version: 1.0.0",
    "metadata:",
    "  openclaw:",
    "    emoji: \"🧶\"",
    "---",
    "",
    "# Weave — AI Workflow Framework",
    "",
    "You have access to the Weave workflow system. Weave personalizes your AI workflow",
    "based on who you are, what you're building, and how you work.",
    "",
    "## Available Skills",
    "- `weave:onboarding` — Start the onboarding conversation",
    "- `weave:evolve` — Optimize your workflow",
    "- `weave:status` — Show current setup",
    "- `weave:sync` — Sync workflow across platforms",
    "- `weave:add-agent` — Add a new agent",
    "- `weave:add-skill` — Create a new skill",
    "- `weave:add-team` — Define a new agent team",
    "",
    "## State",
    "Weave stores its state in `.weave/` in the project root.",
    "Read `.weave/config.json` for user and project context.",
    "",
    readMasterInstructions(),
    "",
    "## Agent Definitions",
    "",
    readAgentDefinitions(),
  ].join("\n");

  try {
    writeFileSync(join(skillDir, "SKILL.md"), skillMd);
    console.log(`  ${pc.green("✓")} skills/weave/SKILL.md created`);
  } catch (err: any) {
    console.error(`  ${pc.red("✗")} Failed to create SKILL.md: ${err.message}`);
  }

  // Sub-skills for each command
  const subSkillsDir = join(skillDir, "sub-skills");
  const commandsDir = join(packageRoot, "commands");
  if (existsSync(commandsDir)) {
    let count = 0;
    for (const file of readdirSync(commandsDir)) {
      if (file.endsWith(".md")) {
        const name = file.replace(".md", "");
        const subDir = join(subSkillsDir, name);
        mkdirSync(subDir, { recursive: true });
        cpSync(join(commandsDir, file), join(subDir, "SKILL.md"));
        count++;
      }
    }
    console.log(`  ${pc.green("✓")} ${count} sub-skills created`);
  }

  // SOUL.md — agent identity & personality
  const soulPath = join(projectDir, "SOUL.md");
  if (!existsSync(soulPath)) {
    writeFileSync(soulPath, [
      "<!-- Generated by Weave 🧶 — Run weave:onboarding to personalize -->",
      "",
      "# Identity",
      "",
      "You are an AI assistant powered by the Weave workflow framework.",
      "Read the weave skill for your full instructions, agent definitions, and team configurations.",
      "Read `.weave/config.json` for project and user context.",
      "",
    ].join("\n"));
    console.log(`  ${pc.green("✓")} SOUL.md created`);
  }

  // STYLE.md — voice & expression
  const stylePath = join(projectDir, "STYLE.md");
  if (!existsSync(stylePath)) {
    writeFileSync(stylePath, [
      "<!-- Generated by Weave 🧶 — Run weave:onboarding to personalize -->",
      "",
      "# Style",
      "",
      "Adapt your communication style based on the user context in `.weave/config.json`.",
      "",
    ].join("\n"));
    console.log(`  ${pc.green("✓")} STYLE.md created`);
  }

  // AGENTS.md — multi-agent workflow definitions
  const agentsMdPath = join(projectDir, "AGENTS.md");
  if (!existsSync(agentsMdPath)) {
    writeFileSync(agentsMdPath, [
      "<!-- Generated by Weave 🧶 — Run weave:onboarding to personalize -->",
      "",
      "# Multi-Agent Workflows",
      "",
      "Agent delegation patterns and team configurations are defined in `.weave/teams/`.",
      "Read the weave skill for agent definitions.",
      "",
    ].join("\n"));
    console.log(`  ${pc.green("✓")} AGENTS.md created`);
  }

  // Hooks → hooks/
  const hooksDir = join(projectDir, "hooks");
  mkdirSync(hooksDir, { recursive: true });
  const hookCount = copyDir(join(packageRoot, "hooks"), hooksDir, "weave-");
  console.log(`  ${pc.green("✓")} ${hookCount} hooks installed`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Cursor — commands + rules (.mdc) + hooks
// .cursor/commands/, .cursor/rules/, hooks.json
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function installCursor(projectDir: string): void {
  const cursorDir = join(projectDir, ".cursor");

  // Commands → .cursor/commands/*.md (slash commands)
  mkdirSync(join(cursorDir, "commands"), { recursive: true });
  const cmdCount = copyDir(join(packageRoot, "commands"), join(cursorDir, "commands"), "weave-");
  console.log(`  ${pc.green("✓")} ${cmdCount} commands installed`);

  // Rules → .cursor/rules/weave.mdc (stable .mdc format)
  const rulesDir = join(cursorDir, "rules");
  mkdirSync(rulesDir, { recursive: true });
  const ruleMdc = [
    "---",
    "description: Weave AI workflow framework — agents, teams, and rules",
    "alwaysApply: true",
    "---",
    "",
    "# Weave Workflow Rules",
    "",
    "You have access to the Weave workflow system via `/weave-*` commands.",
    "Read `.weave/config.json` for project and user context.",
    "",
    readMasterInstructions(),
    "",
    "## Agent Definitions",
    "",
    readAgentDefinitions(),
  ].join("\n");
  writeFileSync(join(rulesDir, "weave.mdc"), ruleMdc);
  console.log(`  ${pc.green("✓")} rules/weave.mdc created`);

  // Master-instructions as reference
  const instrCount = copyDir(join(packageRoot, "master-instructions"), join(cursorDir, "commands", "weave-instructions"), "");
  console.log(`  ${pc.green("✓")} ${instrCount} master-instructions installed`);

  // Hooks → .cursor/hooks.json
  const hooksPath = join(cursorDir, "hooks.json");
  const weaveHooks = {
    version: 1,
    hooks: {
      afterFileEdit: [
        {
          command: "node .cursor/hooks/weave-evolve-hook.js",
          description: "Weave: track file edit patterns",
        },
      ],
    },
  };

  if (!existsSync(hooksPath)) {
    writeFileSync(hooksPath, JSON.stringify(weaveHooks, null, 2));
    console.log(`  ${pc.green("✓")} hooks.json created`);
  } else {
    console.log(`  ${pc.dim("—")} hooks.json already exists, skipped (add Weave hooks manually)`);
  }

  // Copy hook scripts
  mkdirSync(join(cursorDir, "hooks"), { recursive: true });
  const hookCount = copyDir(join(packageRoot, "hooks"), join(cursorDir, "hooks"), "weave-");
  console.log(`  ${pc.green("✓")} ${hookCount} hook scripts installed`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Codex — AGENTS.md + skills + hooks
// AGENTS.md (cascading), .agents/skills/, .codex/hooks.json
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function installCodex(projectDir: string): void {
  // AGENTS.md at project root (Codex equivalent of CLAUDE.md)
  const agentsMdPath = join(projectDir, "AGENTS.md");
  if (!existsSync(agentsMdPath)) {
    const agentsMd = [
      "<!-- Generated by Weave 🧶 — Run weave:onboarding to personalize -->",
      "",
      "# Weave Workflow",
      "",
      "You have access to the Weave workflow system.",
      "Read `.weave/config.json` for project and user context.",
      "",
      readMasterInstructions(),
      "",
      "## Agent Definitions",
      "",
      readAgentDefinitions(),
    ].join("\n");
    writeFileSync(agentsMdPath, agentsMd);
    console.log(`  ${pc.green("✓")} AGENTS.md created`);
  } else {
    console.log(`  ${pc.dim("—")} AGENTS.md already exists, skipped`);
  }

  // Skills → .agents/skills/weave-*/SKILL.md
  const skillsDir = join(projectDir, ".agents", "skills");
  const commandsDir = join(packageRoot, "commands");
  if (existsSync(commandsDir)) {
    let count = 0;
    for (const file of readdirSync(commandsDir)) {
      if (file.endsWith(".md")) {
        const name = file.replace(".md", "");
        const skillDir = join(skillsDir, `weave-${name}`);
        mkdirSync(skillDir, { recursive: true });
        cpSync(join(commandsDir, file), join(skillDir, "SKILL.md"));
        count++;
      }
    }
    console.log(`  ${pc.green("✓")} ${count} skills created`);
  }

  // Master-instructions as reference skills
  const instrDir = join(packageRoot, "master-instructions");
  if (existsSync(instrDir)) {
    const refDir = join(skillsDir, "weave-instructions");
    mkdirSync(refDir, { recursive: true });
    const instrCount = copyDir(instrDir, join(refDir, "references"), "");
    console.log(`  ${pc.green("✓")} ${instrCount} master-instructions as references`);
  }

  // Hooks → .codex/hooks.json
  const codexDir = join(projectDir, ".codex");
  mkdirSync(codexDir, { recursive: true });
  const hooksPath = join(codexDir, "hooks.json");
  if (!existsSync(hooksPath)) {
    const codexHooks = {
      hooks: {
        SessionStart: [
          {
            hooks: [
              {
                type: "command",
                command: "node .codex/hooks/weave-evolve-hook.js",
                statusMessage: "Weave: loading workflow context...",
                timeout: 10,
              },
            ],
          },
        ],
      },
    };
    writeFileSync(hooksPath, JSON.stringify(codexHooks, null, 2));
    console.log(`  ${pc.green("✓")} .codex/hooks.json created`);
  } else {
    console.log(`  ${pc.dim("—")} .codex/hooks.json already exists, skipped`);
  }

  // Copy hook scripts
  mkdirSync(join(codexDir, "hooks"), { recursive: true });
  const hookCount = copyDir(join(packageRoot, "hooks"), join(codexDir, "hooks"), "weave-");
  console.log(`  ${pc.green("✓")} ${hookCount} hook scripts installed`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// .weave/ state directory
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function installWeaveState(projectDir: string, selectedPlatforms: Platform[]): void {
  const weaveDir = join(projectDir, ".weave");
  for (const dir of ["agents", "skills", "teams", "rules", "history"]) {
    mkdirSync(join(weaveDir, dir), { recursive: true });
  }

  const platformIds = selectedPlatforms.map((p) => p.id);

  const configPath = join(weaveDir, "config.json");
  if (!existsSync(configPath)) {
    writeFileSync(configPath, JSON.stringify({
      version: "1.0",
      user: { role: "", experience: "", stack: [], preferences: { language: "", responseStyle: "balanced", planFirst: true } },
      project: { name: "", description: "", vision: "", type: "", stack: [], features: [], team: [], milestones: [] },
      platforms: platformIds,
      generatedAt: "",
      lastEvolved: "",
    }, null, 2));
  }

  const platformsPath = join(weaveDir, "platforms.json");
  if (!existsSync(platformsPath)) {
    writeFileSync(platformsPath, JSON.stringify({ active: platformIds, lastSync: "" }, null, 2));
  }

  console.log(`  ${pc.green("✓")} .weave/ state directory created`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Uninstall — remove Weave from current project
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function removeIfExists(path: string, label: string): boolean {
  if (!existsSync(path)) return false;
  try {
    const stat = statSync(path);
    if (stat.isDirectory()) {
      rmSync(path, { recursive: true });
    } else {
      unlinkSync(path);
    }
    console.log(`  ${pc.red("✗")} ${label} removed`);
    return true;
  } catch (err: any) {
    console.error(`  ${pc.red("!")} Failed to remove ${label}: ${err.message}`);
    return false;
  }
}

function removeWeaveFromFile(filePath: string, label: string): void {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, "utf-8");
  if (!content.includes("Generated by Weave")) return;

  const cleaned = content
    .replace(/\n?<!-- Generated by Weave 🧶[^>]*-->[\s\S]*?<!-- End Weave section -->\n?/g, "")
    .replace(/^<!-- Generated by Weave 🧶[^>]*-->\n[\s\S]*$/g, "")
    .trim();

  if (cleaned.length === 0) {
    unlinkSync(filePath);
    console.log(`  ${pc.red("✗")} ${label} removed (was Weave-only)`);
  } else {
    writeFileSync(filePath, cleaned + "\n");
    console.log(`  ${pc.red("✗")} Weave section removed from ${label}`);
  }
}

async function uninstall(): Promise<void> {
  console.log(BANNER);
  const projectDir = process.cwd();

  console.log(pc.dim("  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));

  if (!existsSync(join(projectDir, ".weave"))) {
    console.log(`\n  ${pc.yellow("!")} Weave is not installed in this directory.\n`);
    rl.close(); process.exit(0);
  }

  // Show what will be removed
  console.log(`\n  ${pc.bold(pc.red("This will remove ALL Weave files from this project:"))}\n`);

  const targets: string[] = [];
  const check = (path: string, label: string) => {
    if (existsSync(join(projectDir, path))) {
      targets.push(label);
      console.log(`    ${pc.red("×")} ${label}`);
    }
  };

  check(".weave", ".weave/ (all config, agents, teams, rules, history)");
  check(".claude/commands/weave:onboarding.md", ".claude/commands/weave:*.md (skills)");
  check(".claude/agents/weave-onboarding-agent.md", ".claude/agents/weave-*.md (subagents)");
  check(".claude/commands/weave-instructions", ".claude/commands/weave-instructions/ (master-instructions)");
  check(".claude/hooks/evolve-hook.js", ".claude/hooks/ (weave hooks)");
  check("skills/weave", "skills/weave/ (OpenClaw skills)");
  check(".cursor/commands/weave-onboarding.md", ".cursor/commands/weave-*.md (commands)");
  check(".cursor/rules/weave.mdc", ".cursor/rules/weave.mdc (rules)");
  check(".cursor/commands/weave-instructions", ".cursor/commands/weave-instructions/");
  check(".cursor/hooks/weave-evolve-hook.js", ".cursor/hooks/weave-*.js (hook scripts)");
  check(".agents/skills/weave-onboarding", ".agents/skills/weave-*/ (Codex skills)");
  check(".codex/hooks", ".codex/hooks/ (Codex hooks)");

  // Check files that might have Weave sections
  for (const f of ["CLAUDE.md", "SOUL.md", "STYLE.md", "AGENTS.md"]) {
    if (existsSync(join(projectDir, f))) {
      const content = readFileSync(join(projectDir, f), "utf-8");
      if (content.includes("Generated by Weave")) {
        console.log(`    ${pc.red("×")} ${f} (Weave content)`);
      }
    }
  }

  if (targets.length === 0) {
    console.log(`    ${pc.dim("(nothing found)")}`);
    rl.close(); process.exit(0);
  }

  // Confirmation 1
  console.log();
  const confirm1 = await ask(`  ${pc.bold(pc.red("Are you sure?"))} This cannot be undone. (yes/no): `);
  if (confirm1.toLowerCase() !== "yes") {
    console.log(`\n  ${pc.dim("Aborted.")}\n`);
    rl.close(); process.exit(0);
  }

  // Confirmation 2
  const confirm2 = await ask(`  ${pc.bold(pc.red("Type UNWEAVE to confirm:"))} `);
  if (confirm2 !== "UNWEAVE") {
    console.log(`\n  ${pc.dim("Aborted.")}\n`);
    rl.close(); process.exit(0);
  }

  console.log();
  console.log(pc.dim("  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
  console.log();

  // Remove .weave/
  removeIfExists(join(projectDir, ".weave"), ".weave/");

  // Claude Code
  const claudeCommands = join(projectDir, ".claude", "commands");
  if (existsSync(claudeCommands)) {
    for (const f of readdirSync(claudeCommands)) {
      if (f.startsWith("weave:") || f === "weave-instructions") {
        removeIfExists(join(claudeCommands, f), `.claude/commands/${f}`);
      }
    }
  }
  const claudeAgents = join(projectDir, ".claude", "agents");
  if (existsSync(claudeAgents)) {
    for (const f of readdirSync(claudeAgents)) {
      if (f.startsWith("weave-")) {
        removeIfExists(join(claudeAgents, f), `.claude/agents/${f}`);
      }
    }
  }
  removeIfExists(join(projectDir, ".claude", "hooks", "evolve-hook.js"), ".claude/hooks/evolve-hook.js");
  removeIfExists(join(projectDir, ".claude", "hooks", "context-guard.js"), ".claude/hooks/context-guard.js");

  // OpenClaw
  removeIfExists(join(projectDir, "skills", "weave"), "skills/weave/");
  removeIfExists(join(projectDir, "hooks", "weave-evolve-hook.js"), "hooks/weave-evolve-hook.js");
  removeIfExists(join(projectDir, "hooks", "weave-context-guard.js"), "hooks/weave-context-guard.js");

  // Cursor
  const cursorCommands = join(projectDir, ".cursor", "commands");
  if (existsSync(cursorCommands)) {
    for (const f of readdirSync(cursorCommands)) {
      if (f.startsWith("weave-") || f === "weave-instructions") {
        removeIfExists(join(cursorCommands, f), `.cursor/commands/${f}`);
      }
    }
  }
  removeIfExists(join(projectDir, ".cursor", "rules", "weave.mdc"), ".cursor/rules/weave.mdc");
  removeIfExists(join(projectDir, ".cursor", "hooks", "weave-evolve-hook.js"), ".cursor/hooks/weave-evolve-hook.js");
  removeIfExists(join(projectDir, ".cursor", "hooks", "weave-context-guard.js"), ".cursor/hooks/weave-context-guard.js");
  // Remove Weave entries from hooks.json if it exists
  const cursorHooksPath = join(projectDir, ".cursor", "hooks.json");
  if (existsSync(cursorHooksPath)) {
    try {
      const hooksJson = JSON.parse(readFileSync(cursorHooksPath, "utf-8"));
      let modified = false;
      for (const event of Object.keys(hooksJson.hooks || {})) {
        const filtered = (hooksJson.hooks[event] as any[]).filter(
          (h: any) => !h.command?.includes("weave-") && !h.description?.includes("Weave")
        );
        if (filtered.length !== hooksJson.hooks[event].length) {
          hooksJson.hooks[event] = filtered;
          modified = true;
        }
      }
      if (modified) {
        // Remove empty event arrays
        for (const event of Object.keys(hooksJson.hooks)) {
          if (hooksJson.hooks[event].length === 0) delete hooksJson.hooks[event];
        }
        if (Object.keys(hooksJson.hooks).length === 0) {
          unlinkSync(cursorHooksPath);
          console.log(`  ${pc.red("✗")} .cursor/hooks.json removed (was Weave-only)`);
        } else {
          writeFileSync(cursorHooksPath, JSON.stringify(hooksJson, null, 2));
          console.log(`  ${pc.red("✗")} Weave hooks removed from .cursor/hooks.json`);
        }
      }
    } catch {}
  }

  // Codex
  const agentsSkills = join(projectDir, ".agents", "skills");
  if (existsSync(agentsSkills)) {
    for (const f of readdirSync(agentsSkills)) {
      if (f.startsWith("weave-")) {
        removeIfExists(join(agentsSkills, f), `.agents/skills/${f}`);
      }
    }
  }
  removeIfExists(join(projectDir, ".codex", "hooks", "weave-evolve-hook.js"), ".codex/hooks/weave-evolve-hook.js");
  removeIfExists(join(projectDir, ".codex", "hooks", "weave-context-guard.js"), ".codex/hooks/weave-context-guard.js");
  // Clean .codex/hooks.json
  const codexHooksPath = join(projectDir, ".codex", "hooks.json");
  if (existsSync(codexHooksPath)) {
    try {
      const hooksJson = JSON.parse(readFileSync(codexHooksPath, "utf-8"));
      let isWeaveOnly = true;
      for (const event of Object.keys(hooksJson.hooks || {})) {
        for (const group of hooksJson.hooks[event]) {
          for (const h of group.hooks || []) {
            if (!h.command?.includes("weave-")) isWeaveOnly = false;
          }
        }
      }
      if (isWeaveOnly) {
        unlinkSync(codexHooksPath);
        console.log(`  ${pc.red("✗")} .codex/hooks.json removed`);
      }
    } catch {}
  }

  // Clean Weave sections from shared files
  removeWeaveFromFile(join(projectDir, "CLAUDE.md"), "CLAUDE.md");
  removeWeaveFromFile(join(projectDir, "SOUL.md"), "SOUL.md");
  removeWeaveFromFile(join(projectDir, "STYLE.md"), "STYLE.md");
  removeWeaveFromFile(join(projectDir, "AGENTS.md"), "AGENTS.md");

  console.log();
  console.log(pc.dim("  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
  console.log();
  console.log(`  ${pc.green(pc.bold("Done."))} Weave has been completely removed from this project.`);
  console.log(`  ${pc.dim("Your other project files are untouched.")}`);
  console.log();
  rl.close();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Purge — remove Weave from the entire system
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function purge(): Promise<void> {
  console.log(BANNER);

  console.log(pc.dim("  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
  console.log();
  console.log(`  ${pc.bold(pc.red("SYSTEM-WIDE PURGE"))}`);
  console.log();
  console.log(`  This will:`);
  console.log(`    ${pc.red("1.")} Remove Weave from the ${pc.bold("current project")} (same as uninstall)`);
  console.log(`    ${pc.red("2.")} Remove the ${pc.bold("weave-ai npm package")} globally`);
  console.log(`    ${pc.red("3.")} Clear the ${pc.bold("npx cache")} for weave-ai`);
  console.log();

  // Confirmation 1
  const confirm1 = await ask(`  ${pc.bold(pc.red("Are you sure?"))} This removes Weave everywhere. (yes/no): `);
  if (confirm1.toLowerCase() !== "yes") {
    console.log(`\n  ${pc.dim("Aborted.")}\n`);
    rl.close(); process.exit(0);
  }

  // Confirmation 2
  const confirm2 = await ask(`  ${pc.bold(pc.red("Type PURGE-WEAVE to confirm:"))} `);
  if (confirm2 !== "PURGE-WEAVE") {
    console.log(`\n  ${pc.dim("Aborted.")}\n`);
    rl.close(); process.exit(0);
  }

  // Confirmation 3
  const confirm3 = await ask(`  ${pc.bold(pc.red("Last chance. Really purge?"))} (yes/no): `);
  if (confirm3.toLowerCase() !== "yes") {
    console.log(`\n  ${pc.dim("Aborted.")}\n`);
    rl.close(); process.exit(0);
  }

  console.log();
  console.log(pc.dim("  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
  console.log();

  // Step 1: Remove from current project (if .weave exists)
  const projectDir = process.cwd();
  if (existsSync(join(projectDir, ".weave"))) {
    console.log(`  ${pc.bold("Step 1: Removing from current project...")}`);
    // Inline simplified uninstall (no prompts since we already confirmed 3x)
    removeIfExists(join(projectDir, ".weave"), ".weave/");

    // Claude Code files
    const claudeCommands = join(projectDir, ".claude", "commands");
    if (existsSync(claudeCommands)) {
      for (const f of readdirSync(claudeCommands)) {
        if (f.startsWith("weave:") || f === "weave-instructions") {
          removeIfExists(join(claudeCommands, f), `.claude/commands/${f}`);
        }
      }
    }
    const claudeAgents = join(projectDir, ".claude", "agents");
    if (existsSync(claudeAgents)) {
      for (const f of readdirSync(claudeAgents)) {
        if (f.startsWith("weave-")) removeIfExists(join(claudeAgents, f), `.claude/agents/${f}`);
      }
    }
    removeIfExists(join(projectDir, ".claude", "hooks", "evolve-hook.js"), ".claude/hooks/evolve-hook.js");
    removeIfExists(join(projectDir, ".claude", "hooks", "context-guard.js"), ".claude/hooks/context-guard.js");

    // OpenClaw
    removeIfExists(join(projectDir, "skills", "weave"), "skills/weave/");
    removeIfExists(join(projectDir, "hooks", "weave-evolve-hook.js"), "hooks/weave-evolve-hook.js");
    removeIfExists(join(projectDir, "hooks", "weave-context-guard.js"), "hooks/weave-context-guard.js");

    // Cursor
    const cursorCmds = join(projectDir, ".cursor", "commands");
    if (existsSync(cursorCmds)) {
      for (const f of readdirSync(cursorCmds)) {
        if (f.startsWith("weave-") || f === "weave-instructions") removeIfExists(join(cursorCmds, f), `.cursor/commands/${f}`);
      }
    }
    removeIfExists(join(projectDir, ".cursor", "rules", "weave.mdc"), ".cursor/rules/weave.mdc");
    removeIfExists(join(projectDir, ".cursor", "hooks", "weave-evolve-hook.js"), ".cursor/hooks/weave-evolve-hook.js");
    removeIfExists(join(projectDir, ".cursor", "hooks", "weave-context-guard.js"), ".cursor/hooks/weave-context-guard.js");

    // Codex
    const agentsSkills = join(projectDir, ".agents", "skills");
    if (existsSync(agentsSkills)) {
      for (const f of readdirSync(agentsSkills)) {
        if (f.startsWith("weave-")) removeIfExists(join(agentsSkills, f), `.agents/skills/${f}`);
      }
    }
    removeIfExists(join(projectDir, ".codex", "hooks"), ".codex/hooks/");

    // Shared files
    removeWeaveFromFile(join(projectDir, "CLAUDE.md"), "CLAUDE.md");
    removeWeaveFromFile(join(projectDir, "SOUL.md"), "SOUL.md");
    removeWeaveFromFile(join(projectDir, "STYLE.md"), "STYLE.md");
    removeWeaveFromFile(join(projectDir, "AGENTS.md"), "AGENTS.md");

    console.log();
  } else {
    console.log(`  ${pc.dim("Step 1: No Weave installation in current directory, skipped.")}`);
    console.log();
  }

  // Step 2: Remove npm package globally
  console.log(`  ${pc.bold("Step 2: Removing weave-ai npm package...")}`);
  try {
    execSync("npm uninstall -g weave-ai 2>/dev/null", { stdio: "pipe" });
    console.log(`  ${pc.red("✗")} weave-ai global package removed`);
  } catch {
    console.log(`  ${pc.dim("—")} weave-ai was not installed globally`);
  }

  // Step 3: Clear npx cache
  console.log();
  console.log(`  ${pc.bold("Step 3: Clearing npx cache...")}`);
  try {
    const cachePath = execSync("npm config get cache", { encoding: "utf-8" }).trim();
    const npxCache = join(cachePath, "_npx");
    if (existsSync(npxCache)) {
      let cleared = 0;
      for (const entry of readdirSync(npxCache)) {
        const pkgJson = join(npxCache, entry, "node_modules", "weave-ai", "package.json");
        if (existsSync(pkgJson)) {
          rmSync(join(npxCache, entry), { recursive: true });
          cleared++;
        }
      }
      if (cleared > 0) {
        console.log(`  ${pc.red("✗")} ${cleared} npx cache entries cleared`);
      } else {
        console.log(`  ${pc.dim("—")} No weave-ai entries in npx cache`);
      }
    }
  } catch {
    console.log(`  ${pc.dim("—")} Could not access npx cache`);
  }

  console.log();
  console.log(pc.dim("  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
  console.log();
  console.log(`  ${pc.green(pc.bold("Done."))} Weave has been completely purged from your system.`);
  console.log(`  ${pc.dim("To reinstall: npx weave-ai")}`);
  console.log();
  rl.close();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Main
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const installers: Record<string, (dir: string) => void> = {
  "claude-code": installClaudeCode,
  "openclaw": installOpenClaw,
  "cursor": installCursor,
  "codex": installCodex,
};

async function install(): Promise<void> {
  console.log(BANNER);

  const projectDir = process.cwd();

  console.log(pc.dim("  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));

  const platforms = detectPlatforms(projectDir);
  const detected = platforms.filter((p) => p.detected);

  if (detected.length > 0) {
    console.log(`  ${pc.bold("Detected AI tools:")}`);
    for (const p of detected) {
      console.log(`    ${pc.green("✓")} ${pc.bold(p.name)}`);
    }
  } else {
    console.log(`  ${pc.yellow("!")} No AI tools detected in this directory.`);
  }

  console.log();
  console.log(`  ${pc.bold("Available platforms:")}`);
  platforms.forEach((p, i) => {
    const marker = p.detected ? pc.green("●") : pc.dim("○");
    console.log(`    ${marker} ${pc.bold(`${i + 1}`)} ${p.name}`);
  });

  console.log();
  const answer = await ask(
    `  ${pc.bold("Install for which platforms?")} (comma-separated numbers, e.g. 1,3): `
  );

  const selected: Platform[] = [];
  for (const s of answer.split(",")) {
    const num = parseInt(s.trim(), 10);
    if (num >= 1 && num <= platforms.length) {
      selected.push(platforms[num - 1]!);
    }
  }

  if (selected.length === 0) {
    console.log(`\n  ${pc.red("✗")} No valid platform selected. Aborting.`);
    rl.close(); process.exit(1);
  }

  console.log();
  console.log(pc.dim("  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
  console.log();

  for (const platform of selected) {
    console.log(`  ${pc.bold("Installing for " + platform.name + "...")}`);
    installers[platform.id]!(projectDir);
    console.log();
  }

  installWeaveState(projectDir, selected);

  console.log();
  console.log(pc.dim("  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
  console.log();
  console.log(`  ${pc.green(pc.bold("Done!"))} Run ${pc.bold("/weave:onboarding")} to get started.`);
  console.log();
  rl.close();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CLI Router
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const command = process.argv[2];

if (command === "uninstall") {
  uninstall();
} else if (command === "purge") {
  purge();
} else {
  install();
}
