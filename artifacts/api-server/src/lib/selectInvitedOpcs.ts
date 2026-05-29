import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export interface InvitedOpc {
  userId: number;
  email: string;
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
  email: string;
  nickname: string;
  level: "A" | "B" | "C";
}

/**
 * Select up to 7 OPCs to invite to bid on a demand, based on the required track level.
 *
 * Quota base:
 *   any / C → 4A + 2B + 1C  (downward cascade: A 不足→补 B；B 不足→补 C)
 *   B       → 4A + 3B       (A 不足→补 B；B 无下层可补)
 *   A       → 7A            (无下层可补)
 *
 * Candidate pool: active OPCs with an active cert in the given cat_category
 *   that have a non-empty email and are not the publisher themselves.
 *
 * Selection is randomized per level (so re-invites cycle through the pool).
 * Returns at most 7 rows, sorted A→B→C, then by nickname for stability.
 */
export async function selectInvitedOpcs(input: SelectInput): Promise<InvitedOpc[]> {
  const { catCategoryId, requiredTrackLevel, publisherId } = input;

  // Random order per row. DISTINCT ON guarantees one row per user (picking
  // their highest-level cert if duplicates ever exist).
  const rows = (await db.execute(sql`
    SELECT * FROM (
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
        AND u.email IS NOT NULL
        AND length(trim(u.email)) > 0
      ORDER BY u.id, CASE c.level WHEN 'A' THEN 3 WHEN 'B' THEN 2 WHEN 'C' THEN 1 ELSE 0 END DESC
    ) t
    ORDER BY random()
  `)).rows as unknown as PoolRow[];

  // Bucket by level (already randomized within each bucket).
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

  // Pick A first, then cascade A-shortfall into B's target; then pick B,
  // cascade B-shortfall into C's target; then pick C. Higher-tier shortfalls
  // fall to lower tiers — never the other way (lower tier doesn't qualify
  // for a higher-cert demand).
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

  const tookA = take("A", quota.A);
  const shortfallA = quota.A - tookA;
  // Only cascade A→B if B-level OPCs are eligible for this demand (requiredTrackLevel is B or lower)
  const cascadeAtoB = requiredTrackLevel !== "A" ? shortfallA : 0;
  const tookB = take("B", quota.B + cascadeAtoB);
  const shortfallB = quota.B + cascadeAtoB - tookB;
  // Only cascade B→C if C-level OPCs are eligible for this demand (requiredTrackLevel is C or any)
  const cascadeBtoC = (requiredTrackLevel === "C" || requiredTrackLevel === "any") ? shortfallB : 0;
  take("C", quota.C + cascadeBtoC);

  // Final cap at 7, sorted A→B→C then nickname.
  const LEVEL_RANK: Record<"A" | "B" | "C", number> = { A: 3, B: 2, C: 1 };
  const sorted = picked.slice(0, 7).sort((a, b) => {
    const lvl = LEVEL_RANK[b.level] - LEVEL_RANK[a.level];
    if (lvl !== 0) return lvl;
    return (a.nickname ?? "").localeCompare(b.nickname ?? "");
  });

  return sorted.map(r => ({
    userId: r.userId,
    email: r.email,
    nickname: r.nickname,
    trackLevel: r.level,
  }));
}
