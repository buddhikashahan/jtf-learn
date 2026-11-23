import { Activity } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { timeAgo } from "@/lib/utils";
import type { ActivityItem, WithId } from "@/types";

export function ActivityFeed({ items, loading }: { items: WithId<ActivityItem>[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return <EmptyState icon={Activity} title="No activity yet" description="Course activity will appear here." className="py-8" />;
  }

  return (
    <ol className="relative space-y-5">
      {items.map((item, i) => (
        <li key={item.id} className="relative flex gap-3">
          {i < items.length - 1 && <span className="absolute top-9 bottom-[-14px] left-4 w-px bg-slate-200" aria-hidden />}
          <Avatar name={item.actorName} size="sm" />
          <div className="min-w-0 pt-0.5">
            <p className="text-sm text-slate-700">
              <span className="font-medium text-slate-900">{item.actorName}</span> {item.message}
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {item.courseTitle} · {timeAgo(item.createdAt)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
