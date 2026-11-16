// Lints an agent setup (instruction files, rules, skills, subagents) against
// evidence-based practice. Deterministic: same repo in, same findings out.
import { readdirSync, statSync, realpathSync } from "node:fs";
import { join, relative, dirname, basename } from "node:path";
import { readText, readJson, exists } from "./util.mjs";

export const BUDGET = {
  warnLines: 150, // Anthropic: "target under 200 lines"; adherence drops as files grow.
  errorLines: 300,
  codexMaxBytes: 32 * 1024, // Codex truncates the combined project docs silently at 32 KiB.
  skillBodyLines: 500,
  descriptionMax: 1024,
  descriptionMin: 30,
  emphasisMax: 5,
};

const VAGUE = [
  /\b(write|produce|keep|ensure) (clean|good|high[- ]quality|readable|maintainable|elegant|robust) code\b/i,
  /\bfollow (industry |coding |the )?best practices\b/i,
  /\bbe (careful|thorough|concise|helpful|smart|professional)\b/i,
  /\b(use|choose) (meaningful|descriptive|good|clear) (variable |function )?names\b/i,
  /\bwrite (good|proper|comprehensive|meaningful) (tests|comments|documentation)\b/i,
  /\byou are an? (expert|senior|world[- ]class|experienced)\b/i,
  /\bthink step[- ]by[- ]step\b/i,
  /\bdon'?t (make mistakes|introduce bugs|hallucinate)\b/i,
  /\b(sauberen|guten|lesbaren|wartbaren) code\b/i,
];

const STYLE = /\b(indent(ation)?|tabs? (vs|or|instead)|\d spaces|semicolons?|single quotes|double quotes|trailing commas?|line length|max[- ]line|einrückung|semikolon)\b/i;
const FORMATTER_CONFIGS = [
  ".prettierrc", ".prettierrc.json", ".prettierrc.js", ".prettierrc.cjs", ".prettierrc.yml", ".prettierrc.yaml",
  "prettier.config.js", "prettier.config.mjs", "biome.json", "biome.jsonc", ".eslintrc", ".eslintrc.js",
  ".eslintrc.cjs", ".eslintrc.json", "eslint.config.js", "eslint.config.mjs", "eslint.config.ts",
  ".editorconfig", "rustfmt.toml", ".rustfmt.toml", "ruff.toml", ".ruff.toml", ".clang-format", ".golangci.yml",
];

const SECRET = [
  /\b(sk|pk|rk)[-_](live|test|proj|ant)[-_][A-Za-z0-9_-]{16,}/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];

// `npm run <script>`: the name cannot be a flag, and a file argument (`bun run src/a.ts`) is not a script.
const SCRIPT_RUNNERS = /\b(npm|pnpm|yarn|bun) run ([A-Za-z0-9_][\w:.-]*)(\/)?/g;
const SCRIPT_FILE = /\.(m?[jt]sx?|cjs|sh|py)$/;

// Extensions that make a bare `name.ext` in backticks a file reference rather than code.
const FILE_EXT = new Set(("md mdx json jsonc ts tsx js jsx mjs cjs py rs go toml yaml yml sh sql css scss html txt lock rb java kt " +
  "swift c h cpp cs php vue svelte xml ini cfg conf proto graphql prisma tf gradle").split(" "));
const NOT_A_FILE = /^(node|next|vue|nuxt|react|express|three|d3|chart|alpine|ember|backbone|socket|moment|day|deno|bun|console|process|math|json|window|document|module|exports|os|path|fs)\./i;

function parseFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!match) return { data: null, body: text };
  const data = {};
  let key = null;
  for (const line of match[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (kv) {
      key = kv[1];
      data[key] = kv[2].replace(/^["']|["']$/g, "").replace(/^[>|][+-]?$/, "");
    } else if (key && /^\s+\S/.test(line)) {
      data[key] = (data[key] ? data[key] + " " : "") + line.trim();
    }
  }
  return { data, body: text.slice(match[0].length) };
}

function listDir(dir) {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

function walk(dir, predicate, out = [], depth = 0) {
  if (depth > 4) return out;
  for (const name of listDir(dir)) {
    const full = join(dir, name);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) walk(full, predicate, out, depth + 1);
    else if (predicate(full)) out.push(full);
  }
  return out;
}

/** Everything that gets loaded into an agent's context for this repo. */
export function discover(projectDir) {
  const at = (...p) => join(projectDir, ...p);
  const instructions = ["AGENTS.md", "CLAUDE.md", ".claude/CLAUDE.md", "AGENTS.override.md"].map((p) => at(p)).filter(exists);
  const rules = walk(at(".claude", "rules"), (f) => f.endsWith(".md"));
  const skills = [
    ...walk(at(".claude", "skills"), (f) => basename(f) === "SKILL.md"),
    ...walk(at(".agents", "skills"), (f) => basename(f) === "SKILL.md"),
  ];
  const agents = [
    ...walk(at(".claude", "agents"), (f) => f.endsWith(".md")),
    ...walk(at(".codex", "agents"), (f) => f.endsWith(".toml")),
  ];
  return { instructions, rules, skills, agents };
}

/** Concatenated text of all always-loaded instruction files; used to tell what is already documented. */
export function instructionsText(projectDir) {
  const { instructions, rules } = discover(projectDir);
  return [...instructions, ...rules].map((f) => readText(f) ?? "").join("\n");
}

function stripCode(text) {
  return text.replace(/```[\s\S]*?```/g, (block) => block.replace(/[^\n]/g, " "));
}

/** Decides whether a backticked token refers to a file, and returns the path to check (or null). */
function pathCandidate(raw, exists_) {
  // Drop line anchors and trailing sentence punctuation: `src/a.ts#L10`, `src/a.ts:12`, `src/a.ts.`
  const token = raw.trim().replace(/#.*$/, "").replace(/:\d+.*$/, "").replace(/^\.\//, "").replace(/[.,;]+$/, "");
  if (!/[/.]/.test(token) || /\s/.test(token) || token.length < 4 || token.length > 120) return null;
  if (/^(https?:|[a-z]+:\/\/|@|\$|~|#|\.\.\.|\/)/.test(token) || /[*<>{}|()=,;:@]/.test(token)) return null;
  if (/^v?\d+(\.\d+)*/.test(token) || NOT_A_FILE.test(token)) return null;
  const ext = /\.([a-z0-9]+)$/i.exec(token)?.[1]?.toLowerCase();
  if (!token.includes("/")) return ext && FILE_EXT.has(ext) && !/^\.[a-z]+$/i.test(token) ? token : null;
  // With a slash it could also be a branch, a MIME type or a package subpath (`origin/main`,
  // `application/json`, `react-dom/client`). Only a known top-level folder or a file extension makes it a path.
  const first = token.split("/")[0];
  return (ext && FILE_EXT.has(ext)) || exists_(first) ? token : null;
}

export function runDoctor(projectDir) {
  const findings = [];
  const add = (severity, rule, file, message, line) =>
    findings.push({ severity, rule, file: file ? relative(projectDir, file) : null, line: line ?? null, message });

  const found = discover(projectDir);
  // A CLAUDE.md that is a symlink to AGENTS.md is one file, not two.
  const real = (f) => {
    try {
      return realpathSync(f);
    } catch {
      return f;
    }
  };
  const seenReal = new Set();
  const unique = (files) => files.filter((f) => (seenReal.has(real(f)) ? false : seenReal.add(real(f))));
  found.instructions = unique(found.instructions);
  found.rules = unique(found.rules);
  const pkg = readJson(join(projectDir, "package.json"));
  const scripts = pkg?.scripts ?? null;
  const hasFormatter = FORMATTER_CONFIGS.some((f) => exists(join(projectDir, f))) || Boolean(pkg?.prettier || pkg?.eslintConfig);

  if (found.instructions.length === 0) {
    add("error", "no-instructions", null, "No AGENTS.md or CLAUDE.md. Run the weave-onboard skill to create one.");
  }

  const always = [...found.instructions, ...found.rules];
  const seenLines = new Map(); // normalized line -> first location
  let totalBytes = 0;
  let codexBytes = 0; // Codex only reads AGENTS.md files

  for (const file of always) {
    const text = readText(file) ?? "";
    const lines = text.split("\n");
    const lineCount = text.endsWith("\n") ? lines.length - 1 : lines.length;
    const isRoot = found.instructions.includes(file);
    totalBytes += Buffer.byteLength(text);
    if (/^AGENTS(\.override)?\.md$/.test(basename(file))) codexBytes += Buffer.byteLength(text);

    if (isRoot) {
      if (lineCount > BUDGET.errorLines) {
        add("error", "too-long", file, `${lineCount} lines. Past ~${BUDGET.errorLines} lines instructions are routinely ignored. Move procedures into skills and area-specific rules into scoped rule files.`);
      } else if (lineCount > BUDGET.warnLines) {
        add("warn", "too-long", file, `${lineCount} lines (budget ${BUDGET.warnLines}). Every line competes for attention; prune what the agent can find on its own.`);
      }
    }

    const prose = stripCode(text).split("\n");
    let emphasis = 0;
    let treeLines = 0;
    lines.forEach((raw, i) => {
      const line = prose[i] ?? "";
      const n = i + 1;

      for (const re of VAGUE) {
        if (re.test(line)) {
          add("warn", "vague", file, `Not actionable: "${line.trim().slice(0, 80)}". The agent already tries to do this; say what is specific to this repo or delete it.`, n);
          break;
        }
      }
      if (hasFormatter && STYLE.test(line)) {
        add("warn", "linter-job", file, "Formatting rule in prose, but the repo has a formatter/linter config. Let the tool enforce it (or a hook) and delete the line.", n);
      }
      if (/\b(IMPORTANT|CRITICAL|MUST|NEVER|ALWAYS|MANDATORY)\b/.test(line)) emphasis++;
      if (/[├└│]──|^\s*[│|]\s{2,}/.test(raw)) treeLines++;
      for (const re of SECRET) {
        if (re.test(raw)) add("error", "secret", file, "Looks like a credential. Instruction files are loaded into every session and usually committed.", n);
      }

      // Backticked paths that no longer exist mislead the agent on every session.
      for (const m of line.matchAll(/`([^`\n]+)`/g)) {
        const here = (p) => exists(join(projectDir, p)) || exists(join(dirname(file), p));
        const token = pathCandidate(m[1], here);
        if (token && !here(token)) add("warn", "dead-path", file, `References \`${token}\`, which does not exist.`, n);
      }

      // Checked on the raw line, so commands inside code fences count too.
      if (scripts) {
        for (const m of raw.matchAll(SCRIPT_RUNNERS)) {
          const name = m[2].replace(/[.:;,]+$/, "");
          if (m[3] || SCRIPT_FILE.test(name) || Object.hasOwn(scripts, name)) continue;
          add("error", "dead-script", file, `\`${m[1]} run ${name}\` is not a script in package.json.`, n);
        }
      }

      const norm = raw.trim().toLowerCase().replace(/\s+/g, " ");
      if (norm.length >= 40 && !norm.startsWith("|") && !norm.startsWith("```")) {
        const first = seenLines.get(norm);
        if (first && first.file !== file) {
          add("warn", "duplicate", file, `Same line as ${relative(projectDir, first.file)}:${first.line}. Keep one source; duplicated instructions drift apart.`, n);
        } else if (!first) {
          seenLines.set(norm, { file, line: n });
        }
      }
    });

    if (emphasis > BUDGET.emphasisMax) {
      add("warn", "emphasis", file, `${emphasis} lines use IMPORTANT/MUST/NEVER-style emphasis. When everything shouts, nothing stands out; a rule that needs shouting belongs in a hook.`);
    }
    if (treeLines >= 12) {
      add("warn", "tree-dump", file, `Contains a ${treeLines}-line directory tree. The agent can list files itself; overviews like this measurably raise cost without raising success. Keep only non-obvious pointers.`);
    }
  }

  if (codexBytes > BUDGET.codexMaxBytes) {
    add("error", "codex-truncation", null, `AGENTS.md files total ${Math.round(codexBytes / 1024)} KiB. Codex silently truncates project docs at 32 KiB.`);
  }

  // Both platforms should read one source of truth.
  const agentsMd = join(projectDir, "AGENTS.md");
  const claudeMd = [join(projectDir, "CLAUDE.md"), join(projectDir, ".claude", "CLAUDE.md")].find(exists);
  if (exists(agentsMd) && claudeMd && real(agentsMd) !== real(claudeMd)) {
    const claudeText = readText(claudeMd) ?? "";
    if (!/@AGENTS\.md\b/.test(claudeText)) {
      add("warn", "two-sources", claudeMd, "CLAUDE.md and AGENTS.md both exist but CLAUDE.md does not import `@AGENTS.md`. Keep shared rules in AGENTS.md and import it, so Claude Code and Codex cannot drift.");
    }
  }

  // The single most valuable thing an instruction file can hold is how to verify work.
  if (found.instructions.length && scripts) {
    const text = always.map((f) => readText(f) ?? "").join("\n");
    const checks = ["test", "lint", "typecheck", "check", "build"].filter((s) => s in scripts);
    if (checks.length && !checks.some((s) => new RegExp(`\\b(run )?${s}\\b`, "i").test(text))) {
      add("warn", "no-verification", found.instructions[0], `package.json has ${checks.map((s) => `"${s}"`).join(", ")} but the instructions never mention how to verify a change. Agents perform far better when they can check their own work.`);
    }
  }

  for (const file of found.skills) {
    const { data, body } = parseFrontmatter(readText(file) ?? "");
    const folder = basename(dirname(file));
    if (!data) {
      add("error", "skill-frontmatter", file, "Missing YAML frontmatter with `name` and `description`.");
      continue;
    }
    const desc = data.description ?? "";
    if (!desc) add("error", "skill-description", file, "No `description`. It is the only thing the agent sees when deciding whether to load the skill.");
    else if (desc.length < BUDGET.descriptionMin) add("warn", "skill-description", file, `Description is ${desc.length} characters. Say what the skill does and when to use it, with the words a user would actually type.`);
    else if (desc.length > BUDGET.descriptionMax) add("error", "skill-description", file, `Description is ${desc.length} characters; the limit is ${BUDGET.descriptionMax}.`);
    if (data.name && data.name !== folder) add("warn", "skill-name", file, `Frontmatter name "${data.name}" does not match folder "${folder}".`);
    if (data.name && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(data.name)) add("warn", "skill-name", file, `Name "${data.name}" should be lowercase letters, digits and hyphens.`);
    const bodyLines = body.split("\n").length;
    if (bodyLines > BUDGET.skillBodyLines) add("warn", "skill-length", file, `${bodyLines} lines. Keep SKILL.md under ${BUDGET.skillBodyLines} and move detail into reference files it links to.`);
  }

  // A skill installed for both tools must be the same skill in both places.
  const claudeSkills = join(projectDir, ".claude", "skills");
  const codexSkills = join(projectDir, ".agents", "skills");
  for (const file of found.skills.filter((f) => f.startsWith(claudeSkills))) {
    const twin = join(codexSkills, relative(claudeSkills, file));
    if (exists(twin) && readText(twin) !== readText(file)) {
      add("warn", "skill-drift", file, `Differs from ${relative(projectDir, twin)}. Claude Code and Codex are following different versions of this skill.`);
    }
  }

  for (const file of found.agents.filter((f) => f.endsWith(".md"))) {
    const { data } = parseFrontmatter(readText(file) ?? "");
    if (!data?.name || !data?.description) {
      add("error", "agent-frontmatter", file, "Subagent needs `name` and `description` frontmatter, otherwise it is never delegated to.");
    }
  }

  const weight = { error: 12, warn: 4 };
  const score = Math.max(0, 100 - findings.reduce((sum, f) => sum + weight[f.severity], 0));
  return {
    score,
    files: {
      instructions: found.instructions.map((f) => relative(projectDir, f)),
      rules: found.rules.length,
      skills: found.skills.length,
      agents: found.agents.length,
    },
    bytes: totalBytes,
    findings,
  };
}
