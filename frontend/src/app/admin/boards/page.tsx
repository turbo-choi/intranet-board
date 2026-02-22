"use client";

import { FormEvent, useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/api-client";
import type { Board, BoardType } from "@/lib/types";

export default function AdminBoardsPage() {
  const { me } = useAuth(["ADMIN"]);
  const { success } = useToast();
  const [boards, setBoards] = useState<Board[]>([]);
  const [error, setError] = useState("");

  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [boardType, setBoardType] = useState<BoardType>("GENERAL");
  const [sortOrder, setSortOrder] = useState(10);

  const loadBoards = () => {
    apiRequest<Board[]>("/api/admin/boards")
      .then(setBoards)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load boards"));
  };

  useEffect(() => {
    if (!me) return;
    loadBoards();
  }, [me]);

  const createBoard = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await apiRequest<Board>("/api/admin/boards", {
        method: "POST",
        body: JSON.stringify({
          key,
          name,
          description,
          board_type: boardType,
          sort_order: sortOrder
        })
      });
      setKey("");
      setName("");
      setDescription("");
      setBoardType("GENERAL");
      loadBoards();
      success("저장되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create board");
    }
  };

  const updateLocalBoard = (boardId: number, patch: Partial<Board>) => {
    setBoards((prev) => prev.map((item) => (item.id === boardId ? { ...item, ...patch } : item)));
  };

  const saveBoard = async (board: Board) => {
    setError("");
    try {
      await apiRequest<Board>(`/api/admin/boards/${board.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          key: board.key,
          name: board.name,
          description: board.description,
          board_type: board.board_type,
          sort_order: board.sort_order,
          is_active: board.is_active
        })
      });
      loadBoards();
      success("저장되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  };

  if (!me) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <AppShell me={me} title="Board Settings" description="Create boards and set board type (GENERAL/Q&A). Role permissions are managed in Roles.">
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Create Board</h2>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={createBoard}>
            <Input placeholder="Key (e.g. notice)" value={key} onChange={(e) => setKey(e.target.value)} required />
            <Input placeholder="Board name" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
            <Select value={boardType} onChange={(e) => setBoardType(e.target.value as BoardType)}>
              <option value="GENERAL">GENERAL</option>
              <option value="QNA">Q&A</option>
            </Select>
            <Input
              type="number"
              placeholder="Sort order"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
            />
            <div className="md:col-span-2">
              <Button type="submit">Create Board</Button>
            </div>
          </form>
          {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <h2 className="text-lg font-semibold">Board List</h2>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>ID</TH>
                  <TH>Key</TH>
                  <TH>Name</TH>
                  <TH>Description</TH>
                  <TH>Type</TH>
                  <TH>Sort</TH>
                  <TH>Status</TH>
                  <TH>Action</TH>
                </TR>
              </THead>
              <TBody>
                {boards.map((board) => (
                  <TR key={board.id}>
                    <TD>{board.id}</TD>
                    <TD>
                      <Input
                        className="h-8"
                        value={board.key}
                        onChange={(e) => updateLocalBoard(board.id, { key: e.target.value })}
                      />
                    </TD>
                    <TD>
                      <Input
                        className="h-8"
                        value={board.name}
                        onChange={(e) => updateLocalBoard(board.id, { name: e.target.value })}
                      />
                    </TD>
                    <TD>
                      <Input
                        className="h-8"
                        value={board.description ?? ""}
                        onChange={(e) => updateLocalBoard(board.id, { description: e.target.value })}
                      />
                    </TD>
                    <TD>
                      <Select
                        className="h-8"
                        value={board.board_type}
                        onChange={(e) => updateLocalBoard(board.id, { board_type: e.target.value as BoardType })}
                      >
                        <option value="GENERAL">GENERAL</option>
                        <option value="QNA">Q&A</option>
                      </Select>
                    </TD>
                    <TD>
                      <Input
                        className="h-8"
                        type="number"
                        value={board.sort_order}
                        onChange={(e) => updateLocalBoard(board.id, { sort_order: Number(e.target.value) })}
                      />
                    </TD>
                    <TD>
                      <Select
                        className="h-8"
                        value={board.is_active ? "active" : "inactive"}
                        onChange={(e) => updateLocalBoard(board.id, { is_active: e.target.value === "active" })}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </Select>
                    </TD>
                    <TD>
                      <Button variant="outline" className="h-8 px-3 py-1 text-xs" onClick={() => saveBoard(board)}>
                        Save
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
