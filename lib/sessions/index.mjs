// Loads session transcripts from every supported agent and returns them in one shape:
//
//   { platform: "claude" | "codex", id, file, cwd, startedAt, events: Event[] }
//
//   Event = { kind: "user", ts, text }
//         | { kind: "tool", ts, name, input, ok, output }   name "Bash" carries input.command
//         | { kind: "interrupt", ts }
//
// Transcript formats are internal to each tool and change between versions, so the
// parsers are defensive: an unreadable file or line is skipped, never fatal.
import { statSync } from "node:fs";
import { listClaudeSessionFiles, parseClaudeSession } from "./claude.mjs";
import { listCodexSessionFiles, parseCodexSession } from "./codex.mjs";

/**
 * @param {string} projectDir absolute project path
 * @param {object} opts { since?: Date, platforms?: string[] }
 */
export function loadSessions(projectDir, opts = {}) {
  const want = (p) => !opts.platforms || opts.platforms.includes(p);
  const sources = [];
  if (want("claude")) for (const f of listClaudeSessionFiles(projectDir)) sources.push([f, parseClaudeSession]);
  if (want("codex")) for (const f of listCodexSessionFiles(projectDir, opts.since)) sources.push([f, parseCodexSession]);

  const sessions = [];
  for (const [file, parse] of sources) {
    try {
      if (opts.since && statSync(file).mtime < opts.since) continue;
      const session = parse(file, projectDir);
      if (!session || session.events.length === 0) continue;
      if (opts.since && new Date(session.startedAt) < opts.since && statSync(file).mtime < opts.since) continue;
      sessions.push(session);
    } catch {
      // Skip transcripts we cannot read.
    }
  }
  return sessions.sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)));
}
