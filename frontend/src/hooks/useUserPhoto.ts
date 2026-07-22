import { useEffect, useState } from "react";
import { api } from "../services/api";
import { User } from "../types";

/**
 * The user's avatar/company-logo data URIs are excluded from every auth
 * response (login/me/refresh) on purpose — some are multiple MB of base64
 * and /me gets re-fetched on every window focus. Components that actually
 * need to render the image fetch it once, here, instead.
 */
export function useUserPhoto(user: User | null | undefined) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);

  useEffect(() => {
    if (!user || (!user.hasPhoto && !user.hasCompanyLogo)) {
      setPhoto(null);
      setCompanyLogo(null);
      return;
    }
    let cancelled = false;
    api
      .get("/api/auth/photo")
      .then((r) => {
        if (cancelled) return;
        setPhoto(r.data.photo || null);
        setCompanyLogo(r.data.companyLogo || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.hasPhoto, user?.hasCompanyLogo]);

  return { photo, companyLogo };
}
