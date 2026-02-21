"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as React from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { clearTokens } from "@/lib/auth-storage";
import { apiRequest } from "@/lib/api-client";
import { clearCachedMe } from "@/lib/me-cache";
import { clearCachedMenus, getCachedMenus, setCachedMenus } from "@/lib/menu-cache";
import { menuIconMap } from "@/lib/menu-icons";
import type { Me, MenuItem } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AppShellProps {
  me: Me;
  title: string;
  description?: string;
  children: React.ReactNode;
}

const SIDEBAR_COLLAPSED_KEY = "corp_sidebar_collapsed";
const CATEGORY_COLLAPSED_KEY = "corp_menu_category_collapsed";
const CATEGORY_PATH = "__category__";
const CONTENT_FADE_MS = 180;

const normalizeMenuPath = (path: string | null | undefined): string => (path ?? "").trim();
const isCategoryPath = (path: string | null | undefined): boolean => normalizeMenuPath(path) === CATEGORY_PATH;
const isNavigablePath = (path: string | null | undefined): boolean => normalizeMenuPath(path).startsWith("/");

let runtimeMenuCache: MenuItem[] = [];

const DASHBOARD_MENU: MenuItem = {
  id: 0,
  name: "Dashboard",
  path: "/dashboard",
  icon: "LayoutDashboard",
  parent_id: null,
  board_id: null,
  sort_order: 0,
  is_active: true,
  created_at: "",
  updated_at: ""
};

export function AppShell({ me, title, description, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const navigationTimerRef = useRef<number | null>(null);

  const [menus, setMenus] = useState<MenuItem[]>(() => {
    if (runtimeMenuCache.length > 0) return runtimeMenuCache;
    const cached = getCachedMenus();
    runtimeMenuCache = cached;
    return cached;
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<number, boolean>>({});
  const [isContentVisible, setIsContentVisible] = useState(true);

  useEffect(() => {
    let isMounted = true;
    apiRequest<MenuItem[]>("/api/menus")
      .then((items) => {
        if (!isMounted) return;
        runtimeMenuCache = items;
        setCachedMenus(items);
        setMenus(items);
      })
      .catch(() => {
        if (!isMounted) return;
        if (runtimeMenuCache.length === 0) {
          setMenus([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (saved === "1") {
      setIsSidebarCollapsed(true);
    }

    const categoryRaw = window.localStorage.getItem(CATEGORY_COLLAPSED_KEY);
    if (categoryRaw) {
      try {
        const parsed = JSON.parse(categoryRaw) as Record<string, boolean>;
        const next: Record<number, boolean> = {};
        Object.entries(parsed).forEach(([key, value]) => {
          const id = Number(key);
          if (!Number.isNaN(id)) next[id] = Boolean(value);
        });
        setCollapsedCategories(next);
      } catch {
        // no-op
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, isSidebarCollapsed ? "1" : "0");
  }, [isSidebarCollapsed]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CATEGORY_COLLAPSED_KEY, JSON.stringify(collapsedCategories));
  }, [collapsedCategories]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    setIsContentVisible(false);
    const timer = window.setTimeout(() => setIsContentVisible(true), 20);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    return () => {
      if (navigationTimerRef.current) {
        window.clearTimeout(navigationTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    router.prefetch("/dashboard");
    for (const menu of menus) {
      if (!isNavigablePath(menu.path)) continue;
      router.prefetch(normalizeMenuPath(menu.path));
    }
  }, [menus, router]);

  const isLinkActive = (path: string): boolean => pathname === path || pathname.startsWith(`${path}/`);

  const handleLogout = async () => {
    try {
      const refreshToken = localStorage.getItem("corp_refresh_token");
      if (refreshToken) {
        await apiRequest("/api/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refresh_token: refreshToken })
        });
      }
    } catch {
      // no-op
    }

    clearTokens();
    clearCachedMe();
    clearCachedMenus();
    runtimeMenuCache = [];
    router.push("/login");
  };

  const menuStructure = useMemo(() => {
    const sorted = [...menus].sort((a, b) => (a.sort_order - b.sort_order) || (a.id - b.id));
    const categories = sorted.filter((menu) => isCategoryPath(menu.path));
    const menuItems = sorted.filter((menu) => !isCategoryPath(menu.path) && isNavigablePath(menu.path));
    const categoryIds = new Set(categories.map((menu) => menu.id));

    const uncategorized = menuItems.filter((menu) => !menu.parent_id || !categoryIds.has(menu.parent_id));
    const categorySections = categories
      .map((category) => ({
        category,
        children: menuItems.filter((menu) => menu.parent_id === category.id)
      }))
      .filter((section) => me.role === "ADMIN" || section.children.length > 0);

    return {
      uncategorized,
      categorySections,
      compactMenus: [DASHBOARD_MENU, ...menuItems]
    };
  }, [me.role, menus]);

  const toggleCategory = (categoryId: number) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  const renderLink = (menu: MenuItem, compact: boolean, onNavigate?: () => void) => {
    const Icon = menuIconMap[menu.icon ?? ""] ?? menuIconMap.BookOpenText;
    const href = normalizeMenuPath(menu.path);
    const active = href ? isLinkActive(href) : false;

    const onLinkClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
      onNavigate?.();
      if (!href || !isNavigablePath(href)) {
        event.preventDefault();
        return;
      }
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      event.preventDefault();
      if (href === pathname) return;

      setIsContentVisible(false);
      if (navigationTimerRef.current) {
        window.clearTimeout(navigationTimerRef.current);
      }
      navigationTimerRef.current = window.setTimeout(() => {
        router.push(href);
      }, CONTENT_FADE_MS);
    };

    return (
      <Link
        key={menu.id}
        href={href || "/dashboard"}
        prefetch={Boolean(href)}
        scroll={false}
        title={compact ? menu.name : undefined}
        onClick={onLinkClick}
        className={cn(
          "flex items-center rounded-lg text-sm font-medium text-textsub transition-colors hover:bg-white/5 hover:text-textmain",
          compact ? "justify-center px-2 py-2.5" : "gap-2 px-3 py-2",
          active && "bg-primary/10 text-primary"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!compact ? <span>{menu.name}</span> : null}
      </Link>
    );
  };

  const renderMenuSection = (compact: boolean, onNavigate?: () => void) => {
    if (compact) {
      return <div className="space-y-1">{menuStructure.compactMenus.map((menu) => renderLink(menu, true, onNavigate))}</div>;
    }

    return (
      <div className="space-y-3">
        <div className="space-y-1">
          {renderLink(DASHBOARD_MENU, false, onNavigate)}
          {menuStructure.uncategorized.map((menu) => renderLink(menu, false, onNavigate))}
        </div>

        {menuStructure.categorySections.map(({ category, children }) => {
          const Icon = menuIconMap[category.icon ?? ""] ?? menuIconMap.Settings;
          const isCollapsed = Boolean(collapsedCategories[category.id]);
          return (
            <div key={category.id} className="space-y-1">
              <button
                type="button"
                onClick={() => toggleCategory(category.id)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-textsub hover:bg-white/5 hover:text-textmain"
              >
                {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                <Icon className="h-3.5 w-3.5" />
                <span className="truncate">{category.name}</span>
              </button>

              <div
                className={cn(
                  "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
                  isCollapsed ? "pointer-events-none grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
                )}
              >
                <div className="overflow-hidden">
                  <div className="space-y-1 pl-4 pt-0.5">
                    {children.map((menu) => renderLink(menu, false, onNavigate))}
                    {children.length === 0 ? <p className="px-3 py-1 text-xs text-textmuted">No menu items</p> : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-bg-main text-textmain">
      <button
        type="button"
        aria-label="Close menu overlay"
        className={cn("fixed inset-0 z-40 bg-black/50 md:hidden", isMobileMenuOpen ? "block" : "hidden")}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 border-r border-border bg-surface transition-transform md:hidden",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <div>
            <p className="text-lg font-bold">Intranet</p>
            <p className="text-xs text-textsub">Corporate System</p>
          </div>
          <button
            type="button"
            aria-label="Close menu"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-textsub"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex h-[calc(100%-8rem)] flex-col overflow-y-auto p-4">{renderMenuSection(false, () => setIsMobileMenuOpen(false))}</nav>

        <div className="border-t border-border p-4">
          <p className="truncate text-sm font-semibold">{me.username}</p>
          <p className="truncate text-xs text-textsub">{me.email}</p>
          <Button variant="outline" className="mt-2 w-full justify-start" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      <aside
        className={cn(
          "hidden border-r border-border bg-surface transition-[width] duration-200 md:flex md:flex-col",
          isSidebarCollapsed ? "md:w-20" : "md:w-64"
        )}
      >
        <div className={cn("flex h-16 items-center border-b border-border", isSidebarCollapsed ? "justify-center px-2" : "px-5")}>
          <div className={cn("flex items-center", isSidebarCollapsed ? "justify-center" : "gap-2")}>
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <LayoutDashboard className="h-4 w-4" />
            </div>
            {!isSidebarCollapsed ? (
              <div>
                <p className="text-lg font-bold">Intranet</p>
                <p className="text-xs text-textsub">Corporate System</p>
              </div>
            ) : null}
          </div>
        </div>

        <nav className={cn("flex-1 overflow-y-auto", isSidebarCollapsed ? "p-2" : "p-4")}>{renderMenuSection(isSidebarCollapsed)}</nav>

        <div className={cn("border-t border-border", isSidebarCollapsed ? "p-2" : "p-4")}>
          {isSidebarCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-bg-main text-xs font-semibold text-textmain">
                {me.username.slice(0, 1).toUpperCase()}
              </div>
              <Button variant="outline" className="h-8 w-8 p-0" onClick={handleLogout} title="Logout">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <p className="truncate text-sm font-semibold">{me.username}</p>
              <p className="truncate text-xs text-textsub">{me.email}</p>
              <Button variant="outline" className="mt-2 w-full justify-start" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </>
          )}
        </div>
      </aside>

      <main className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-10 h-16 border-b border-border bg-surface px-5">
          <div className="flex h-full items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <button
                type="button"
                aria-label="Open menu"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-textsub md:hidden"
                onClick={() => setIsMobileMenuOpen(true)}
              >
                <Menu className="h-4 w-4" />
              </button>

              <button
                type="button"
                aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="hidden h-9 w-9 items-center justify-center rounded-md border border-border text-textsub md:inline-flex"
                onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              >
                {isSidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </button>

              <div className="relative w-full max-w-md">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-textsub" />
                <input
                  placeholder="Global search..."
                  className="h-9 w-full rounded-lg border border-border bg-bg-main pl-9 pr-3 text-sm text-textmain outline-none placeholder:text-textsub/70 focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-textsub">
              <ThemeToggle />
              <button
                type="button"
                aria-label="Notifications"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface hover:bg-white/5"
              >
                <Bell className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        <div className={cn("flex-1 p-5 transition-opacity duration-200 md:p-8", isContentVisible ? "opacity-100" : "opacity-0")}>
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {description ? <p className="mt-1 text-sm text-textsub">{description}</p> : null}
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
