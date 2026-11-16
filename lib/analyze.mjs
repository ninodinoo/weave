// Turns normalized sessions into evidence: the raw material /weave-evolve reasons over.
// Everything here is deterministic and local. No model calls, no network.
import { relative, isAbsolute } from "node:path";
import { truncate } from "./util.mjs";

// ---------------------------------------------------------------------------
// User feedback: standing instructions and corrections
// ---------------------------------------------------------------------------

// A standing instruction is the user stating a rule that should outlive the session.
const STANDING = [
  /\b(from now on|going forward|in (the )?future|next time|remember (that|to)|keep in mind|as a rule)\b/i,
  /\b(don't|do not|stop) ever\b/i,
  /\b(ab sofort|von jetzt an|in zukunft|künftig|zukünftig|nächstes mal|merk dir|grundsätzlich)\b/i,
  /\b(nie wieder|nie mehr)\b/i,
];
// "always" and "never" are only a signal in a short message; in a long task
// description they usually describe the code ("this should never return null").
const STANDING_SHORT = [/\b(always|never)\b(?! mind)/i, /\b(immer|niemals)\b/i];
const SHORT = 300;

// A correction is the user pushing back on what the agent just did.
const CORRECTION = [
  /^(no|nope|nah|wrong|stop|wait|hold on|hey)\b/i,
  /^(nein|ne|nee|falsch|stopp?|halt|warte|moment)\b/i,
  /\b(that'?s|this is|that is) (wrong|not (what|right|correct))\b/i,
  /\b(i (told|asked) you|i said|as i said|i already|not what i (asked|meant|wanted))\b/i,
  /\b(why (did|are|do) you|you (shouldn'?t|should not|weren'?t supposed|forgot|missed|broke|ignored))\b/i,
  /\b(don'?t|do not|stop) (do|use|add|change|touch|create|write|run|make|remove|delete|edit|commit|push)/i,
  /\b(revert|undo|roll ?back) (that|this|it|the|your)\b/i,
  /\b(instead of|rather than)\b/i,
  /\b(das ist|das war) (falsch|nicht (richtig|korrekt|das))\b/i,
  /\b(ich habe? (dir )?(doch )?gesagt|wie gesagt|hab ich doch|nicht (das,? )?was ich)\b/i,
  /\b(warum hast du|wieso hast du|du (sollst|solltest) (nicht|kein)|du hast .{0,40}(vergessen|ignoriert|kaputt))\b/i,
  /\b(mach das rückgängig|rückgängig machen|nicht so|stattdessen|lass das|hör auf)\b/i,
];

const sentences = (text) => text.split(/(?<=[.!?\n])\s+/).map((part) => part.trim()).filter(Boolean);

/**
 * @returns {{ kind: "standing" | "correction", quote: string } | null}
 * The quote is the sentence that carries the signal, not the whole message.
 */
export function detectFeedback(text) {
  const trimmed = text.trim();
  const standing = trimmed.length <= SHORT ? [...STANDING, ...STANDING_SHORT] : STANDING;
  const parts = sentences(trimmed.slice(0, 2000));
  for (const part of parts) {
    if (standing.some((re) => re.test(part))) return { kind: "standing", quote: truncate(part, 320) };
  }
  // Pushback comes first; a correction buried deep in a long message is not one.
  const head = trimmed.slice(0, 400);
  if (CORRECTION.some((re) => re.test(head))) return { kind: "correction", quote: truncate(head, 320) };
  return null;
}

export function classifyFeedback(text) {
  return detectFeedback(text)?.kind ?? null;
}

// ---------------------------------------------------------------------------
// Shell command normalization
// ---------------------------------------------------------------------------

// Commands that say nothing about the project's workflow.
const TRIVIAL = new Set([
  "ls", "cat", "cd", "echo", "grep", "rg", "find", "head", "tail", "sed", "awk", "pwd", "wc",
  "mkdir", "rm", "cp", "mv", "touch", "which", "true", "false", "test", "sort", "uniq", "xargs",
  "tr", "cut", "tee", "sleep", "export", "set", "source", "printf", "date", "env", "tree", "stat",
  "file", "diff", "chmod", "kill", "ps", "curl", "wget", "jq", "git", "gh", "node", "python",
  "python3", "bash", "sh", "zsh", "timeout", "time", "nl", "du", "df", "basename", "dirname",
  "readlink", "realpath", "open", "less", "more", "clear", "exit", "[", "[[", "if", "for", "while",
  "do", "done", "then", "fi", "else",
]);

// Tools whose first argument is the actual verb (`npm test`, `cargo build`).
const MULTIPLEXERS = new Set([
  "npm", "pnpm", "yarn", "bun", "npx", "bunx", "deno", "cargo", "go", "make", "just", "task",
  "docker", "podman", "kubectl", "uv", "poetry", "pip", "pip3", "pipenv", "hatch", "tox", "nox",
  "dotnet", "gradle", "./gradlew", "mvn", "./mvnw", "bundle", "rake", "rails", "mix", "composer",
  "php", "turbo", "nx", "swift", "flutter", "dart", "terraform", "helm", "bazel", "cmake",
]);
const SUBVERBS = new Set(["run", "exec", "compose", "-m", "dlx", "x", "tool", "workspace", "-w", "--filter", "-C"]);

/** Drop heredoc bodies and quoted strings: inline scripts are data, not commands. */
function stripQuoted(line) {
  return String(line)
    .replace(/<<-?\s*(['"]?)(\w+)\1[\s\S]*?\n\s*\2(?=\n|$)/g, " ")
    .replace(/'[^']*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""');
}

/** Split a shell line on && || ; and newlines; for pipelines keep only the first stage. */
export function splitCommands(line) {
  return stripQuoted(line)
    .split(/&&|\|\||;|\n/)
    .map((part) => part.split("|")[0].trim())
    .filter(Boolean);
}

/** `FOO=1 npm run test:unit -- --watch` -> `npm run test:unit`. Returns null for trivial commands. */
export function commandKey(segment) {
  const tokens = segment.split(/\s+/).filter(Boolean);
  while (tokens.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0]) || tokens[0] === "sudo" || tokens[0] === "(")) {
    tokens.shift();
  }
  if (!tokens.length) return null;
  const head = tokens[0].replace(/^\(+/, "");
  if (!head || TRIVIAL.has(head) || !/^[A-Za-z./]/.test(head)) return null;
  if (!MULTIPLEXERS.has(head)) {
    // A project script (./scripts/deploy.sh, bin/setup) or a direct tool (pytest, eslint, tsc).
    // Either a path (./scripts/deploy.sh, bin/setup) or a plain tool name (pytest, tsc).
    return /^(\.{0,2}\/)?[\w@+-]+(\/[\w.@+-]+)*$/.test(head) && /[a-z]/i.test(head) ? head : null;
  }
  const key = [head];
  let i = 1;
  while (i < tokens.length && key.length < 3) {
    const tok = tokens[i];
    if (tok === "--") break;
    if (tok.startsWith("-") && !SUBVERBS.has(tok)) {
      i++;
      continue;
    }
    if (!/^[\w./@:+-]+$/.test(tok)) break;
    key.push(tok);
    if (!SUBVERBS.has(tok)) break;
    i++;
  }
  return key.length > 1 ? key.join(" ") : null;
}

// ---------------------------------------------------------------------------
// Repeated prompts
// ---------------------------------------------------------------------------

const STOPWORDS = new Set(
  ("the and for that this with you please can could would should have has are was were from into about " +
    "what when where which will just also then than them they their there here some any all not but " +
    "und der die das den dem ein eine einen einem mit für auf ist sind war bitte kannst kann mal noch " +
    "ich du wir mir dir mich dich nicht auch dann wenn oder aber dass wie was von zum zur aus bei nach")
    .split(" "),
);

function tokenSet(text) {
  const words = text.toLowerCase().match(/[a-zäöüß][a-zäöüß0-9_-]{2,}/g) ?? [];
  return new Set(words.filter((w) => !STOPWORDS.has(w)));
}

function jaccard(a, b) {
  let shared = 0;
  for (const x of a) if (b.has(x)) shared++;
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : shared / union;
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

const READ_TOOLS = new Set(["Read", "NotebookRead"]);
const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit", "apply_patch"]);

function isoWeek(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "unknown";
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((day - yearStart) / 86400000 + 1) / 7);
  return `${day.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function errorExcerpt(output) {
  const lines = String(output).split("\n").map((l) => l.trim()).filter(Boolean);
  const hit = lines.find((l) => /error|not found|failed|cannot|no such|denied|missing|unknown|invalid/i.test(l));
  return truncate(hit ?? lines[lines.length - 1] ?? "", 200);
}

/**
 * @param {Array} sessions normalized sessions (see sessions/index.mjs)
 * @param {object} opts { projectDir, instructionsText, minSessions }
 */
export function analyze(sessions, opts = {}) {
  const projectDir = opts.projectDir ?? process.cwd();
  const documented = (opts.instructionsText ?? "").toLowerCase();
  const minSessions = opts.minSessions ?? 3;

  const feedback = [];
  const failures = []; // every failed command, dated, for before/after comparisons
  const commands = new Map(); // key -> { sessions:Set, runs, failures, failSessions:Set, errors:[], fixes:Map }
  const fileReads = new Map(); // relative path -> Set(session id)
  const prompts = []; // { session, date, text, tokens }
  const weeks = new Map();
  let totalTurns = 0;
  let totalInterrupts = 0;
  let orientationSum = 0;
  let orientationCount = 0;

  const commandStat = (key) => {
    if (!commands.has(key)) {
      commands.set(key, { sessions: new Set(), runs: 0, failures: 0, failSessions: new Set(), errors: [], fixes: new Map() });
    }
    return commands.get(key);
  };

  for (const session of sessions) {
    const date = (session.startedAt ?? "").slice(0, 10);
    const week = isoWeek(session.startedAt);
    if (!weeks.has(week)) weeks.set(week, { week, sessions: 0, userTurns: 0, feedback: 0, interrupts: 0, failedCommands: 0 });
    const w = weeks.get(week);
    w.sessions++;

    let sawAgentWork = false;
    let toolsBeforeFirstEdit = 0;
    let firstEditSeen = false;
    let lastFailure = null; // { key, age } — a failed command waiting for the command that fixed it

    for (const event of session.events) {
      if (event.kind === "interrupt") {
        totalInterrupts++;
        w.interrupts++;
        continue;
      }

      if (event.kind === "user") {
        totalTurns++;
        w.userTurns++;
        const found = detectFeedback(event.text);
        const kind = found?.kind;
        // A correction needs something to correct; a standing instruction counts anywhere.
        if (kind === "standing" || (kind === "correction" && sawAgentWork)) {
          feedback.push({ kind, session: session.id, platform: session.platform, date, ts: event.ts ?? session.startedAt, quote: found.quote });
          w.feedback++;
        } else if (event.text.length >= 20 && event.text.length <= 600) {
          prompts.push({ session: session.id, date, text: truncate(event.text, 200), tokens: tokenSet(event.text) });
        }
        continue;
      }

      if (event.kind !== "tool") continue;
      sawAgentWork = true;
      if (!firstEditSeen && !event.synthetic) {
        if (EDIT_TOOLS.has(event.name)) {
          firstEditSeen = true;
          orientationSum += toolsBeforeFirstEdit;
          orientationCount++;
        } else {
          toolsBeforeFirstEdit++;
        }
      }

      if (READ_TOOLS.has(event.name)) {
        const path = event.input?.file_path ?? event.input?.path;
        if (typeof path === "string") {
          const rel = (isAbsolute(path) ? relative(projectDir, path) : path).replaceAll("\\", "/");
          if (rel && !rel.startsWith("..")) {
            if (!fileReads.has(rel)) fileReads.set(rel, new Set());
            fileReads.get(rel).add(session.id);
          }
        }
        continue;
      }

      if (event.name !== "Bash") continue;
      const keys = [...new Set(splitCommands(event.input?.command ?? "").map(commandKey).filter(Boolean))];
      if (lastFailure) lastFailure.age++;
      for (const key of keys) {
        const stat = commandStat(key);
        stat.sessions.add(session.id);
        stat.runs++;
        if (!event.ok) {
          failures.push({ ts: event.ts ?? session.startedAt, command: key });
          stat.failures++;
          stat.failSessions.add(session.id);
          if (stat.errors.length < 3) stat.errors.push(errorExcerpt(event.output));
        }
      }
      if (!event.ok && keys.length) {
        w.failedCommands++;
        lastFailure = { key: keys[0], age: 0 };
      } else if (event.ok && keys.length && lastFailure && lastFailure.age <= 3 && !keys.includes(lastFailure.key)) {
        const fixes = commandStat(lastFailure.key).fixes;
        fixes.set(keys[0], (fixes.get(keys[0]) ?? 0) + 1);
        lastFailure = null;
      } else if (lastFailure && lastFailure.age > 3) {
        lastFailure = null;
      }
    }
  }

  const isDocumented = (key) => documented.includes(key.toLowerCase());

  const frequentCommands = [...commands.entries()]
    .filter(([, s]) => s.sessions.size >= minSessions)
    .map(([command, s]) => ({ command, sessions: s.sessions.size, runs: s.runs, documented: isDocumented(command) }))
    .sort((a, b) => b.sessions - a.sessions || b.runs - a.runs)
    .slice(0, 20);

  const failingCommands = [...commands.entries()]
    .filter(([, s]) => s.failSessions.size >= 2 || s.failures >= 3)
    .map(([command, s]) => ({
      command,
      failures: s.failures,
      runs: s.runs,
      sessions: s.failSessions.size,
      errors: [...new Set(s.errors)],
      usuallyFixedBy: [...s.fixes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([cmd, count]) => ({ command: cmd, count })),
      documented: isDocumented(command),
    }))
    .sort((a, b) => b.sessions - a.sessions || b.failures - a.failures)
    .slice(0, 15);

  const sessionCount = sessions.length;
  const hotFiles = [...fileReads.entries()]
    .filter(([, set]) => set.size >= minSessions && set.size / sessionCount >= 0.4)
    .map(([file, set]) => ({ file, sessions: set.size, share: Math.round((set.size / sessionCount) * 100), documented: documented.includes(file.toLowerCase()) }))
    .filter((f) => !/(^|\/)(CLAUDE|AGENTS)(\.local|\.override)?\.md$/i.test(f.file))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 15);

  // Greedy clustering of similar prompts; only clusters spanning several sessions matter.
  const clusters = [];
  for (const prompt of prompts) {
    if (prompt.tokens.size < 3) continue;
    const home = clusters.find((cl) => jaccard(cl.tokens, prompt.tokens) >= 0.5);
    if (home) {
      home.items.push(prompt);
      home.sessions.add(prompt.session);
    } else {
      clusters.push({ tokens: prompt.tokens, items: [prompt], sessions: new Set([prompt.session]) });
    }
  }
  const repeatedPrompts = clusters
    .filter((cl) => cl.sessions.size >= minSessions)
    .map((cl) => ({ sessions: cl.sessions.size, count: cl.items.length, examples: cl.items.slice(0, 3).map((p) => p.text) }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 10);

  const dates = sessions.map((s) => s.startedAt).filter(Boolean).sort();
  return {
    summary: {
      sessions: sessionCount,
      platforms: [...new Set(sessions.map((s) => s.platform))],
      from: dates[0]?.slice(0, 10) ?? null,
      to: dates[dates.length - 1]?.slice(0, 10) ?? null,
      userTurns: totalTurns,
      standingInstructions: feedback.filter((f) => f.kind === "standing").length,
      corrections: feedback.filter((f) => f.kind === "correction").length,
      interrupts: totalInterrupts,
      // How many tool calls the agent needs, on average, before it starts editing.
      avgToolCallsBeforeFirstEdit: orientationCount ? Math.round((orientationSum / orientationCount) * 10) / 10 : null,
    },
    feedback: feedback.slice(-60),
    failingCommands,
    frequentCommands,
    hotFiles,
    repeatedPrompts,
    trend: [...weeks.values()].sort((a, b) => a.week.localeCompare(b.week)),
    // Untruncated event lists for report.mjs; removed before anything is printed.
    _raw: { feedback, failures, sessionStarts: sessions.map((s) => s.startedAt) },
  };
}
