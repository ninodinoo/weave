/**
 * Weave Evolve Hook
 *
 * Runs in the background during AI tool usage.
 * Tracks patterns and suggests workflow improvements.
 *
 * This hook monitors tool calls and collects lightweight signals
 * that the optimizer agent can later analyze.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const WEAVE_DIR = join(process.cwd(), ".weave");
const SIGNALS_FILE = join(WEAVE_DIR, "signals.json");

function loadSignals() {
  if (!existsSync(SIGNALS_FILE)) return { toolCalls: {}, filePatterns: {}, lastCheck: null };
  try {
    return JSON.parse(readFileSync(SIGNALS_FILE, "utf-8"));
  } catch {
    return { toolCalls: {}, filePatterns: {}, lastCheck: null };
  }
}

function saveSignals(signals) {
  mkdirSync(WEAVE_DIR, { recursive: true });
  writeFileSync(SIGNALS_FILE, JSON.stringify(signals, null, 2));
}

/**
 * Track tool usage patterns.
 * Called by the AI tool's hook system on each tool call.
 */
export function onToolCall({ tool, args }) {
  if (!existsSync(WEAVE_DIR)) return; // Weave not initialized

  const signals = loadSignals();

  // Count tool usage
  signals.toolCalls[tool] = (signals.toolCalls[tool] || 0) + 1;

  // Track file patterns (which files/directories are touched most)
  const filePath = args?.file_path || args?.path || args?.file;
  if (filePath) {
    const dir = filePath.split("/").slice(0, -1).join("/");
    signals.filePatterns[dir] = (signals.filePatterns[dir] || 0) + 1;
  }

  saveSignals(signals);
}

/**
 * Check if it's time to suggest an evolve.
 * Returns a suggestion message or null.
 */
export function checkEvolve() {
  if (!existsSync(SIGNALS_FILE)) return null;

  const signals = loadSignals();
  const totalCalls = Object.values(signals.toolCalls).reduce((a, b) => a + b, 0);

  // Suggest evolve every 200 tool calls
  if (totalCalls > 0 && totalCalls % 200 === 0) {
    return "🧶 Weave has observed significant activity. Consider running /weave:evolve to optimize your workflow.";
  }

  return null;
}
