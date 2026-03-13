#!/usr/bin/env node

import pc from "picocolors";
import { existsSync, mkdirSync, cpSync, readdirSync } from "fs";
import { resolve, join, dirname } from "path";
import { fileURLToPath } from "url";

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
  name: string;
  configDir: string;
  commandsDir: string;
  agentsDir?: string;
  hooksDir?: string;
  detected: boolean;
}

function detectPlatforms(projectDir: string): Platform[] {
  return [
    {
      name: "Claude Code",
      configDir: ".claude",
      commandsDir: ".claude/commands",
      agentsDir: ".claude/agents",
      hooksDir: ".claude/hooks",
      detected: existsSync(join(projectDir, ".claude")),
    },
    {
      name: "Cursor",
      configDir: ".cursor",
      commandsDir: ".cursor/commands",
      detected: existsSync(join(projectDir, ".cursor")),
    },
    {
      name: "Codex",
      configDir: ".codex",
      commandsDir: ".codex",
      detected: existsSync(join(projectDir, ".codex")),
    },
    {
      name: "Windsurf",
      configDir: ".windsurf",
      commandsDir: ".windsurf",
      detected: existsSync(join(projectDir, ".windsurf")),
    },
  ];
}

function copyDir(src: string, dest: string, prefix: string): number {
  if (!existsSync(src)) return 0;
  mkdirSync(dest, { recursive: true });
  let count = 0;
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.isDirectory() ? entry.name : `${prefix}${entry.name}`);
    if (entry.isDirectory()) {
      count += copyDir(srcPath, destPath, prefix);
    } else {
      cpSync(srcPath, destPath);
      count++;
    }
  }
  return count;
}

function installForClaudeCode(projectDir: string): void {
  const claudeDir = join(projectDir, ".claude");
  mkdirSync(join(claudeDir, "commands"), { recursive: true });
  mkdirSync(join(claudeDir, "agents"), { recursive: true });

  // Commands → .claude/commands/weave:*.md
  const cmdCount = copyDir(
    join(packageRoot, "commands"),
    join(claudeDir, "commands"),
    "weave:"
  );
  console.log(`  ${pc.green("✓")} ${cmdCount} commands installed`);

  // Agents → .claude/agents/
  const agentCount = copyDir(
    join(packageRoot, "agents"),
    join(claudeDir, "agents"),
    "weave-"
  );
  console.log(`  ${pc.green("✓")} ${agentCount} agents installed`);

  // Master-Instructions → .claude/commands/ (als Referenz für Commands)
  const instrCount = copyDir(
    join(packageRoot, "master-instructions"),
    join(claudeDir, "commands", "weave-instructions"),
    ""
  );
  console.log(`  ${pc.green("✓")} ${instrCount} master-instructions installed`);
}

function installWeaveState(projectDir: string): void {
  const weaveDir = join(projectDir, ".weave");
  const dirs = ["agents", "skills", "teams", "rules", "history"];
  for (const dir of dirs) {
    mkdirSync(join(weaveDir, dir), { recursive: true });
  }
  console.log(`  ${pc.green("✓")} .weave/ state directory created`);
}

function main(): void {
  console.log(BANNER);

  const projectDir = process.cwd();

  console.log(pc.dim("  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));

  // Detect platforms
  const platforms = detectPlatforms(projectDir);
  const detected = platforms.filter((p) => p.detected);

  if (detected.length === 0) {
    // Default to Claude Code if nothing detected
    console.log(`  ${pc.yellow("?")} No AI tool detected, defaulting to Claude Code`);
    mkdirSync(join(projectDir, ".claude"), { recursive: true });
    detected.push(platforms[0]!);
  }

  for (const platform of detected) {
    console.log(`  ${pc.green("✓")} Detected: ${pc.bold(platform.name)}`);
  }

  console.log(pc.dim("  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
  console.log();

  // Install for each detected platform
  for (const platform of detected) {
    console.log(`  ${pc.bold("Installing for " + platform.name + "...")}`);

    if (platform.name === "Claude Code") {
      installForClaudeCode(projectDir);
    }
    // TODO: Other platform installers

    console.log();
  }

  // Create .weave/ state directory
  installWeaveState(projectDir);

  console.log();
  console.log(pc.dim("  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
  console.log();
  console.log(`  ${pc.green(pc.bold("Done!"))} Run ${pc.bold("/weave:onboarding")} to get started.`);
  console.log();
}

main();
