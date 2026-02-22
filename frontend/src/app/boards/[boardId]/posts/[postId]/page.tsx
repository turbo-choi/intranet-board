"use client";

import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/use-auth";
import { apiDownload, apiRequest } from "@/lib/api-client";
import { formatBytes, formatDate } from "@/lib/format";
import type { Board, CommentItem, PostDetail } from "@/lib/types";

export default function PostDetailPage() {
  const { me } = useAuth();
  const { success } = useToast();
  const router = useRouter();
  const params = useParams<{ boardId: string; postId: string }>();

  const boardId = Number(params.boardId);
  const postId = Number(params.postId);

  const [board, setBoard] = useState<Board | null>(null);
  const [post, setPost] = useState<PostDetail | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentText, setCommentText] = useState("");
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editPinned, setEditPinned] = useState(false);
  const [editQnaStatus, setEditQnaStatus] = useState("OPEN");
  const [error, setError] = useState("");
  const [likeLoading, setLikeLoading] = useState(false);

  const loadData = useCallback(async () => {
    const [boardRes, postRes, commentRes] = await Promise.all([
      apiRequest<Board>(`/api/boards/${boardId}`),
      apiRequest<PostDetail>(`/api/boards/${boardId}/posts/${postId}`),
      apiRequest<CommentItem[]>(`/api/posts/${postId}/comments`)
    ]);

    setBoard(boardRes);
    setPost(postRes);
    setComments(commentRes);
    setEditTitle(postRes.title);
    setEditContent(postRes.content);
    setEditPinned(postRes.is_pinned);
    setEditQnaStatus(postRes.qna_status ?? "OPEN");
  }, [boardId, postId]);

  useEffect(() => {
    if (!me?.id || !boardId || !postId) return;
    loadData().catch(() => router.push(`/boards/${boardId}`));
  }, [boardId, loadData, me?.id, postId, router]);

  const canEditPost = useMemo(() => {
    if (!me || !post) return false;
    return post.author_id === me.id || me.role === "ADMIN" || me.role === "MANAGER";
  }, [me, post]);
  const canPin = useMemo(() => me?.role === "ADMIN" || me?.role === "MANAGER", [me]);

  const addComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      await apiRequest<CommentItem>(`/api/posts/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify({ content: commentText })
      });
      setCommentText("");
      const commentRes = await apiRequest<CommentItem[]>(`/api/posts/${postId}/comments`);
      setComments(commentRes);
      setPost((prev) => (prev ? { ...prev, comment_count: commentRes.length } : prev));
      success("저장되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add comment");
    }
  };

  const updateComment = async (comment: CommentItem) => {
    const content = prompt("Edit comment", comment.content);
    if (!content || content === comment.content) return;
    try {
      await apiRequest<CommentItem>(`/api/comments/${comment.id}`, {
        method: "PATCH",
        body: JSON.stringify({ content })
      });
      setComments((prev) => prev.map((item) => (item.id === comment.id ? { ...item, content } : item)));
      success("저장되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update comment");
    }
  };

  const deleteComment = async (commentId: number) => {
    if (!confirm("Delete this comment?")) return;
    try {
      await apiRequest(`/api/comments/${commentId}`, { method: "DELETE" });
      const next = comments.filter((comment) => comment.id !== commentId);
      setComments(next);
      setPost((prev) => (prev ? { ...prev, comment_count: next.length } : prev));
      success("삭제되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete comment");
    }
  };

  const updatePost = async (e: FormEvent) => {
    e.preventDefault();
    if (!post) return;
    try {
      const payload: Record<string, unknown> = {
        title: editTitle,
        content: editContent,
        qna_status: board?.board_type === "QNA" ? editQnaStatus : null
      };
      if (canPin) {
        payload.is_pinned = editPinned;
      }
      const updated = await apiRequest<PostDetail>(`/api/boards/${boardId}/posts/${post.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      setPost(updated);
      setEditing(false);
      success("저장되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update post");
    }
  };

  const deletePost = async () => {
    if (!post || !confirm("Delete this post?")) return;
    try {
      await apiRequest(`/api/boards/${boardId}/posts/${post.id}`, { method: "DELETE" });
      success("삭제되었습니다.");
      router.push(`/boards/${boardId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete post");
    }
  };

  const downloadAttachment = async (attachmentId: number, fileName: string) => {
    try {
      const blob = await apiDownload(`/api/attachments/${attachmentId}/download`);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    }
  };

  const toggleLike = async () => {
    if (!post) return;
    setLikeLoading(true);
    try {
      const response = await apiRequest<{ liked: boolean; like_count: number }>(`/api/posts/${post.id}/like`, {
        method: "POST"
      });
      setPost((prev) =>
        prev
          ? {
              ...prev,
              liked_by_me: response.liked,
              like_count: response.like_count
            }
          : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle like");
    } finally {
      setLikeLoading(false);
    }
  };

  if (!me) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <AppShell
      me={me}
      title={post?.title ?? "Post"}
      description={post ? `By ${post.author_name} · ${formatDate(post.created_at)}` : "Loading post..."}
    >
      {!board || !post ? (
        <Card>
          <CardContent>
            <p className="text-sm text-textsub">Loading post...</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  {post.is_pinned ? <Badge variant="warning" className="px-2.5 py-1 font-bold tracking-wide">PINNED</Badge> : null}
                  {post.qna_status ? <Badge variant={post.qna_status === "ANSWERED" ? "success" : "default"}>{post.qna_status}</Badge> : null}
                </div>
                <p className="mt-1 text-sm text-textsub">
                  Views: {post.view_count} · Likes: {post.like_count} · Replies: {post.comment_count}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant={post.liked_by_me ? "default" : "outline"} onClick={toggleLike} disabled={likeLoading}>
                  {post.liked_by_me ? "Unlike" : "Like"} ({post.like_count})
                </Button>
                {canEditPost ? (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setEditing((prev) => !prev)}>
                    {editing ? "Cancel Edit" : "Edit"}
                  </Button>
                  <Button variant="danger" onClick={deletePost}>
                    Delete
                  </Button>
                </div>
                ) : null}
              </div>
            </CardHeader>

            <CardContent>
              {editing ? (
                <form className="space-y-3" onSubmit={updatePost}>
                  <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
                  <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} required />
                  {canPin ? (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editPinned}
                        onChange={(e) => setEditPinned(e.target.checked)}
                        className="h-4 w-4 rounded border-border bg-bg-main accent-primary"
                      />
                      Pinned
                    </label>
                  ) : null}
                  {board.board_type === "QNA" ? (
                    <Select value={editQnaStatus} onChange={(e) => setEditQnaStatus(e.target.value)}>
                      <option value="OPEN">OPEN</option>
                      <option value="IN_PROGRESS">IN_PROGRESS</option>
                      <option value="ANSWERED">ANSWERED</option>
                    </Select>
                  ) : null}
                  <Button type="submit">Save Changes</Button>
                </form>
              ) : (
                <article className="whitespace-pre-wrap text-sm leading-relaxed">{post.content}</article>
              )}

              {post.attachments.length > 0 ? (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold">Attachments</h3>
                  <div className="mt-2 space-y-2">
                    {post.attachments.map((attachment) => (
                      <button
                        key={attachment.id}
                        className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-white/5"
                        onClick={() => downloadAttachment(attachment.id, attachment.original_name)}
                      >
                        <span>{attachment.original_name}</span>
                        <span className="text-textsub">{formatBytes(attachment.size_bytes)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <h3 className="text-lg font-semibold">Comments ({post.comment_count})</h3>
            </CardHeader>
            <CardContent>
              <form className="mb-4 flex gap-2" onSubmit={addComment}>
                <Input placeholder="Write a comment..." value={commentText} onChange={(e) => setCommentText(e.target.value)} />
                <Button type="submit">Add</Button>
              </form>
              <div className="space-y-3">
                {comments.map((comment) => {
                  const canEdit = comment.author_id === me.id || me.role === "ADMIN" || me.role === "MANAGER";
                  return (
                    <div key={comment.id} className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{comment.author_name}</p>
                        <p className="text-xs text-textsub">{formatDate(comment.created_at)}</p>
                      </div>
                      <p className="mt-1 text-sm">{comment.content}</p>
                      {canEdit ? (
                        <div className="mt-2 flex gap-2">
                          <Button variant="outline" className="h-8 px-3 py-1 text-xs" onClick={() => updateComment(comment)}>
                            Edit
                          </Button>
                          <Button variant="danger" className="h-8 px-3 py-1 text-xs" onClick={() => deleteComment(comment.id)}>
                            Delete
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
            </CardContent>
          </Card>
        </>
      )}
    </AppShell>
  );
}
