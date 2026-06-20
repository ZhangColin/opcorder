import { getStoredUser } from "./auth";

type DemandType = "client" | "outsource" | "ticket_a" | "ticket_b" | "contract" | "order";

function readKey(type: DemandType, id: number): string {
  const uid = getStoredUser()?.id ?? 0;
  return `jdb_read_${uid}_${type}_${id}`;
}

export function markRead(type: DemandType, id: number): void {
  if (!id) return;
  localStorage.setItem(readKey(type, id), new Date().toISOString());
}

export function hasUnread(type: DemandType, id: number, latestAt: string | null | undefined): boolean {
  if (!latestAt) return false;
  const raw = localStorage.getItem(readKey(type, id));
  if (!raw) return true;
  return new Date(latestAt) > new Date(raw);
}
