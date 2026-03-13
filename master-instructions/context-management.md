# Master Instruction: Context Window Management

## The Problem

Every AI tool has a limited context window. The more junk in it, the worse the AI performs. Context management is about keeping the window clean and focused.

## Strategies

### 1. Subagent Offloading
Heavy research tasks should go to subagents. They get their own fresh context. The main conversation stays clean with just the summary.

### 2. Focused Reads
Don't read entire files when you need 10 lines. Use line ranges, grep for specific patterns, read only what's needed.

### 3. Clean Handoffs
When passing work between agents, pass the RESULT not the entire process. "Here are the 3 files to change and why" — not the entire research journey.

### 4. Context Checkpoints
For long tasks, periodically summarize progress and clear mental state. What's done, what's next, what's the current plan.

### 5. File-based State
Store intermediate results in files (.weave/history/, temp files) rather than keeping everything in conversation memory.

## Signs of Context Rot

- AI starts forgetting earlier instructions
- AI repeats questions already answered
- AI makes mistakes on things it got right earlier
- Responses become generic instead of project-specific

## Prevention

- Use teams with sequential subagents (each gets fresh context)
- Keep master instructions concise
- Don't dump entire files into conversation — read specific sections
- For long sessions, consider starting fresh with `/weave:status` to reload context
