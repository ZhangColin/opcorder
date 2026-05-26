import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export interface InvitedOpc {
  userId: number;
  email: string | null;
  nickname: string;
  trackLevel: "A" | "B" | "C";
}

interface SelectInput {
  catCategoryId: number;
  requiredTrackLevel: "any" | "C" | "B" | "A";
  publisherId: number;
}

interface PoolRow {
  userId: number;
  email: string | null;
  nickname: string;
  level: "A" | "B" | "C";
}

/**
 * Select up to 7 OPCs to invite to bid on a demand, based on the required track level.
 * Rules:
 *   any / C → 4A + 2B + 1C with cascade overflow (unmet B/C quota → cascades up to A)
 *   B       → 4A + 3B (B quota cascades up to A if not met)
 *   A       → 7A
 * If the eligible pool is smaller, returns fewer rows.
 * Each OPC appears at most once. Excludes the publisher itself, and non-active / no-email users.
 */
export async function selectInvitedOpcs(input: SelectInput): Promise<InvitedOpc[]> {
  const { catCategoryId, requiredTrackLevel, publisherId } = input;

  // Pull all active OPCs with an active cert in this category, joined to users.
  // Order so that highest-level cert per user is picked (a user with both A and B certs shouldn't happen
  // due to the unique (userId, catCategoryId), but DISTINCT ON guards either way).
  const rows = (await db.execute(sql`
    SELECT DISTINCT ON (u.id)
      u.id AS "userId",
      u.email AS "email",
      u.nickname AS "nickname",
      c.level AS "level"
    FROM users u
    INNER JOIN opc_track_certs c ON c.user_id = u.id
    WHERE c.cat_category_id = ${catCategoryId}
      AND c.status = 'active'
      AND u.role = 'opc'
      AND u.status = 'active'
      AND u.id <> ${publisherId}
    ORDER BY u.id, CASE c.level WHEN 'A' THEN 3 WHEN 'B' THEN 2 WHEN 'C' THEN 1 ELSE 0 END DESC
  `)).rows as unknown as PoolRow[];

  // Bucket by level
  const buckets: Record<"A" | "B" | "C", PoolRow[]> = { A: [], B: [], C: [] };
  for (const r of rows) {
    if (r.level === "A" || r.level === "B" || r.level === "C") {
      buckets[r.level].push(r);
    }
  }

  // Quota per requirement
  type Quota = { A: number; B: number; C: number };
  let quota: Quota;
  if (requiredTrackLevel === "A") {
    quota = { A: 7, B: 0, C: 0 };
  } else if (requiredTrackLevel === "B") {
    quota = { A: 4, B: 3, C: 0 };
  } else {
    // "any" or "C"
    quota = { A: 4, B: 2, C: 1 };
  }

  // Pick respecting quotas with cascade overflow (unmet C → B → A; unmet B → A).
  const picked: PoolRow[] = [];
  const used = new Set<number>();

  const take = (level: "A" | "B" | "C", n: number): number => {
    if (n <= 0) return 0;
    let taken = 0;
    for (const r of buckets[level]) {
      if (taken >= n) break;
      if (used.has(r.userId)) continue;
      used.add(r.userId);
      picked.push(r);
      taken++;
    }
    return taken;
  };

  // Step 1: take from A → B → C in original order (so cascade only fills shortfalls upward).
  // Compute shortfalls cascading C→B→A.
  const tookC = take("C", quota.C);
  let shortfallC = quota.C - tookC;
  const tookB = take("B", quota.B + shortfallC);
  let shortfallB = quota.B + shortfallC - tookB;
  take("A", quota.A + shortfallB);

  // Final cap at 7
  const final = picked.slice(0, 7);
  return final.map(r => ({
    userId: r.userId,
    email: r.email,
    nickname: r.nickname,
    trackLevel: r.level,
  }));
}
