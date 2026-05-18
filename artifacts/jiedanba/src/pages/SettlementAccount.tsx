import { useEffect } from "react";
import { useLocation } from "wouter";

export default function SettlementAccount() {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate("/account-settings", { replace: true });
  }, [navigate]);
  return null;
}
