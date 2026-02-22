"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/api-client";
import type { Board } from "@/lib/types";

interface Summary {
  board_count: number;
  post_count: number;
}

export default function DashboardPage() {
  const { me } = useAuth();
  const [summary, setSummary] = useState<Summary>({ board_count: 0, post_count: 0 });
  const [boards, setBoards] = useState<Board[]>([]);

  useEffect(() => {
    if (!me) return;
    apiRequest<Summary>("/api/dashboard/summary").then(setSummary).catch(() => undefined);
    apiRequest<Board[]>("/api/boards").then(setBoards).catch(() => undefined);
  }, [me]);

  if (!me) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <AppShell me={me} title="Dashboard" description="Overview of board activities and quick navigation.">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <p className="text-sm font-medium text-textsub">Accessible Boards</p>
            <p className="text-2xl font-bold">{summary.board_count}</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <p className="text-sm font-medium text-textsub">Visible Posts</p>
            <p className="text-2xl font-bold">{summary.post_count}</p>
          </CardHeader>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <h2 className="text-lg font-semibold">Boards</h2>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {boards.map((board) => (
              <Link key={board.id} href={`/boards/${board.id}`} className="rounded-lg border border-border p-4 hover:bg-white/5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{board.name}</h3>
                  {board.board_type === "QNA" ? <Badge>Q&A</Badge> : null}
                </div>
                <p className="mt-1 text-sm text-textsub">{board.description}</p>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
