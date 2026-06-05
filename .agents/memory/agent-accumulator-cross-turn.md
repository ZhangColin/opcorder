---
name: Agent accumulator cross-turn
description: The tool-result accumulator in agent.ts must be pre-populated from conversation history
---

The ReAct agent loop in `agent.ts` uses an `accumulated{}` object to capture results from key tool calls (`validate_timeline` → bidDeadline/deadline, `suggest_milestones` → milestones) and inject them into `form_suggestion_json` before streaming.

**Why pre-population matters:** `accumulated` is reset to `{}` on every HTTP request. In a multi-turn conversation, `validate_timeline` may run in turn 2 but the user asks for the form in turn 5. If you only collect from the current request's tool calls, accumulated stays empty in turn 5 and the injection does nothing.

**Fix:** Before starting the while loop, scan `historyMessages` for previous tool result messages (`role: "tool"`, with `toolName` and `content`) and replay the same extraction logic to pre-populate `accumulated`. Tool results from earlier turns are then available to the injector.

**How to apply:** Any future tool whose results should be guaranteed in the final JSON output needs both:
1. Collection inside the current-turn tool loop  
2. Pre-population from `historyMessages` for cross-turn coverage
