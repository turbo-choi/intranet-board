"use client";

import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import type { Board, PostListResponse } from "@/lib/types";

export default function BoardListPage() {
  const { me } = useAuth();
  const params = useParams<{ boardId: string }>();
  const boardId = Number(params.boardId);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [board, setBoard] = useState<Board | null>(null);
  const [postData, setPostData] = useState<PostListResponse | null>(null);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [sortBy, setSortBy] = useState(searchParams.get("sortBy") ?? "created_at");
  const [sortOrder, setSortOrder] = useState(searchParams.get("sortOrder") ?? "desc");
  const [qnaStatus, setQnaStatus] = useState(searchParams.get("qnaStatus") ?? "");
  const page = Number(searchParams.get("page") ?? "1");

  const queryString = useMemo(() => {
    const query = new URLSearchParams();
    query.set("page", String(page));
    query.set("page_size", "10");
    query.set("sort_by", sortBy);
    query.set("sort_order", sortOrder);
    if (search) query.set("search", search);
    if (qnaStatus) query.set("qna_status", qnaStatus);
    return query.toString();
  }, [page, qnaStatus, search, sortBy, sortOrder]);

  useEffect(() => {
    if (!me || !boardId) return;
    apiRequest<Board>(`/api/boards/${boardId}`).then(setBoard).catch(() => router.push("/dashboard"));
  }, [boardId, me, router]);

  useEffect(() => {
    if (!me || !boardId) return;
    apiRequest<PostListResponse>(`/api/boards/${boardId}/posts?${queryString}`).then(setPostData).catch(() => undefined);
  }, [boardId, me, queryString]);

  if (!me) {
    return <div className="p-8">Loading...</div>;
  }

  const totalPages = postData ? Math.max(1, Math.ceil(postData.total / postData.page_size)) : 1;

  const applyFilter = () => {
    const query = new URLSearchParams();
    query.set("page", "1");
    if (search) query.set("search", search);
    if (qnaStatus) query.set("qnaStatus", qnaStatus);
    query.set("sortBy", sortBy);
    query.set("sortOrder", sortOrder);
    router.push(`/boards/${boardId}?${query.toString()}`);
  };

  const movePage = (nextPage: number) => {
    const query = new URLSearchParams(searchParams.toString());
    query.set("page", String(nextPage));
    router.push(`/boards/${boardId}?${query.toString()}`);
  };

  return (
    <AppShell me={me} title={board?.name ?? "Board"} description={board?.description ?? "Board posts"}>
      {!board ? (
        <Card>
          <CardContent>
            <p className="text-sm text-textsub">Loading board...</p>
          </CardContent>
        </Card>
      ) : (
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="grid w-full gap-2 md:max-w-3xl md:grid-cols-4">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title/content" />
            <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="created_at">Created</option>
              <option value="updated_at">Updated</option>
              <option value="view_count">Views</option>
              <option value="title">Title</option>
            </Select>
            <Select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </Select>
            {board?.board_type === "QNA" ? (
              <Select value={qnaStatus} onChange={(e) => setQnaStatus(e.target.value)}>
                <option value="">All Q&A Status</option>
                <option value="OPEN">OPEN</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="ANSWERED">ANSWERED</option>
              </Select>
            ) : (
              <Button variant="outline" onClick={applyFilter}>
                Apply Filter
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={applyFilter}>
              Search
            </Button>
            <Link href={`/boards/${boardId}/posts/new`}>
              <Button>Write Post</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH className="w-14">ID</TH>
                  <TH>Title</TH>
                  <TH className="w-36">Author</TH>
                  <TH className="w-36">Date</TH>
                  <TH className="w-16 text-right">Likes</TH>
                  <TH className="w-16 text-right">Replies</TH>
                  <TH className="w-16 text-right">Views</TH>
                </TR>
              </THead>
              <TBody>
                {postData?.items.map((item) => (
                  <TR key={item.id} className={item.is_pinned ? "bg-warning/10" : ""}>
                    <TD>{item.id}</TD>
                    <TD>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/boards/${boardId}/posts/${item.id}`} className="font-medium text-textmain hover:text-primary">
                          {item.title}
                        </Link>
                        {item.is_pinned ? <Badge variant="warning" className="px-2.5 py-1 font-bold tracking-wide">PINNED</Badge> : null}
                        {item.qna_status ? (
                          <Badge variant={item.qna_status === "ANSWERED" ? "success" : "default"}>{item.qna_status}</Badge>
                        ) : null}
                      </div>
                    </TD>
                    <TD className="truncate">{item.author_name}</TD>
                    <TD className="whitespace-nowrap">{formatDate(item.created_at)}</TD>
                    <TD className="text-right tabular-nums">{item.like_count}</TD>
                    <TD className="text-right tabular-nums">{item.comment_count}</TD>
                    <TD className="text-right tabular-nums">{item.view_count}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-textsub">
            <p>
              Page {postData?.page ?? 1} / {totalPages} (Total {postData?.total ?? 0})
            </p>
            <div className="flex gap-2">
              <Button variant="outline" disabled={page <= 1} onClick={() => movePage(page - 1)}>
                Prev
              </Button>
              <Button variant="outline" disabled={page >= totalPages} onClick={() => movePage(page + 1)}>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      )}
    </AppShell>
  );
}
