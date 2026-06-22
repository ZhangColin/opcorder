import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { UserCircle, LogOut, ChevronDown, KeyRound } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePublisherCompanyLogo } from "@/hooks/use-publisher-profile";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";

interface Props {
  onLogout: () => void;
}

export function PublisherHeaderUser({ onLogout }: Props) {
  const [, navigate] = useLocation();
  const { userId, nickname, avatarChar, roleLabel } = useCurrentUser();
  const companyLogo = usePublisherCompanyLogo(userId);
  const [open, setOpen] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative flex items-center gap-3" ref={ref}>
      <div className="text-right hidden sm:block max-w-[140px]">
        <p className="text-sm font-bold text-blue-900 truncate">{nickname || "发单方"}</p>
        <p className="text-[10px] text-slate-500 font-medium truncate">{roleLabel}</p>
      </div>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 group"
        aria-label="用户菜单"
      >
        <div className="w-10 h-10 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center font-bold text-primary text-sm group-hover:bg-primary/20 transition-colors overflow-hidden">
          {companyLogo
            ? <img src={companyLogo} alt={nickname || "logo"} className="w-full h-full object-cover" onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            : avatarChar}
        </div>
        <ChevronDown
          size={14}
          className={`text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-44 bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden z-50">
          <button
            onClick={() => { setOpen(false); navigate("/pub/profile"); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-primary/5 hover:text-primary transition-colors"
          >
            <UserCircle size={16} className="text-primary" />
            编辑信息
          </button>
          <button
            onClick={() => { setOpen(false); setShowChangePw(true); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-primary/5 hover:text-primary transition-colors"
          >
            <KeyRound size={16} className="text-primary" />
            修改密码
          </button>
          <div className="h-px bg-slate-100 mx-3" />
          <button
            onClick={() => { setOpen(false); onLogout(); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-destructive hover:bg-destructive/5 transition-colors"
          >
            <LogOut size={16} />
            退出登录
          </button>
        </div>
      )}
      {showChangePw && <ChangePasswordDialog onClose={() => setShowChangePw(false)} />}
    </div>
  );
}
