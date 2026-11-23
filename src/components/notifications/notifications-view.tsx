"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCheck, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useProfile } from "@/components/providers/auth-provider";
import { useNotifications } from "@/hooks/use-notifications";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { SegmentedTabsList, SegmentedTabsTrigger, Tabs } from "@/components/ui/tabs";
import { clearReadNotifications, markAllNotificationsRead } from "@/lib/services/notifications";
import { getErrorMessage } from "@/lib/errors";
import { NotificationList } from "./notification-list";

export function NotificationsView() {
  const profile = useProfile();
  const { data, loading, unread } = useNotifications(100);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const items = filter === "unread" ? data.filter((n) => !n.read) : data;

  async function run(task: () => Promise<void>, success: string) {
    try {
      await task();
      toast.success(success);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        description="Announcements, grades, deadlines and replies — all in one place."
        actions={
          <>
            <Button variant="outline" disabled={!unread} onClick={() => run(() => markAllNotificationsRead(profile.uid), "All caught up")}>
              <CheckCheck /> Mark all read
            </Button>
            <Button
              variant="ghost"
              disabled={data.every((n) => !n.read)}
              onClick={() => run(() => clearReadNotifications(profile.uid), "Cleared read notifications")}
            >
              <Trash2 /> Clear read
            </Button>
          </>
        }
      />
      <div className="mb-4 flex items-center justify-between gap-3">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SegmentedTabsList>
            <SegmentedTabsTrigger value="all">All ({data.length})</SegmentedTabsTrigger>
            <SegmentedTabsTrigger value="unread">Unread ({unread})</SegmentedTabsTrigger>
          </SegmentedTabsList>
        </Tabs>
        <Link href="/settings?tab=notifications" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <Settings2 /> Preferences
        </Link>
      </div>
      <Card className="overflow-hidden">
        <NotificationList items={items} loading={loading} showActions />
      </Card>
    </div>
  );
}
