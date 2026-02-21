"use client";

import { useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import type { RoleCode, UserListResponse } from "@/lib/types";

const roles: RoleCode[] = ["USER", "MANAGER", "ADMIN"];

export default function AdminUsersPage() {
  const { me } = useAuth(["ADMIN"]);
  const { success } = useToast();
  const [data, setData] = useState<UserListResponse | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  const loadUsers = () => {
    const query = new URLSearchParams({ page: String(page), page_size: "10" });
    if (search) query.set("search", search);
    apiRequest<UserListResponse>(`/api/admin/users?${query.toString()}`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load users"));
  };

  useEffect(() => {
    if (!me) return;
    loadUsers();
  }, [me, page]);

  const updateRole = async (userId: number, role: RoleCode) => {
    try {
      await apiRequest(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role_code: role })
      });
      loadUsers();
      success("저장되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Role update failed");
    }
  };

  const updateLock = async (userId: number, isLocked: boolean) => {
    try {
      await apiRequest(`/api/admin/users/${userId}/lock`, {
        method: "PATCH",
        body: JSON.stringify({ is_locked: isLocked })
      });
      loadUsers();
      success("저장되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lock update failed");
    }
  };

  if (!me) {
    return <div className="p-8">Loading...</div>;
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <AppShell me={me} title="Member List" description="Search members, change roles, and lock accounts.">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <Input
            className="max-w-sm"
            placeholder="Search username/email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button
            onClick={() => {
              setPage(1);
              loadUsers();
            }}
          >
            Search
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>ID</TH>
                  <TH>Username</TH>
                  <TH>Email</TH>
                  <TH>Role</TH>
                  <TH>Lock</TH>
                  <TH>Created</TH>
                </TR>
              </THead>
              <TBody>
                {data?.items.map((user) => (
                  <TR key={user.id}>
                    <TD>{user.id}</TD>
                    <TD>{user.username}</TD>
                    <TD>{user.email}</TD>
                    <TD>
                      <Select value={user.role} className="h-8" onChange={(e) => updateRole(user.id, e.target.value as RoleCode)}>
                        {roles.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </Select>
                    </TD>
                    <TD>
                      <Select
                        className="h-8"
                        value={user.is_locked ? "locked" : "active"}
                        onChange={(e) => updateLock(user.id, e.target.value === "locked")}
                      >
                        <option value="active">Active</option>
                        <option value="locked">Locked</option>
                      </Select>
                    </TD>
                    <TD>{formatDate(user.created_at)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-textsub">
              Page {data?.page ?? 1} / {totalPages} (Total {data?.total ?? 0})
            </p>
            <div className="flex gap-2">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
                Prev
              </Button>
              <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((prev) => prev + 1)}>
                Next
              </Button>
            </div>
          </div>

          {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
        </CardContent>
      </Card>
    </AppShell>
  );
}
