"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { getAccessToken } from "@/lib/auth-storage";
import { apiRequest } from "@/lib/api-client";
import { clearCachedMe, getCachedMe, getMemoryMe, setCachedMe } from "@/lib/me-cache";
import type { Me, RoleCode } from "@/lib/types";

export function useAuth(requiredRoles?: RoleCode[]) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(() => getMemoryMe());
  const [loading, setLoading] = useState<boolean>(() => !getMemoryMe());
  const requiredRolesKey = (requiredRoles ?? []).join(",");
  const requiredRolesList = useMemo(
    () => (requiredRolesKey ? (requiredRolesKey.split(",") as RoleCode[]) : []),
    [requiredRolesKey]
  );

  useEffect(() => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      clearCachedMe();
      setMe(null);
      setLoading(false);
      router.replace("/login");
      return;
    }

    const cachedMe = getCachedMe();
    if (cachedMe && requiredRolesList.length > 0 && !requiredRolesList.includes(cachedMe.role)) {
      setLoading(false);
      router.replace("/dashboard");
      return;
    }

    if (cachedMe) {
      setMe(cachedMe);
      setLoading(false);
    }

    let isMounted = true;
    apiRequest<Me>("/api/auth/me")
      .then((res) => {
        if (!isMounted) return;
        if (requiredRolesList.length > 0 && !requiredRolesList.includes(res.role)) {
          router.replace("/dashboard");
          return;
        }
        setCachedMe(res);
        setMe(res);
      })
      .catch(() => {
        if (!isMounted) return;
        clearCachedMe();
        setMe(null);
        router.replace("/login");
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [requiredRolesKey, requiredRolesList, router]);

  return useMemo(() => ({ me, loading }), [loading, me]);
}
