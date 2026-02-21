"use client";

import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/api-client";
import type { RoleCode, RoleMatrixMenu, RoleMatrixResponse } from "@/lib/types";

const SYSTEM_PERMISSIONS = [
  "MANAGE_BOARDS",
  "MANAGE_MENUS",
  "MANAGE_USERS",
  "MANAGE_ROLES",
  "MODERATE_CONTENT"
] as const;

export default function AdminRolesPage() {
  const { me } = useAuth(["ADMIN"]);
  const { success } = useToast();
  const [matrix, setMatrix] = useState<RoleMatrixResponse | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!me) return;
    apiRequest<RoleMatrixResponse>("/api/admin/roles/matrix")
      .then(setMatrix)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load role matrix"));
  }, [me]);

  const roleCodes = useMemo(() => matrix?.roles.map((role) => role.role_code) ?? [], [matrix]);

  const toggleSystemPermission = (roleCode: RoleCode, permission: string) => {
    if (!matrix) return;
    setMatrix({
      ...matrix,
      roles: matrix.roles.map((role) => {
        if (role.role_code !== roleCode) return role;
        const permissions = new Set(role.system_permissions);
        if (permissions.has(permission)) permissions.delete(permission);
        else permissions.add(permission);
        return { ...role, system_permissions: Array.from(permissions) };
      })
    });
  };

  const toggleMenuRole = (menuId: number, roleCode: RoleCode, target: "read" | "write") => {
    if (!matrix) return;
    setMatrix({
      ...matrix,
      menus: matrix.menus.map((menu) => {
        if (menu.menu_id !== menuId) return menu;
        const readSet = new Set(menu.read_roles);
        const writeSet = new Set(menu.write_roles);

        if (target === "write") {
          if (writeSet.has(roleCode)) {
            writeSet.delete(roleCode);
          } else {
            writeSet.add(roleCode);
            readSet.add(roleCode);
          }
        } else {
          if (readSet.has(roleCode)) {
            readSet.delete(roleCode);
            writeSet.delete(roleCode);
          } else {
            readSet.add(roleCode);
          }
        }

        return {
          ...menu,
          read_roles: roleCodes.filter((code) => readSet.has(code)),
          write_roles: roleCodes.filter((code) => writeSet.has(code))
        };
      })
    });
  };

  const saveMatrix = async () => {
    if (!matrix) return;
    setSaving(true);
    setError("");
    try {
      const saved = await apiRequest<RoleMatrixResponse>("/api/admin/roles/matrix", {
        method: "PUT",
        body: JSON.stringify(matrix)
      });
      setMatrix(saved);
      success("저장되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save matrix");
    } finally {
      setSaving(false);
    }
  };

  if (!me) {
    return <div className="p-8">Loading...</div>;
  }

  const menus: RoleMatrixMenu[] = matrix?.menus ?? [];

  return (
    <AppShell
      me={me}
      title="Roles & Permissions"
      description="Centralized permission management. Configure system and menu access per role."
    >
      {!matrix ? (
        <Card>
          <CardContent>
            <p className="text-sm text-textsub">Loading role matrix...</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <h2 className="text-lg font-semibold">System Permission Matrix</h2>
              <Button onClick={saveMatrix} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <TR>
                      <TH>Role</TH>
                      {SYSTEM_PERMISSIONS.map((permission) => (
                        <TH key={permission}>{permission}</TH>
                      ))}
                    </TR>
                  </THead>
                  <TBody>
                    {matrix.roles.map((role) => (
                      <TR key={role.role_code}>
                        <TD>{role.role_name}</TD>
                        {SYSTEM_PERMISSIONS.map((permission) => (
                          <TD key={`${role.role_code}-${permission}`}>
                            <input
                              type="checkbox"
                              checked={role.system_permissions.includes(permission)}
                              className="accent-primary"
                              onChange={() => toggleSystemPermission(role.role_code, permission)}
                              disabled={role.role_code === "ADMIN" && permission === "MANAGE_ROLES"}
                            />
                          </TD>
                        ))}
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <h2 className="text-lg font-semibold">Menu Access Matrix</h2>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <TR>
                      <TH>Menu</TH>
                      {matrix.roles.map((role) => (
                        <TH key={`${role.role_code}-read`}>{role.role_code} Read</TH>
                      ))}
                      {matrix.roles.map((role) => (
                        <TH key={`${role.role_code}-write`}>{role.role_code} Write</TH>
                      ))}
                    </TR>
                  </THead>
                  <TBody>
                    {menus.map((menu) => (
                      <TR key={menu.menu_id}>
                        <TD>
                          <div className="text-xs text-textsub">{menu.category_name ?? "Uncategorized"}</div>
                          <div className="mt-1 font-medium">
                            {menu.menu_name}
                            <span className="ml-2 text-xs font-normal text-textsub">{menu.menu_path}</span>
                          </div>
                        </TD>
                        {matrix.roles.map((role) => (
                          <TD key={`${menu.menu_id}-${role.role_code}-read`}>
                            <input
                              type="checkbox"
                              checked={menu.read_roles.includes(role.role_code)}
                              className="accent-primary"
                              onChange={() => toggleMenuRole(menu.menu_id, role.role_code, "read")}
                            />
                          </TD>
                        ))}
                        {matrix.roles.map((role) => (
                          <TD key={`${menu.menu_id}-${role.role_code}-write`}>
                            <input
                              type="checkbox"
                              checked={menu.write_roles.includes(role.role_code)}
                              className="accent-primary"
                              onChange={() => toggleMenuRole(menu.menu_id, role.role_code, "write")}
                            />
                          </TD>
                        ))}
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
    </AppShell>
  );
}
