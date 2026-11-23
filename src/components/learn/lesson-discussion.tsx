"use client";

import { useMemo, useState } from "react";
import { query, where } from "firebase/firestore";
import { CheckCircle2, CircleHelp, MessageCircle, MoreHorizontal, Pencil, Reply, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useProfile } from "@/components/providers/auth-provider";
import { useCollection } from "@/hooks/use-firestore";
import { refs } from "@/lib/services/refs";
import { deleteDiscussion, editDiscussion, postDiscussion, setResolved } from "@/lib/services/discussions";
import { getErrorMessage } from "@/lib/errors";
import { cn, timeAgo, toDate } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Course, DiscussionPost, Lesson, WithId } from "@/types";

type Post = WithId<DiscussionPost>;

function Composer({
  placeholder,
  submitLabel,
  onSubmit,
  autoFocus,
  onCancel,
  initial = "",
}: {
  placeholder: string;
  submitLabel: string;
  onSubmit: (body: string) => Promise<void>;
  autoFocus?: boolean;
  onCancel?: () => void;
  initial?: string;
}) {
  const [body, setBody] = useState(initial);
  const [busy, setBusy] = useState(false);
  return (
    <form
      method="post"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!body.trim()) return;
        setBusy(true);
        try {
          await onSubmit(body);
          setBody("");
        } catch (error) {
          toast.error(getErrorMessage(error));
        } finally {
          setBusy(false);
        }
      }}
      className="space-y-2"
    >
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={4000}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={autoFocus}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
        }}
      />
      <div className="flex items-center justify-end gap-2">
        <span className="mr-auto hidden text-xs text-slate-400 sm:inline">Ctrl + Enter to send</span>
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="sm" loading={busy} disabled={!body.trim()}>
          <Send /> {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function PostView({
  post,
  course,
  canModerate,
  onReply,
  onDelete,
  isReply = false,
}: {
  post: Post;
  course: WithId<Course>;
  canModerate: boolean;
  onReply?: () => void;
  onDelete: (p: Post) => void;
  isReply?: boolean;
}) {
  const profile = useProfile();
  const [editing, setEditing] = useState(false);
  const mine = post.authorId === profile.uid;
  const staffAuthor = post.authorRole !== "student";

  return (
    <div className="flex gap-3">
      <Avatar name={post.authorName} size={isReply ? "xs" : "sm"} className={isReply ? "mt-1" : ""} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-semibold text-slate-900">{post.authorName}</span>
          {staffAuthor && <Badge tone="brand">Instructor</Badge>}
          {!isReply && post.resolved && (
            <Badge tone="success" dot>
              Answered
            </Badge>
          )}
          <span className="text-xs text-slate-400">
            {timeAgo(post.createdAt)}
            {post.updatedAt && toDate(post.updatedAt)!.getTime() - (toDate(post.createdAt)?.getTime() ?? 0) > 5000 && " · edited"}
          </span>
          {(mine || canModerate) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="ml-auto rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Post actions">
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {!isReply && (
                  <DropdownMenuItem onSelect={() => setResolved(course.id, post.id, !post.resolved).catch((e) => toast.error(getErrorMessage(e)))}>
                    <CheckCircle2 /> {post.resolved ? "Mark as unanswered" : "Mark as answered"}
                  </DropdownMenuItem>
                )}
                {mine && (
                  <DropdownMenuItem onSelect={() => setEditing(true)}>
                    <Pencil /> Edit
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem destructive onSelect={() => onDelete(post)}>
                  <Trash2 /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {editing ? (
          <div className="mt-2">
            <Composer
              initial={post.body}
              placeholder="Edit your post"
              submitLabel="Save"
              autoFocus
              onCancel={() => setEditing(false)}
              onSubmit={async (body) => {
                await editDiscussion(course.id, post.id, body);
                setEditing(false);
              }}
            />
          </div>
        ) : (
          <p className="mt-1 text-sm leading-relaxed break-words whitespace-pre-wrap text-slate-700">{post.body}</p>
        )}
        {onReply && !editing && (
          <button type="button" onClick={onReply} className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-brand-700">
            <Reply className="size-3.5" /> Reply
          </button>
        )}
      </div>
    </div>
  );
}

export function LessonDiscussion({
  course,
  lesson,
  canModerate,
}: {
  course: WithId<Course>;
  lesson: WithId<Lesson>;
  canModerate: boolean;
}) {
  const profile = useProfile();
  const q = useMemo(() => query(refs.discussions(course.id), where("lessonId", "==", lesson.id)), [course.id, lesson.id]);
  const { data, loading } = useCollection<DiscussionPost>(q);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Post | null>(null);
  const [filter, setFilter] = useState<"all" | "open">("all");

  const threads = useMemo(() => {
    const byTime = (a: Post, b: Post) => (toDate(a.createdAt)?.getTime() ?? 0) - (toDate(b.createdAt)?.getTime() ?? 0);
    const roots = data.filter((p) => !p.parentId).sort((a, b) => byTime(b, a));
    return roots.map((root) => ({ root, replies: data.filter((p) => p.parentId === root.id).sort(byTime) }));
  }, [data]);
  const visible = filter === "open" ? threads.filter((t) => !t.root.resolved) : threads;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-surface p-4">
        <div className="mb-3 flex items-center gap-2">
          <CircleHelp className="size-4 text-brand-600" />
          <p className="text-sm font-medium text-slate-800">
            {profile.role === "student" ? "Stuck? Ask your instructor and classmates" : "Start a discussion"}
          </p>
        </div>
        <Composer
          placeholder="Ask a question about this lesson…"
          submitLabel="Post question"
          onSubmit={(body) => postDiscussion({ course, lessonId: lesson.id, lessonTitle: lesson.title, body, author: profile })}
        />
      </div>

      {threads.length > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-slate-700">{threads.length} {threads.length === 1 ? "question" : "questions"}</span>
          <div className="ml-auto inline-flex rounded-lg bg-slate-100 p-0.5">
            {(["all", "open"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium",
                  filter === f ? "bg-surface text-slate-900 shadow-sm" : "text-slate-500",
                )}
              >
                {f === "all" ? "All" : "Unanswered"}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <Skeleton className="h-24 w-full" />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title={threads.length ? "No unanswered questions" : "No questions yet"}
          description={threads.length ? undefined : "Be the first to ask — questions help everyone learn."}
          className="py-8"
        />
      ) : (
        <ul className="space-y-4">
          {visible.map(({ root, replies }) => (
            <li key={root.id} className="rounded-xl border border-slate-200 bg-surface p-4">
              <PostView
                post={root}
                course={course}
                canModerate={canModerate}
                onReply={() => setReplyTo(replyTo === root.id ? null : root.id)}
                onDelete={setDeleting}
              />
              {(replies.length > 0 || replyTo === root.id) && (
                <div className="mt-4 space-y-4 border-l-2 border-slate-100 pl-4 sm:ml-11">
                  {replies.map((r) => (
                    <PostView key={r.id} post={r} course={course} canModerate={canModerate} onDelete={setDeleting} isReply />
                  ))}
                  {replyTo === root.id && (
                    <Composer
                      placeholder={`Reply to ${root.authorName}…`}
                      submitLabel="Reply"
                      autoFocus
                      onCancel={() => setReplyTo(null)}
                      onSubmit={async (body) => {
                        await postDiscussion({
                          course,
                          lessonId: lesson.id,
                          lessonTitle: lesson.title,
                          body,
                          author: profile,
                          parent: root,
                        });
                        setReplyTo(null);
                      }}
                    />
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this post?"
        description="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (deleting) await deleteDiscussion(course.id, deleting.id);
        }}
      />
    </div>
  );
}
