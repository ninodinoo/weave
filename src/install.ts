#!/usr/bin/env node

import pc from "picocolors";
import { existsSync, mkdirSync, cpSync, readdirSync, writeFileSync, readFileSync } from "fs";
import { resolve, join, dirname } from "path";
import { fileURLToPath } from "url";
import { createInterface } from "readline";

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
  configDir: string;
  support: "full" | "skills" | "rules-only";
  detected: boolean;
}

function detectPlatforms(projectDir: string): Platform[] {
  return [
    {
      id: "claude-code",
      name: "Claude Code",
      configDir: ".claude",
      support: "full",
      detected: existsSync(join(projectDir, ".claude")),
    },
    {
      id: "openclaw",
      name: "OpenClaw",
      configDir: "skills",
      support: "skills",
      detected: existsSync(join(projectDir, "skills")) || existsSync(join(projectDir, ".openclaw")),
    },
    {
      id: "cursor",
      name: "Cursor",
      configDir: ".cursor",
      support: "rules-only",
      detected: existsSync(join(projectDir, ".cursor")),
    },
    {
      id: "codex",
      name: "Codex",
      configDir: ".codex",
      support: "rules-only",
      detected: existsSync(join(projectDir, ".codex")),
    },
    {
      id: "windsurf",
      name: "Windsurf",
      configDir: ".windsurf",
      support: "rules-only",
      detected: existsSync(join(projectDir, ".windsurf")),
    },
  ];
}

function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
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

function installFull(projectDir: string): void {
  const claudeDir = join(projectDir, ".claude");
  mkdirSync(join(claudeDir, "commands"), { recursive: true });
  mkdirSync(join(claudeDir, "agents"), { recursive: true });

  const cmdCount = copyDir(
    join(packageRoot, "commands"),
    join(claudeDir, "commands"),
    "weave:"
  );
  console.log(`  ${pc.green("✓")} ${cmdCount} commands installed`);

  const agentCount = copyDir(
    join(packageRoot, "agents"),
    join(claudeDir, "agents"),
    "weave-"
  );
  console.log(`  ${pc.green("✓")} ${agentCount} agents installed`);

  const instrCount = copyDir(
    join(packageRoot, "master-instructions"),
    join(claudeDir, "commands", "weave-instructions"),
    ""
  );
  console.log(`  ${pc.green("✓")} ${instrCount} master-instructions installed`);

  const hookCount = copyDir(
    join(packageRoot, "hooks"),
    join(claudeDir, "hooks"),
    ""
  );
  console.log(`  ${pc.green("✓")} ${hookCount} hooks installed`);
}

function installForOpenClaw(projectDir: string): void {
  const skillDir = join(projectDir, "skills", "weave");
  mkdirSync(skillDir, { recursive: true });

  // Main SKILL.md — combines master instructions + agent definitions
  const skillMdParts: string[] = [
    "---",
    "name: weave",
    "description: AI workflow framework — personalized agents, teams, and rules",
    "version: 1.0.0",
    "---",
    "",
    "# Weave — AI Workflow Framework",
    "",
    "You have access to the Weave workflow system. Weave personalizes your AI workflow",
    "based on who you are, what you're building, and how you work.",
    "",
    "## Available Commands",
    "- `weave:onboarding` — Start the onboarding conversation",
    "- `weave:evolve` — Optimize your workflow",
    "- `weave:status` — Show current setup",
    "- `weave:add-agent` — Add a new agent",
    "- `weave:add-skill` — Create a new skill",
    "- `weave:add-team` — Define a new agent team",
    "",
    "## State",
    "Weave stores its state in `.weave/` in the project root.",
    "Read `.weave/config.json` for user and project context.",
    "",
  ];

  // Read and append master instructions
  const instrDir = join(packageRoot, "master-instructions");
  if (existsSync(instrDir)) {
    for (const file of readdirSync(instrDir)) {
      if (file.endsWith(".md")) {
        const content = readFileSync(join(instrDir, file), "utf-8");
        skillMdParts.push(content);
        skillMdParts.push("");
      }
    }
  }

  try {
    writeFileSync(join(skillDir, "SKILL.md"), skillMdParts.join("\n"));
    console.log(`  ${pc.green("✓")} skills/weave/SKILL.md created`);
  } catch (err: any) {
    console.error(`  ${pc.red("✗")} Failed to create SKILL.md: ${err.message}`);
  }

  // Create sub-skills for each command
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
}

function installRulesOnly(projectDir: string, platform: Platform): void {
  const rulesMap: Record<string, string> = {
    cursor: ".cursorrules",
    codex: "codex.md",
    windsurf: ".windsurfrules",
  };

  const rulesFile = rulesMap[platform.id];
  if (rulesFile) {
    const rulesPath = join(projectDir, rulesFile);
    if (!existsSync(rulesPath)) {
      try {
        writeFileSync(
          rulesPath,
          `<!-- Generated by Weave 🧶 — Run /weave:onboarding to populate -->\n`
        );
        console.log(`  ${pc.green("✓")} ${rulesFile} created`);
      } catch (err: any) {
        console.error(`  ${pc.red("✗")} Failed to create ${rulesFile}: ${err.message}`);
      }
    } else {
      console.log(`  ${pc.dim("—")} ${rulesFile} already exists, skipped`);
    }
  }

  console.log(`  ${pc.dim("ℹ")} ${platform.name} supports rules only — agents, commands & hooks require Claude Code or OpenClaw`);
}

function installWeaveState(projectDir: string, selectedPlatforms: Platform[]): void {
  const weaveDir = join(projectDir, ".weave");
  const dirs = ["agents", "skills", "teams", "rules", "history"];
  for (const dir of dirs) {
    mkdirSync(join(weaveDir, dir), { recursive: true });
  }

  const platformIds = selectedPlatforms.map((p) => p.id);

  const configPath = join(weaveDir, "config.json");
  if (!existsSync(configPath)) {
    const initialConfig = {
      version: "1.0",
      user: {
        role: "",
        experience: "",
        stack: [],
        preferences: {
          language: "",
          responseStyle: "balanced",
          planFirst: true,
        },
      },
      project: {
        name: "",
        description: "",
        vision: "",
        type: "",
        stack: [],
        features: [],
        team: [],
        milestones: [],
      },
      platforms: platformIds,
      generatedAt: "",
      lastEvolved: "",
    };
    try {
      writeFileSync(configPath, JSON.stringify(initialConfig, null, 2));
    } catch (err: any) {
      console.error(`  ${pc.red("✗")} Failed to create config.json: ${err.message}`);
    }
  }

  const platformsPath = join(weaveDir, "platforms.json");
  if (!existsSync(platformsPath)) {
    try {
      writeFileSync(
        platformsPath,
        JSON.stringify({ active: platformIds, lastSync: "" }, null, 2)
      );
    } catch (err: any) {
      console.error(`  ${pc.red("✗")} Failed to create platforms.json: ${err.message}`);
    }
  }

  console.log(`  ${pc.green("✓")} .weave/ state directory created`);
}

async function main(): Promise<void> {
  console.log(BANNER);

  const projectDir = process.cwd();

  console.log(pc.dim("  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));

  // Detect platforms
  const platforms = detectPlatforms(projectDir);
  const detected = platforms.filter((p) => p.detected);

  // Show detection results
  if (detected.length > 0) {
    console.log(`  ${pc.bold("Detected AI tools:")}`);
    for (const p of detected) {
      const supportLabel = p.support === "full" ? "full support" : p.support === "skills" ? "skills" : "rules only";
      const support = p.support === "rules-only" ? pc.yellow(supportLabel) : pc.green(supportLabel);
      console.log(`    ${pc.green("✓")} ${pc.bold(p.name)} (${support})`);
    }
  } else {
    console.log(`  ${pc.yellow("!")} No AI tools detected in this directory.`);
  }

  console.log();
  console.log(`  ${pc.bold("Available platforms:")}`);
  platforms.forEach((p, i) => {
    const marker = p.detected ? pc.green("●") : pc.dim("○");
    const supportTag = p.support === "full" ? "full" : p.support === "skills" ? "skills" : "rules";
    const support = p.support === "rules-only" ? pc.yellow(supportTag) : pc.green(supportTag);
    console.log(`    ${marker} ${pc.bold(`${i + 1}`)} ${p.name} [${support}]`);
  });

  console.log();
  const answer = await ask(
    `  ${pc.bold("Install for which platforms?")} (comma-separated numbers, e.g. 1,3): `
  );

  // Parse selection
  const selected: Platform[] = [];
  const nums = answer.split(",").map((s) => parseInt(s.trim(), 10));
  for (const num of nums) {
    if (num >= 1 && num <= platforms.length) {
      selected.push(platforms[num - 1]!);
    }
  }

  if (selected.length === 0) {
    console.log(`\n  ${pc.red("✗")} No valid platform selected. Aborting.`);
    process.exit(1);
  }

  console.log();
  console.log(pc.dim("  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
  console.log();

  // Install for each selected platform
  const hasFullPlatform = selected.some((p) => p.support === "full" || p.id === "openclaw");

  for (const platform of selected) {
    console.log(`  ${pc.bold("Installing for " + platform.name + "...")}`);

    if (platform.support === "full") {
      installFull(projectDir);
    } else if (platform.id === "openclaw") {
      installForOpenClaw(projectDir);
    } else {
      installRulesOnly(projectDir, platform);
    }

    console.log();
  }

  // If only rules-only platforms selected, inform about limitations
  if (!hasFullPlatform) {
    console.log(
      `  ${pc.yellow("ℹ")} For the full Weave experience (agents, teams, commands, hooks),`
    );
    console.log(`    also install for ${pc.bold("Claude Code")} or ${pc.bold("Claw")}.`);
    console.log();
  }

  // Create .weave/ state directory
  installWeaveState(projectDir, selected);

  console.log();
  console.log(pc.dim("  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
  console.log();

  if (hasFullPlatform) {
    console.log(`  ${pc.green(pc.bold("Done!"))} Run ${pc.bold("/weave:onboarding")} to get started.`);
  } else {
    console.log(`  ${pc.green(pc.bold("Done!"))} Run ${pc.bold("/weave:onboarding")} in Claude Code or OpenClaw to get started.`);
  }
  console.log();
}

main();
