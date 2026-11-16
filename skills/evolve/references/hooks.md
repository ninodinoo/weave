# Writing a hook

A hook is a command the tool runs at a fixed point, whatever the model decides. Use one when a rule has no exceptions and a written rule has already been broken. Keep hooks few: each one runs on every matching event, and one that blocks wrongly is worse than the mistake it prevents.

Both tools use the same JSON shape and pass the event as JSON on stdin.

| | Claude Code | Codex |
|---|---|---|
| File | `.claude/settings.json`, under `"hooks"` | `.codex/hooks.json`, under `"hooks"` |
| Activation | when the workspace is trusted | the user approves each new or changed hook once in `/hooks` |
| Shell tool name | `Bash` | `Bash` |
| File edit tool names | `Edit`, `Write` | `apply_patch` (matcher aliases `Edit`, `Write`) |

Merge into the existing file; never replace other entries. After adding a Codex hook, tell the user to approve it in `/hooks`.

## Shape

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{ "type": "command", "command": "node .weave/hooks/no-force-push.mjs", "timeout": 10 }]
      }
    ]
  }
}
```

In Claude Code, write the path as `"$CLAUDE_PROJECT_DIR/.weave/hooks/no-force-push.mjs"` so it works from any subdirectory.

## Events worth using

| Event | Fires | stdin fields beyond `session_id`, `cwd` | Typical use |
|---|---|---|---|
| `PreToolUse` | before a tool call | `tool_name`, `tool_input` | block a forbidden command or path |
| `PostToolUse` | after a tool call succeeded | `tool_name`, `tool_input`, `tool_response` | format or lint the file just edited |
| `Stop` | when the agent is about to finish | `stop_hook_active` | refuse to finish while tests fail |
| `UserPromptSubmit` | when the user sends a prompt | `prompt` | add context the prompt needs |
| `SessionStart` | at session start | `source` | load state |

## Telling the tool what to do

Exit code `0` lets things proceed. Exit code `2` blocks, and whatever the script wrote to stderr is shown to the model as the reason, so say what to do instead. Any other exit code is a non-blocking error.

A blocking `PreToolUse` hook, complete. Note that it parses the command instead of running one regular expression over it: a single pattern either misses spellings (`-fu`, `+main`) or blocks innocent commands (`git push origin main && rm -f tmp`).

```js
// .weave/hooks/no-force-push.mjs
let raw = "";
for await (const chunk of process.stdin) raw += chunk;
let command = "";
try {
  command = JSON.parse(raw).tool_input?.command ?? "";
} catch {
  process.exit(0); // fail open
}

const forcePush = String(command).split(/&&|\|\||[;|\n]/).some((part) => {
  const words = part.trim().split(/\s+/);
  if (words[0] !== "git") return false;
  const push = words.indexOf("push");
  if (push < 0) return false;
  // `--force`, `--force-with-lease`, a short-flag bundle containing f (`-f`, `-fu`), or a `+refspec`.
  return words.slice(push + 1).some((w) => w.startsWith("--force") || /^-[a-zA-Z]*f[a-zA-Z]*$/.test(w) || w.startsWith("+"));
});

if (forcePush) {
  console.error("Force-pushing is not allowed in this repo. Push normally, or ask the user.");
  process.exit(2);
}
```

A `Stop` hook must let the agent finish when `stop_hook_active` is true, otherwise it can loop forever:

```js
const input = JSON.parse(raw || "{}");
if (input.stop_hook_active) process.exit(0);
```

## Before you ship one

- Test it by piping sample JSON into the script: several inputs that should block, and several that look similar but should pass.
- Make it fast, and make it fail open: if the script crashes, the work should continue.
- Put the script in `.weave/hooks/` and commit it, so the hook works for everyone on the repo.
