---
name: JSX generic type arguments break Babel in jiedanba
description: vite plugin-react (Babel parser) cannot parse `<Component<T> ...>` generic JSX syntax; causes 500 on module load and blank page.
---

## Rule
In `artifacts/jiedanba` (vite + @vitejs/plugin-react/Babel), never write JSX generic type arguments like `<TabBar<"a" | "b"> ...>`. Babel's parser throws `Unexpected token`, the module 500s, and the lazy-loaded page white-screens.

**Why:** Babel's JSX parser (unlike tsc/esbuild) does not support TS generic instantiation on JSX elements. tsc --noEmit passes, so the error only appears at runtime in the browser.

**How to apply:** Rely on type inference from props, or cast inside the callback (`onChange={(v) => set(v as "a" | "b")}`).
