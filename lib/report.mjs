// Assembles the evidence report: transcript analysis + hook-captured feedback
// + a before/after check on every change Weave applied earlier.
import { loadSessions } from "./sessions/index.mjs";
import { analyze } from "./analyze.mjs";
import { instructionsText, runDoctor } from "./doctor.mjs";
import { loadState, loadHistory, loadInbox } from "./state.mjs";

const DAY = 86400000;

/** Did the problem a past change targeted come back after the change landed? */
export function effectiveness(history, raw) {
  const out = [];
  for (const entry of history) {
    const watch = (entry.watch ?? []).map((w) => String(w).toLowerCase()).filter(Boolean);
    if (!watch.length || !entry.ts) continue;
    const hit = (text) => watch.some((w) => text.toLowerCase().includes(w));
    const events = [
      ...raw.feedback.map((f) => ({ ts: f.ts, text: f.quote })),
      ...raw.failures.map((f) => ({ ts: f.ts, text: f.command })),
    ].filter((e) => e.ts && hit(e.text));
    const before = events.filter((e) => e.ts < entry.ts).length;
    const after = events.filter((e) => e.ts >= entry.ts).length;
    const sessionsAfter = raw.sessionStarts.filter((s) => s && s >= entry.ts).length;
    let verdict = "too-early";
    if (after > 0) verdict = "recurring";
    else if (sessionsAfter >= 5) verdict = "holding";
    out.push({ date: entry.ts.slice(0, 10), kind: entry.kind, target: entry.target, summary: entry.summary, before, after, sessionsAfter, verdict });
  }
  return out;
}

export function buildReport(projectDir, opts = {}) {
  const state = loadState(projectDir);
  const days = opts.all ? null : Number.isFinite(opts.days) && opts.days > 0 ? opts.days : 60;
  const since = days ? new Date(Date.now() - days * DAY) : undefined;
  const sessions = loadSessions(projectDir, { since, platforms: opts.platforms });
  const report = analyze(sessions, {
    projectDir,
    instructionsText: instructionsText(projectDir),
    minSessions: opts.minSessions,
  });
  const raw = report._raw;
  delete report._raw;

  // Feedback the hooks captured may come from sessions whose transcripts are gone.
  const known = new Set(raw.feedback.map((f) => f.quote.slice(0, 80)));
  for (const item of loadInbox(projectDir)) {
    if (!item.quote || known.has(item.quote.slice(0, 80))) continue;
    if (since && item.ts && new Date(item.ts) < since) continue;
    const entry = { kind: item.kind ?? "standing", session: item.session ?? null, platform: item.platform ?? null, date: (item.ts ?? "").slice(0, 10), ts: item.ts, quote: item.quote, source: "hook" };
    raw.feedback.push(entry);
    report.feedback.push(entry);
  }
  report.summary.standingInstructions = raw.feedback.filter((f) => f.kind === "standing").length;

  // Uses the timestamps, so it has to run before they are stripped from the output.
  report.pastChanges = effectiveness(loadHistory(projectDir), raw);

  const last = state.lastEvolvedAt;
  report.feedback = report.feedback.map(({ ts, ...rest }) => ({ ...rest, new: !last || (ts ?? "") > last }));
  report.summary.windowDays = days;
  report.summary.lastEvolvedAt = last;
  report.summary.newFeedback = report.feedback.filter((f) => f.new).length;

  const doctor = runDoctor(projectDir);
  report.setup = { score: doctor.score, files: doctor.files, bytes: doctor.bytes, findings: doctor.findings.length };
  return report;
}
