import { ShieldCheck } from "lucide-react";
import { useSiteSettings } from "@/hooks/use-site-settings";

interface SiteLogoProps {
  size?: number;
  className?: string;
  imgClassName?: string;
}

export function SiteLogo({ size = 28, className = "", imgClassName = "" }: SiteLogoProps) {
  const { data: s } = useSiteSettings();
  const src = s?.site_logo;
  const name = s?.site_name ?? "接单吧";

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size }}
        className={`object-contain ${imgClassName}`}
      />
    );
  }

  return <ShieldCheck size={size} className={`text-primary ${className}`} strokeWidth={2.5} />;
}

export function useSiteName() {
  const { data: s } = useSiteSettings();
  return s?.site_name ?? "接单吧";
}
