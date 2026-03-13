/**
 * Weave Context Guard Hook
 *
 * Monitors context window usage and provides warnings
 * when the conversation is getting too long.
 *
 * Suggests strategies like:
 * - Offloading to subagents
 * - Starting a fresh conversation with /weave:status to reload context
 * - Using file-based state instead of conversation memory
 */

const WARN_THRESHOLD = 150; // Warn after ~150 messages (rough proxy for context fill)

let messageCount = 0;

/**
 * Called on each conversation turn.
 */
export function onMessage() {
  messageCount++;

  if (messageCount === WARN_THRESHOLD) {
    return {
      warning: "🧶 Context window getting full. Consider:\n" +
        "  - Offloading complex tasks to subagents\n" +
        "  - Starting a fresh session (run /weave:status to reload context)\n" +
        "  - Saving intermediate results to files"
    };
  }

  return null;
}

/**
 * Reset counter (called on new conversation).
 */
export function reset() {
  messageCount = 0;
}
