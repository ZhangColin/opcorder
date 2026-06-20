import { createContext, useContext } from "react";
export const AdminEmbeddedContext = createContext(false);
export const useAdminEmbedded = () => useContext(AdminEmbeddedContext);
