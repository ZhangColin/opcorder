import { useState, useEffect } from "react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface PublisherProfileBasic {
  companyLogo: string | null;
  nickname: string | null;
  creditCode: string | null;
}

export function usePublisherCompanyLogo(userId: number | null | undefined): string | null {
  const [logo, setLogo] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    fetch(`${API_BASE}/api/users/${userId}/publisher-profile`, {
      headers: { Authorization: `Bearer ${userId}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then((data: PublisherProfileBasic | null) => {
        setLogo(data?.companyLogo ?? null);
      })
      .catch(() => {});
  }, [userId]);

  return logo;
}
