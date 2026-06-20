import { createContext, useContext } from "react";

export type AdminInlineNavCtx = {
  push: (path: string) => void;
  back: () => void;
} | null;

export const AdminInlineNavContext = createContext<AdminInlineNavCtx>(null);
export const useAdminInlineNav = () => useContext(AdminInlineNavContext);
