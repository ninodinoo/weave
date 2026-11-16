#!/usr/bin/env node
// Weave CLI. Zero dependencies; everything it does is local to the machine.
import { resolve } from "node:path";
import { c } from "../lib/util.mjs";

const HELP = `
${c.bold("weave")} — the self-tuning setup for Claude Code and Codex

  ${c.bold("weave init")} [--claude] [--codex]    install skills + hooks into this project
  ${c.bold("weave doctor")} [--json] [--ci]       lint AGENTS.md / CLAUDE.md, rules, skills, subagents
  ${c.bold("weave analyze")} [--json] [--days N]  mine your session transcripts for evidence
  ${c.bold("weave status")}                       what is installed and what is pending
  ${c.bold("weave uninstall")} [--purge]          remove skills, hooks and runtime

  Used by the skills:
  weave record --kind K --target FILE --summary TEXT [--evidence TEXT] [--watch a,b]
  weave mark-evolved
  weave hook <prompt|session-start> [--platform codex]

  Options: --dir PATH (project directory, default: current)
`;

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      args._.push(a);
      continue;
    }
    const eq = a.indexOf("=");
    if (eq > 0) args[a.slice(2, eq)] = a.slice(eq + 1);
    else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) args[a.slice(2)] = argv[++i];
    else args[a.slice(2)] = true;
  }
  return args;
}

const SEV = { error: c.red("error"), warn: c.yellow("warn ") };

function printDoctor(result) {
  const color = result.score >= 85 ? c.green : result.score >= 60 ? c.yellow : c.red;
  console.log(`\n  Setup health  ${color(c.bold(`${result.score}/100`))}`);
  const f = result.files;
  console.log(c.dim(`  ${f.instructions.join(", ") || "no instruction file"} · ${f.rules} rules · ${f.skills} skills · ${f.agents} subagents · ${(result.bytes / 1024).toFixed(1)} KiB always loaded\n`));
  if (!result.findings.length) {
    console.log(`  ${c.green("✓")} Nothing to fix.\n`);
    return;
  }
  for (const finding of result.findings) {
    const where = finding.file ? `${finding.file}${finding.line ? `:${finding.line}` : ""}` : "(project)";
    console.log(`  ${SEV[finding.severity]}  ${c.bold(where)}  ${c.dim(finding.rule)}`);
    console.log(`         ${finding.message}`);
  }
  const errors = result.findings.filter((x) => x.severity === "error").length;
  console.log(`\n  ${errors} error${errors === 1 ? "" : "s"}, ${result.findings.length - errors} warning${result.findings.length - errors === 1 ? "" : "s"}\n`);
}

function printReport(r) {
  const s = r.summary;
  console.log(`\n  ${c.bold("Evidence")} from ${s.sessions} session${s.sessions === 1 ? "" : "s"}${s.from ? ` (${s.from} → ${s.to})` : ""}${s.platforms.length ? ` on ${s.platforms.join(" + ")}` : ""}`);
  if (!s.sessions) {
    console.log(c.dim("  No transcripts found for this project yet. Work a few sessions, then run this again.\n"));
    return;
  }
  console.log(c.dim(`  ${s.userTurns} prompts · ${s.corrections} corrections · ${s.standingInstructions} standing instructions · ${s.interrupts} interrupts · ${s.avgToolCallsBeforeFirstEdit ?? "–"} tool calls before first edit\n`));
  const section = (title, rows) => {
    if (!rows.length) return;
    console.log(`  ${c.bold(title)}`);
    for (const row of rows) console.log(`    ${row}`);
    console.log("");
  };
  section("You said (candidates for rules)", r.feedback.slice(-8).map((f) => `${f.new ? c.cyan("new") : c.dim("old")} ${c.dim(f.date)} “${f.quote.slice(0, 110)}”`));
  section("Commands that keep failing", r.failingCommands.slice(0, 6).map((f) => `${c.red(f.command)} failed ${f.failures}× in ${f.sessions} sessions${f.usuallyFixedBy[0] ? ` → then ${c.green(f.usuallyFixedBy[0].command)} worked` : ""}`));
  section("Frequent commands missing from your instructions", r.frequentCommands.filter((f) => !f.documented).slice(0, 6).map((f) => `${f.command} ${c.dim(`(${f.sessions} sessions)`)}`));
  section("Files read in most sessions", r.hotFiles.slice(0, 6).map((f) => `${f.file} ${c.dim(`(${f.share}% of sessions)`)}`));
  section("Prompts you keep retyping (candidates for skills)", r.repeatedPrompts.slice(0, 5).map((p) => `${p.sessions} sessions: “${p.examples[0].slice(0, 100)}”`));
  section("Did earlier changes hold?", r.pastChanges.map((p) => `${p.verdict === "holding" ? c.green("holding  ") : p.verdict === "recurring" ? c.red("recurring") : c.dim("too early")} ${p.summary} ${c.dim(`(${p.before} before → ${p.after} after)`)}`));
  console.log(c.dim("  Run the weave-evolve skill to turn this into reviewed changes.\n"));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  const projectDir = resolve(typeof args.dir === "string" ? args.dir : process.cwd());

  if (command === "hook") {
    const { runHook } = await import("../lib/hook.mjs");
    const platform = args.platform === "codex" || process.env.PLUGIN_ROOT ? "codex" : "claude";
    await runHook(args._[1], platform);
    return;
  }

  if (!command || command === "help" || args.help) {
    console.log(HELP);
    return;
  }

  if (command === "init") {
    const { init } = await import("../lib/install.mjs");
    const platforms = ["claude", "codex"].filter((p) => args[p]);
    const result = init(projectDir, { platforms, plugin: Boolean(args.plugin) });
    if (args.plugin) return;
    console.log(`\n  ${c.green("✓")} Weave installed for ${c.bold(result.platforms.map((p) => (p === "claude" ? "Claude Code" : "Codex")).join(" and "))}`);
    if (result.legacy.length) console.log(c.dim(`  Removed ${result.legacy.length} file(s) from Weave 0.x.`));
    console.log(c.dim("  Skills, hooks and .weave/runtime are meant to be committed, so teammates get them too.\n"));
    console.log("  Next:");
    if (result.platforms.includes("claude")) console.log(`    Claude Code   ${c.cyan("/weave-onboard")}`);
    if (result.platforms.includes("codex")) console.log(`    Codex         ${c.cyan("$weave-onboard")}   ${c.dim("(approve Weave's two hooks once via /hooks)")}`);
    console.log("");
    return;
  }

  if (command === "uninstall") {
    const { uninstall } = await import("../lib/install.mjs");
    uninstall(projectDir, { purge: Boolean(args.purge) });
    console.log(`\n  ${c.green("✓")} Weave removed.${args.purge ? "" : c.dim(" Kept .weave/history.jsonl and config; use --purge to delete them.")}\n`);
    return;
  }

  if (command === "doctor") {
    const { runDoctor } = await import("../lib/doctor.mjs");
    const result = runDoctor(projectDir);
    if (args.json) console.log(JSON.stringify(result, null, 2));
    else printDoctor(result);
    const failing = result.findings.some((f) => f.severity === "error" || args.strict);
    if (failing && (args.strict || args.ci)) process.exitCode = 1;
    return;
  }

  if (command === "analyze") {
    const { buildReport } = await import("../lib/report.mjs");
    const report = buildReport(projectDir, {
      days: args.days ? Number(args.days) : undefined,
      all: Boolean(args.all),
      minSessions: args.min ? Number(args.min) : undefined,
    });
    if (args.json) console.log(JSON.stringify(report, null, 2));
    else printReport(report);
    return;
  }

  if (command === "record") {
    const { appendHistory } = await import("../lib/state.mjs");
    const kinds = ["rule", "scoped-rule", "skill", "hook", "subagent", "prune", "setup"];
    if (!kinds.includes(args.kind) || typeof args.summary !== "string") {
      console.error(`Usage: weave record --kind <${kinds.join("|")}> --target FILE --summary TEXT [--evidence TEXT] [--watch a,b]`);
      process.exitCode = 2;
      return;
    }
    appendHistory(projectDir, {
      ts: new Date().toISOString(),
      kind: args.kind,
      target: typeof args.target === "string" ? args.target : null,
      summary: args.summary,
      evidence: typeof args.evidence === "string" ? args.evidence : null,
      watch: typeof args.watch === "string" ? args.watch.split(",").map((w) => w.trim()).filter(Boolean) : [],
    });
    console.log("recorded");
    return;
  }

  if (command === "mark-evolved") {
    const { loadState, saveState } = await import("../lib/state.mjs");
    saveState(projectDir, { ...loadState(projectDir), lastEvolvedAt: new Date().toISOString(), sessionsSinceEvolve: 0 });
    console.log("marked");
    return;
  }

  if (command === "status") {
    const { installedSummary, VERSION } = await import("../lib/install.mjs");
    const { runDoctor } = await import("../lib/doctor.mjs");
    const { loadState, loadInbox, loadHistory } = await import("../lib/state.mjs");
    const info = installedSummary(projectDir);
    const state = loadState(projectDir);
    const doctor = runDoctor(projectDir);
    const mark = (ok) => (ok ? c.green("✓") : c.dim("–"));
    console.log(`\n  ${c.bold("Weave")} ${VERSION}${info.config ? "" : c.yellow("  (not initialised here — run `weave init`)")}`);
    console.log(`  Claude Code   skills ${mark(info.claude.skills)}  hooks ${mark(info.claude.hooks)}`);
    console.log(`  Codex         skills ${mark(info.codex.skills)}  hooks ${mark(info.codex.hooks)}`);
    console.log(`  Setup health  ${doctor.score}/100 ${c.dim(`(${doctor.findings.length} findings)`)}`);
    const pending = loadInbox(projectDir).filter((i) => !state.lastEvolvedAt || (i.ts ?? "") > state.lastEvolvedAt).length;
    console.log(`  Last tuned    ${state.lastEvolvedAt ? state.lastEvolvedAt.slice(0, 10) : "never"} ${c.dim(`· ${state.sessionsSinceEvolve} sessions and ${pending} captured instructions since`)}`);
    console.log(`  History       ${loadHistory(projectDir).length} recorded changes\n`);
    return;
  }

  console.error(`Unknown command "${command}".`);
  console.log(HELP);
  process.exitCode = 2;
}

main().catch((error) => {
  // Hooks must stay silent; everything else should say what went wrong.
  if (process.argv[2] === "hook") return;
  console.error(c.red(`weave: ${error.message}`));
  process.exitCode = 1;
});
