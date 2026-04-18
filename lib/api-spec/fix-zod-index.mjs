/**
 * Post-processes the orval-generated lib/api-zod/src/index.ts to remove the
 * conflicting "export * from './generated/types'" re-export.
 *
 * Why: orval generates both Zod schemas (in generated/api.ts) and TypeScript
 * type aliases (in generated/types/) with identical names. Re-exporting both
 * from the same barrel causes TS2308 "ambiguous re-export" errors. The Zod
 * schema values already carry their own inferred types, so the separate type
 * alias barrel is not needed in the public API surface. The generated/types/
 * folder is still written to disk so it can be imported directly if needed.
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.resolve(__dirname, "../../lib/api-zod/src/index.ts");

const original = readFileSync(indexPath, "utf8");
const fixed = original.replace(/^export \* from "\.\/generated\/types";\n?/m, "");

if (fixed !== original) {
  writeFileSync(indexPath, fixed, "utf8");
  console.log("✔ Removed conflicting types re-export from lib/api-zod/src/index.ts");
} else {
  console.log("✔ lib/api-zod/src/index.ts already clean");
}
