---
name: Agent form field type contract
description: bidDeadline input type and date format alignment between tool output and form field
---

The `validate_timeline` tool returns `bidDeadline` as `"YYYY-MM-DD"` (bare date string, no time).

The form field for bidDeadline must be `type="date"` — NOT `type="datetime-local"`.

**Why:** `datetime-local` inputs require `"YYYY-MM-DDTHH:mm"` format. If the value is just `"YYYY-MM-DD"`, the browser silently rejects it and the field appears empty. There is no error, no warning — the state is set but the field shows blank.

**How to apply:** When adding or changing date fields driven by tool output, check the tool's return format first and match the input type accordingly. If the tool returns date-only (`YYYY-MM-DD`), use `type="date"`. Only use `type="datetime-local"` if the tool returns a full datetime string and you need time precision.

Also: when loading existing demand data into a `type="date"` field, use `.slice(0, 10)` to strip any time component from stored ISO strings.
