import { createContext, useContext, useState, useEffect, useCallback } from "react";

/* ─── Types ───────────────────────────────────── */

export interface UserProfile {
  name:       string;
  title:      string;
  bio:        string;
  avatar:     string;
  level:      "C" | "B" | "A";
  skills:     string[];
  location:   string;
  website:    string;
  yearsExp:   number;
  phone:      string;
  wechat:     string;
}

export const DEFAULT_PROFILE: UserProfile = {
  name:     "新用户",
  title:    "OPC 超级个体",
  bio:      "尚未填写职业简介，完善个人资料有助于获得更多高质量项目机会。",
  avatar:   "",
  level:    "C",
  skills:   [],
  location: "",
  website:  "",
  yearsExp: 0,
  phone:    "",
  wechat:   "",
};

const STORAGE_KEY = "jdb_opc_profile";

/* ─── Context ─────────────────────────────────── */

interface ProfileCtx {
  profile:       UserProfile;
  updateProfile: (patch: Partial<UserProfile>) => void;
  isNew:         boolean;
}

const ProfileContext = createContext<ProfileCtx>({
  profile:       DEFAULT_PROFILE,
  updateProfile: () => {},
  isNew:         true,
});

/* ─── Provider ────────────────────────────────── */

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...DEFAULT_PROFILE, ...JSON.parse(stored) } : DEFAULT_PROFILE;
    } catch {
      return DEFAULT_PROFILE;
    }
  });

  const [isNew, setIsNew] = useState(!localStorage.getItem(STORAGE_KEY));

  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    setProfile(prev => {
      const next = { ...prev, ...patch };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setIsNew(false);
  }, []);

  return (
    <ProfileContext.Provider value={{ profile, updateProfile, isNew }}>
      {children}
    </ProfileContext.Provider>
  );
}

/* ─── Hook ────────────────────────────────────── */

export function useProfile() {
  return useContext(ProfileContext);
}
