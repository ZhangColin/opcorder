import { getStoredUser, getUserIdFromToken } from "@/lib/auth";

export function useCurrentUser() {
  const storedUser = getStoredUser();

  const userId = storedUser?.id ?? getUserIdFromToken() ?? 0;
  const nickname = storedUser?.nickname ?? "";
  const role = storedUser?.role ?? "";

  const avatarChar = nickname ? nickname.charAt(0) : "?";
  const roleLabel =
    role === "publisher" ? "发单方" :
    role === "opc" ? "OPC超级个体" :
    role === "admin" ? "平台管理员" : "";

  return { userId, nickname, role, avatarChar, roleLabel };
}
