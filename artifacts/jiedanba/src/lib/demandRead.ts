import { getStoredUser } from "./auth";

type DemandType = "client" | "outsource" | "ticket_a" | "ticket_b" | "contract" | "order" | "tender";

function readKey(type: DemandType, id: number): string {
  const uid = getStoredUser()?.id ?? 0;
  return `jdb_read_${uid}_${type}_${id}`;
}

export function markRead(type: DemandType, id: number): void {
  if (!id) return;
  localStorage.setItem(readKey(type, id), new Date().toISOString());
}

export function hasUnread(
  type: DemandType,
  id: number,
  latestAt: string | null | undefined,
  defaultUnread = true,
): boolean {
  if (!latestAt) return false;
  const raw = localStorage.getItem(readKey(type, id));
  if (!raw) return defaultUnread;
  return new Date(latestAt) > new Date(raw);
}

export function hasUnreadSinceCreation(
  type: DemandType,
  id: number,
  latestAt: string | null | undefined,
  createdAt: string,
): boolean {
  if (!latestAt) return false;
  const raw = localStorage.getItem(readKey(type, id));
  const baseline = raw ?? createdAt;
  return new Date(latestAt) > new Date(baseline);
}
