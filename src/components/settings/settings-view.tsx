"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Bell, Camera, KeyRound, LogOut, MonitorSmartphone, Palette, ShieldCheck, User } from "lucide-react";
import { ThemePicker } from "@/components/providers/theme";
import { DESKTOP_NOTIFICATIONS_KEY } from "@/components/notifications/notification-bell";
import { toast } from "sonner";
import { useAuth, useProfile } from "@/components/providers/auth-provider";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea } from "@/components/ui/form";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert } from "@/components/ui/feedback";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { updateNotificationPrefs, updateUserProfile, uploadAvatar } from "@/lib/services/users";
import { changePassword, signOut } from "@/lib/services/auth";
import { getErrorMessage } from "@/lib/errors";
import { roleLabels } from "@/config/site";
import {
  changePasswordSchema,
  profileSchema,
  validateFile,
  type ChangePasswordInput,
  type ProfileInput,
} from "@/lib/validation";
import { formatDate } from "@/lib/utils";
import type { NotificationPrefs } from "@/types";

function AvatarUploader() {
  const profile = useProfile();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    const problem = validateFile(file, "avatar");
    if (problem) return toast.error(problem);
    setProgress(0);
    try {
      await uploadAvatar(profile, file, setProgress);
      toast.success("Profile photo updated");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="flex items-center gap-5">
      <div className="relative">
        <Avatar name={profile.displayName} src={profile.photoURL} size="xl" />
        {progress !== null && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55 text-xs font-semibold text-white">
            {progress}%
          </div>
        )}
      </div>
      <div>
        <Button variant="outline" size="sm" onClick={() => input.current?.click()} loading={progress !== null}>
          <Camera /> Upload photo
        </Button>
        <p className="mt-2 text-xs text-slate-500">JPG, PNG or WEBP, up to 2 MB.</p>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

function ProfileTab() {
  const profile = useProfile();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { displayName: profile.displayName, phone: profile.phone ?? "", bio: profile.bio ?? "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateUserProfile(profile.uid, values);
      reset(values);
      toast.success("Profile saved");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  });

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your personal details as seen by others on the platform.</CardDescription>
        </div>
      </CardHeader>
      <form method="post" onSubmit={onSubmit} noValidate>
        <CardContent className="space-y-6">
          <AvatarUploader />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Full name" required error={errors.displayName?.message}>
              <Input autoComplete="name" {...register("displayName")} />
            </FormField>
            <FormField label="Email" hint="Contact an administrator to change your email.">
              <Input value={profile.email} disabled readOnly />
            </FormField>
            <FormField label="Phone" error={errors.phone?.message}>
              <Input type="tel" autoComplete="tel" placeholder="+94 77 123 4567" {...register("phone")} />
            </FormField>
            <div className="space-y-1.5">
              <span className="block text-sm font-medium text-slate-700">Role</span>
              <div className="flex h-10 items-center">
                <Badge tone="brand">{roleLabels[profile.role]}</Badge>
              </div>
            </div>
          </div>
          <FormField label="Bio" error={errors.bio?.message} hint="A short introduction (max 500 characters).">
            <Textarea rows={3} {...register("bio")} />
          </FormField>
        </CardContent>
        <CardFooter>
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            Save profile
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

const notificationOptions: { key: keyof NotificationPrefs; label: string; description: string }[] = [
  { key: "assignments", label: "Assignments", description: "New assignments and upcoming deadline reminders." },
  { key: "grades", label: "Grades & feedback", description: "When an instructor grades your submission." },
  { key: "liveClasses", label: "Live classes", description: "Reminders before a live class starts." },
  { key: "announcements", label: "Announcements", description: "Course announcements from your instructors." },
];

function NotificationsTab() {
  const profile = useProfile();
  const [saving, setSaving] = useState<keyof NotificationPrefs | null>(null);

  async function toggle(key: keyof NotificationPrefs, value: boolean) {
    setSaving(key);
    try {
      await updateNotificationPrefs(profile.uid, { ...profile.notifications, [key]: value });
      toast.success("Preferences updated");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>What to notify me about</CardTitle>
            <CardDescription>
              Applies to in-app notifications and email digests. Replies to your questions and course updates
              are always delivered.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="divide-y divide-slate-100">
          {notificationOptions.map((o) => (
            <Switch
              key={o.key}
              label={o.label}
              description={o.description}
              checked={profile.notifications?.[o.key] ?? false}
              disabled={saving === o.key}
              onCheckedChange={(v) => toggle(o.key, v)}
              className="py-4 first:pt-0 last:pb-0"
            />
          ))}
        </CardContent>
      </Card>
      <DesktopNotificationsCard />
    </div>
  );
}

function readDesktopPref() {
  try {
    return (
      typeof Notification !== "undefined" &&
      Notification.permission === "granted" &&
      localStorage.getItem(DESKTOP_NOTIFICATIONS_KEY) === "on"
    );
  } catch {
    return false;
  }
}

function DesktopNotificationsCard() {
  // Rendered only on the client (behind AuthGuard), so reading browser APIs
  // in the initializer is hydration-safe.
  const [enabled, setEnabled] = useState(readDesktopPref);
  const supported = typeof Notification !== "undefined";
  const blocked = supported && Notification.permission === "denied";

  async function toggle(on: boolean) {
    if (!supported) return;
    if (on && Notification.permission !== "granted") {
      const result = await Notification.requestPermission();
      if (result !== "granted") {
        toast.error("Notifications are blocked in your browser settings.");
        return;
      }
    }
    try {
      localStorage.setItem(DESKTOP_NOTIFICATIONS_KEY, on ? "on" : "off");
    } catch {
      /* ignore */
    }
    setEnabled(on);
    if (on) new Notification("Desktop notifications enabled", { body: "We'll alert you here when something needs your attention." });
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <MonitorSmartphone className="size-4 text-slate-400" /> Desktop alerts
          </CardTitle>
          <CardDescription>Get a system notification when the app is open in a background tab.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {!supported ? (
          <Alert tone="info">Your browser doesn&apos;t support desktop notifications.</Alert>
        ) : blocked ? (
          <Alert tone="warning">Notifications are blocked for this site. Allow them in your browser&apos;s site settings.</Alert>
        ) : (
          <Switch label="Enable desktop alerts on this device" checked={enabled} onCheckedChange={toggle} />
        )}
      </CardContent>
    </Card>
  );
}

function AppearanceTab() {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Theme</CardTitle>
          <CardDescription>Choose how the platform looks. “System” follows your device setting.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ThemePicker />
        <p className="text-xs text-slate-500">
          Tip: press <kbd className="rounded border border-slate-200 px-1">Ctrl</kbd> +{" "}
          <kbd className="rounded border border-slate-200 px-1">K</kbd> anywhere to open the command palette.
        </p>
      </CardContent>
    </Card>
  );
}

function SecurityTab() {
  const { user } = useAuth();
  const router = useRouter();
  const usesPassword = Boolean(user?.providerData.some((p) => p.providerId === "password"));
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await changePassword(values.currentPassword, values.newPassword);
      reset({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast.success("Password updated");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Password</CardTitle>
            <CardDescription>Use a strong password you don&apos;t use anywhere else.</CardDescription>
          </div>
        </CardHeader>
        {usesPassword ? (
          <form method="post" onSubmit={onSubmit} noValidate>
            <CardContent className="grid gap-4 sm:max-w-md">
              <FormField label="Current password" error={errors.currentPassword?.message}>
                <Input type="password" autoComplete="current-password" {...register("currentPassword")} />
              </FormField>
              <FormField label="New password" error={errors.newPassword?.message} hint="At least 8 characters with upper & lowercase letters and a number.">
                <Input type="password" autoComplete="new-password" {...register("newPassword")} />
              </FormField>
              <FormField label="Confirm new password" error={errors.confirmPassword?.message}>
                <Input type="password" autoComplete="new-password" {...register("confirmPassword")} />
              </FormField>
            </CardContent>
            <CardFooter>
              <Button type="submit" loading={isSubmitting}>
                <KeyRound /> Update password
              </Button>
            </CardFooter>
          </form>
        ) : (
          <CardContent>
            <Alert tone="info" icon={ShieldCheck}>
              You sign in with Google. Manage your password and 2-step verification in your Google account.
            </Alert>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Session</CardTitle>
            <CardDescription>
              Account created {formatDate(user?.metadata.creationTime ? new Date(user.metadata.creationTime) : null)} ·
              Last sign-in {formatDate(user?.metadata.lastSignInTime ? new Date(user.metadata.lastSignInTime) : null)}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={async () => {
              await signOut();
              router.replace("/login");
            }}
          >
            <LogOut /> Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

const TABS = ["profile", "notifications", "appearance", "security"] as const;

export function SettingsView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requested = params.get("tab");
  const tab = TABS.includes(requested as (typeof TABS)[number]) ? (requested as string) : "profile";

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" description="Manage your profile, notifications and account security." />
      <Tabs value={tab} onValueChange={(v) => router.replace(`${pathname}?tab=${v}`, { scroll: false })}>
        <TabsList>
          <TabsTrigger value="profile">
            <User /> Profile
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell /> Notifications
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Palette /> Appearance
          </TabsTrigger>
          <TabsTrigger value="security">
            <ShieldCheck /> Account security
          </TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <ProfileTab />
        </TabsContent>
        <TabsContent value="notifications">
          <NotificationsTab />
        </TabsContent>
        <TabsContent value="appearance">
          <AppearanceTab />
        </TabsContent>
        <TabsContent value="security">
          <SecurityTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
