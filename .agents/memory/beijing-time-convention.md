---
name: Beijing time convention
description: All user-visible and user-operable times on the platform use Beijing time (UTC+8), with naive storage pattern.
---

## Rule
All times shown to or entered by users on this platform are **Beijing time (UTC+8)**. This applies to every role: publishers, OPCs, and admins.

## Storage pattern — naive (no real UTC conversion)
The database stores timestamps using a **naive pattern**: the Beijing time value is stored directly into a `timestamp` (without time zone) column. The server (Node.js, UTC) treats the incoming datetime string as UTC, so the stored number equals the Beijing wall-clock time.

For example: admin enters "09:00 Beijing" → DB stores `09:00` (as UTC-labeled, but the number is the Beijing time).

**Why:** The system was built this way from the start. All existing data follows this pattern. Converting to true UTC would require a data migration and a complete audit of every display site.

## Display rule
Because stored values are "naive Beijing", all display code must **prevent the browser from doing its own timezone conversion**. Always pass `timeZone: "UTC"` when formatting:

```ts
new Date(isoString).toLocaleString("zh-CN", { timeZone: "UTC", ... })
```

Never use `toLocaleString("zh-CN")` / `toLocaleDateString("zh-CN")` without `timeZone: "UTC"` — a Chinese browser (UTC+8) will shift the displayed time 8 hours forward.

## Form input / edit rule
When reading a stored ISO string back into a `datetime-local` input, use **UTC accessors** to reconstruct the value so no offset is applied:

```ts
function naiveDatetimeLocal(isoString: string): string {
  const d = new Date(isoString);
  const Y = d.getUTCFullYear();
  const M = String(d.getUTCMonth() + 1).padStart(2, "0");
  const D = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  return `${Y}-${M}-${D}T${h}:${m}`;
}
```

When saving, send the `datetime-local` value as-is (no `+08:00` conversion) — the server will store it as the same number.

**Why:** Adding a `+08:00` offset before sending subtracts 8 hours in the DB, then `naiveDatetimeLocal` adds them back — but only if both sides are consistently applied. Since legacy data was stored without conversion, the safest rule is: **no conversion anywhere**.

## How to apply
- Any new page/component that renders a datetime from the DB → use `timeZone: "UTC"` in Intl options.
- Any new form that edits a datetime → use `naiveDatetimeLocal()` to init the input state.
- Any new API field of type datetime → document it as "naive Beijing time" in comments.
- Do NOT introduce real UTC↔Beijing conversion without a full data migration plan.
