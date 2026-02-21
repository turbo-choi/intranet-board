"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/api-client";
import { MENU_ICON_OPTIONS } from "@/lib/menu-icons";
import type { MenuItem } from "@/lib/types";

const CATEGORY_PATH = "__category__";
const MENU_ICON_SET = new Set<string>(MENU_ICON_OPTIONS);

function isCategory(menu: MenuItem): boolean {
  return menu.path === CATEGORY_PATH;
}

function renderIconOptions(currentIcon?: string | null) {
  const value = (currentIcon ?? "").trim();

  return (
    <>
      <option value="">None</option>
      {value && !MENU_ICON_SET.has(value) ? <option value={value}>{value} (custom)</option> : null}
      {MENU_ICON_OPTIONS.map((iconName) => (
        <option key={iconName} value={iconName}>
          {iconName}
        </option>
      ))}
    </>
  );
}

export default function AdminMenusPage() {
  const { me } = useAuth(["ADMIN"]);
  const { success, error: showError } = useToast();
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [error, setError] = useState("");

  const [categoryName, setCategoryName] = useState("");
  const [categoryIcon, setCategoryIcon] = useState("Settings");
  const [categorySortOrder, setCategorySortOrder] = useState(10);

  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [icon, setIcon] = useState("");
  const [sortOrder, setSortOrder] = useState(10);
  const [parentCategoryId, setParentCategoryId] = useState("");

  const loadMenus = () => {
    setError("");
    apiRequest<MenuItem[]>("/api/admin/menus")
      .then((items) => {
        const sorted = [...items].sort((a, b) => (a.sort_order - b.sort_order) || (a.id - b.id));
        setMenus(sorted);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load menus"));
  };

  useEffect(() => {
    if (!me) return;
    loadMenus();
  }, [me]);

  const categories = useMemo(() => menus.filter(isCategory), [menus]);
  const menuItems = useMemo(() => menus.filter((menu) => !isCategory(menu)), [menus]);

  const updateLocalMenu = (menuId: number, patch: Partial<MenuItem>) => {
    setMenus((prev) => prev.map((item) => (item.id === menuId ? { ...item, ...patch } : item)));
  };

  const createCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) return;
    setError("");
    try {
      await apiRequest<MenuItem>("/api/admin/menus", {
        method: "POST",
        body: JSON.stringify({
          name: categoryName.trim(),
          path: CATEGORY_PATH,
          icon: categoryIcon.trim() || null,
          sort_order: categorySortOrder,
          parent_id: null,
          board_id: null,
          is_active: true
        })
      });
      setCategoryName("");
      setCategoryIcon("Settings");
      loadMenus();
      success("저장되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create category");
    }
  };

  const createMenu = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !path.trim()) return;
    setError("");
    try {
      await apiRequest<MenuItem>("/api/admin/menus", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          path: path.trim(),
          icon: icon.trim() || null,
          sort_order: sortOrder,
          parent_id: parentCategoryId ? Number(parentCategoryId) : null,
          board_id: null,
          is_active: true
        })
      });
      setName("");
      setPath("");
      setIcon("");
      setParentCategoryId("");
      loadMenus();
      success("저장되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create menu");
    }
  };

  const saveMenu = async (menu: MenuItem) => {
    setError("");
    try {
      await apiRequest<MenuItem>(`/api/admin/menus/${menu.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: menu.name,
          path: menu.path,
          icon: menu.icon,
          sort_order: menu.sort_order,
          parent_id: menu.parent_id,
          is_active: menu.is_active
        })
      });
      loadMenus();
      success("저장되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save menu");
    }
  };

  const deactivateMenu = async (menu: MenuItem) => {
    const confirmed = confirm(
      isCategory(menu) ? `카테고리 "${menu.name}"를 삭제하시겠습니까?` : `Deactivate "${menu.name}"?`
    );
    if (!confirmed) return;

    setError("");
    try {
      await apiRequest(`/api/admin/menus/${menu.id}`, { method: "DELETE" });
      loadMenus();
      success("삭제되었습니다.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete menu";
      if (message.includes("사용중이라 삭제할 수 없습니다.")) {
        setError("사용중이라 삭제할 수 없습니다.");
        showError("사용중이라 삭제할 수 없습니다.");
        return;
      }
      setError(message);
      showError(message);
    }
  };

  const saveOrder = async () => {
    setError("");
    try {
      await apiRequest("/api/admin/menus/reorder", {
        method: "PUT",
        body: JSON.stringify(menus.map((menu) => ({ id: menu.id, sort_order: menu.sort_order })))
      });
      loadMenus();
      success("저장되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save order");
    }
  };

  if (!me) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <AppShell me={me} title="Menu Structure" description="Create categories, assign menus, and control display order.">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Create Category</h2>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={createCategory}>
              <Input placeholder="Category name" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} required />
              <div className="grid gap-3 sm:grid-cols-2">
                <Select value={categoryIcon} onChange={(e) => setCategoryIcon(e.target.value)}>
                  {renderIconOptions(categoryIcon)}
                </Select>
                <Input
                  type="number"
                  placeholder="Sort order"
                  value={categorySortOrder}
                  onChange={(e) => setCategorySortOrder(Number(e.target.value))}
                />
              </div>
              <Button type="submit">Create Category</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Create Menu Item</h2>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={createMenu}>
              <Input placeholder="Menu name" value={name} onChange={(e) => setName(e.target.value)} required />
              <Input placeholder="Path (e.g. /boards/1)" value={path} onChange={(e) => setPath(e.target.value)} required />
              <div className="grid gap-3 sm:grid-cols-2">
                <Select value={icon} onChange={(e) => setIcon(e.target.value)}>
                  {renderIconOptions(icon)}
                </Select>
                <Input type="number" placeholder="Sort order" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
              </div>
              <Select value={parentCategoryId} onChange={(e) => setParentCategoryId(e.target.value)}>
                <option value="">No Category</option>
                {categories.map((category) => (
                  <option key={category.id} value={String(category.id)}>
                    {category.name}
                  </option>
                ))}
              </Select>
              <Button type="submit">Create Menu</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <h2 className="text-lg font-semibold">Category List</h2>
          <Button variant="outline" onClick={saveOrder}>
            Save Sort Orders
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>ID</TH>
                  <TH>Name</TH>
                  <TH>Icon</TH>
                  <TH>Sort</TH>
                  <TH>Status</TH>
                  <TH>Action</TH>
                </TR>
              </THead>
              <TBody>
                {categories.map((category) => (
                  <TR key={category.id}>
                    <TD>{category.id}</TD>
                    <TD>
                      <Input className="h-8" value={category.name} onChange={(e) => updateLocalMenu(category.id, { name: e.target.value })} />
                    </TD>
                    <TD>
                      <Select
                        className="h-8"
                        value={category.icon ?? ""}
                        onChange={(e) => updateLocalMenu(category.id, { icon: e.target.value || null })}
                      >
                        {renderIconOptions(category.icon)}
                      </Select>
                    </TD>
                    <TD>
                      <Input
                        className="h-8"
                        type="number"
                        value={category.sort_order}
                        onChange={(e) => updateLocalMenu(category.id, { sort_order: Number(e.target.value) })}
                      />
                    </TD>
                    <TD>
                      <Select
                        className="h-8"
                        value={category.is_active ? "active" : "inactive"}
                        onChange={(e) => updateLocalMenu(category.id, { is_active: e.target.value === "active" })}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </Select>
                    </TD>
                    <TD>
                      <div className="flex gap-2">
                        <Button variant="outline" className="h-8 px-3 py-1 text-xs" onClick={() => saveMenu(category)}>
                          Save
                        </Button>
                        <Button variant="danger" className="h-8 px-3 py-1 text-xs" onClick={() => deactivateMenu(category)}>
                          Delete
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <h2 className="text-lg font-semibold">Menu Item List</h2>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>ID</TH>
                  <TH>Name</TH>
                  <TH>Path</TH>
                  <TH>Icon</TH>
                  <TH>Category</TH>
                  <TH>Sort</TH>
                  <TH>Status</TH>
                  <TH>Action</TH>
                </TR>
              </THead>
              <TBody>
                {menuItems.map((menu) => (
                  <TR key={menu.id}>
                    <TD>{menu.id}</TD>
                    <TD>
                      <Input className="h-8" value={menu.name} onChange={(e) => updateLocalMenu(menu.id, { name: e.target.value })} />
                    </TD>
                    <TD>
                      <Input className="h-8" value={menu.path} onChange={(e) => updateLocalMenu(menu.id, { path: e.target.value })} />
                    </TD>
                    <TD>
                      <Select
                        className="h-8"
                        value={menu.icon ?? ""}
                        onChange={(e) => updateLocalMenu(menu.id, { icon: e.target.value || null })}
                      >
                        {renderIconOptions(menu.icon)}
                      </Select>
                    </TD>
                    <TD>
                      <Select
                        className="h-8"
                        value={menu.parent_id ? String(menu.parent_id) : ""}
                        onChange={(e) => updateLocalMenu(menu.id, { parent_id: e.target.value ? Number(e.target.value) : null })}
                      >
                        <option value="">No Category</option>
                        {categories.map((category) => (
                          <option key={category.id} value={String(category.id)}>
                            {category.name}
                          </option>
                        ))}
                      </Select>
                    </TD>
                    <TD>
                      <Input
                        className="h-8"
                        type="number"
                        value={menu.sort_order}
                        onChange={(e) => updateLocalMenu(menu.id, { sort_order: Number(e.target.value) })}
                      />
                    </TD>
                    <TD>
                      <Select
                        className="h-8"
                        value={menu.is_active ? "active" : "inactive"}
                        onChange={(e) => updateLocalMenu(menu.id, { is_active: e.target.value === "active" })}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </Select>
                    </TD>
                    <TD>
                      <div className="flex gap-2">
                        <Button variant="outline" className="h-8 px-3 py-1 text-xs" onClick={() => saveMenu(menu)}>
                          Save
                        </Button>
                        <Button variant="danger" className="h-8 px-3 py-1 text-xs" onClick={() => deactivateMenu(menu)}>
                          Delete
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
    </AppShell>
  );
}
