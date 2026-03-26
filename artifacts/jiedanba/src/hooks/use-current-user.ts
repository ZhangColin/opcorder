export function useCurrentUser() {
  const userId = parseInt(localStorage.getItem("jdb_user_id") ?? "0") || 0;
  const nickname = localStorage.getItem("jdb_nickname") ?? "";
  const role = localStorage.getItem("jdb_role") ?? "";

  const avatarChar = nickname ? nickname.charAt(0) : "?";
  const roleLabel =
    role === "publisher" ? "发单方" :
    role === "opc" ? "OPC超级个体" :
    role === "admin" ? "平台管理员" : "";

  return { userId, nickname, role, avatarChar, roleLabel };
}
