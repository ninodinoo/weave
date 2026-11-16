import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

export function tempDir(prefix = "weave-test-") {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function write(root, file, content) {
  const full = join(root, file);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, typeof content === "string" ? content : JSON.stringify(content, null, 2));
  return full;
}

export const jsonl = (lines) => lines.map((l) => JSON.stringify(l)).join("\n") + "\n";

/** Build a normalized session the way the parsers would. */
export function session(id, startedAt, events, platform = "claude") {
  return { platform, id, file: `${id}.jsonl`, cwd: "/repo", startedAt, events: events.map((e) => ({ ts: startedAt, ...e })) };
}
export const user = (text) => ({ kind: "user", text });
export const bash = (command, ok = true, output = "") => ({ kind: "tool", name: "Bash", input: { command }, ok, output });
export const read = (file_path) => ({ kind: "tool", name: "Read", input: { file_path }, ok: true, output: "" });
export const edit = (file_path) => ({ kind: "tool", name: "Edit", input: { file_path }, ok: true, output: "" });
