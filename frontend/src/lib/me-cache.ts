import type { Me } from "@/lib/types";

const ME_CACHE_KEY = "corp_me_cache";
let memoryMe: Me | null = null;

export function getMemoryMe(): Me | null {
  return memoryMe;
}

export function getCachedMe(): Me | null {
  if (memoryMe) return memoryMe;
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ME_CACHE_KEY);
    if (!raw) return null;
    memoryMe = JSON.parse(raw) as Me;
    return memoryMe;
  } catch {
    return null;
  }
}

export function setCachedMe(me: Me): void {
  memoryMe = me;
  if (typeof window === "undefined") return;
  localStorage.setItem(ME_CACHE_KEY, JSON.stringify(me));
}

export function clearCachedMe(): void {
  memoryMe = null;
  if (typeof window === "undefined") return;
  localStorage.removeItem(ME_CACHE_KEY);
}
