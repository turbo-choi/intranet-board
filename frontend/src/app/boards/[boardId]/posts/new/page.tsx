"use client";

import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/api-client";
import type { Board, PostDetail } from "@/lib/types";

export default function NewPostPage() {
  const { me } = useAuth();
  const { success } = useToast();
  const router = useRouter();
  const params = useParams<{ boardId: string }>();
  const boardId = Number(params.boardId);

  const [board, setBoard] = useState<Board | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [qnaStatus, setQnaStatus] = useState("OPEN");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const canPin = me?.role === "ADMIN" || me?.role === "MANAGER";

  useEffect(() => {
    if (!me || !boardId) return;
    apiRequest<Board>(`/api/boards/${boardId}`).then(setBoard).catch(() => router.push("/dashboard"));
  }, [boardId, me, router]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!board) return;

    setSubmitting(true);
    setError("");
    try {
      const post = await apiRequest<PostDetail>(`/api/boards/${boardId}/posts`, {
        method: "POST",
        body: JSON.stringify({
          title,
          content,
          is_pinned: canPin ? isPinned : false,
          qna_status: board.board_type === "QNA" ? qnaStatus : null
        })
      });

      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        await apiRequest(`/api/posts/${post.id}/attachments`, {
          method: "POST",
          body: formData
        });
      }

      success("저장되었습니다.");
      router.push(`/boards/${boardId}/posts/${post.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create post");
    } finally {
      setSubmitting(false);
    }
  };

  if (!me) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <AppShell me={me} title={`Write: ${board?.name ?? "Board"}`} description="Create a new post with optional attachments.">
      {!board ? (
        <Card>
          <CardContent>
            <p className="text-sm text-textsub">Loading board...</p>
          </CardContent>
        </Card>
      ) : (
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">New Post</h2>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="mb-1 block text-sm font-medium">Title</label>
              <Input required value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Content</label>
              <Textarea required value={content} onChange={(e) => setContent(e.target.value)} />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {canPin ? (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isPinned}
                    onChange={(e) => setIsPinned(e.target.checked)}
                    className="h-4 w-4 rounded border-border bg-bg-main accent-primary"
                  />
                  Pin this post
                </label>
              ) : (
                <div />
              )}

              {board.board_type === "QNA" ? (
                <div>
                  <label className="mb-1 block text-sm font-medium">Q&A Status</label>
                  <Select value={qnaStatus} onChange={(e) => setQnaStatus(e.target.value)}>
                    <option value="OPEN">OPEN</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="ANSWERED">ANSWERED</option>
                  </Select>
                </div>
              ) : null}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Attachments</label>
              <Input
                type="file"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
              <p className="mt-1 text-xs text-textsub">Allowed: docs/images/zip, max 20MB each.</p>
            </div>

            {error ? <p className="text-sm text-red-400">{error}</p> : null}

            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Create Post"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push(`/boards/${boardId}`)}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      )}
    </AppShell>
  );
}
