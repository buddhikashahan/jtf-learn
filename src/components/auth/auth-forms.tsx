"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { useAuth } from "@/components/providers/auth-provider";
import { useHydrated } from "@/hooks/use-hydrated";
import { requestPasswordReset, signIn, signInWithGoogle, signUp } from "@/lib/services/auth";
import { getErrorMessage } from "@/lib/errors";
import { safeRedirect } from "@/config/site";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
} from "@/lib/validation";

/** Redirect already-authenticated users away from auth pages. */
function useRedirectIfAuthenticated() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeRedirect(params.get("next"));
  useEffect(() => {
    if (user && profile) router.replace(next);
  }, [user, profile, router, next]);
  return next;
}

function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className="pr-10" />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function GoogleButton({ onSuccess }: { onSuccess: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      className="w-full"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await signInWithGoogle();
          onSuccess();
        } catch (error) {
          toast.error(getErrorMessage(error));
        } finally {
          setBusy(false);
        }
      }}
    >
      {!busy && (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.43.34-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
        </svg>
      )}
      Continue with Google
    </Button>
  );
}

function Divider() {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center" aria-hidden>
        <div className="w-full border-t border-slate-200" />
      </div>
      <p className="relative mx-auto w-fit bg-slate-50 px-3 text-xs text-slate-500">or continue with email</p>
    </div>
  );
}

export function LoginForm() {
  const router = useRouter();
  const next = useRedirectIfAuthenticated();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });
  const [error, setError] = useState<string | null>(null);
  const hydrated = useHydrated();

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await signIn(values.email, values.password);
      router.replace(next);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Welcome back</h1>
      <p className="mt-1.5 text-sm text-slate-500">Sign in to continue your learning journey.</p>

      <div className="mt-8">
        <GoogleButton onSuccess={() => router.replace(next)} />
      </div>
      <Divider />

      <form onSubmit={onSubmit} method="post" className="space-y-4" noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <FormField label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" placeholder="you@example.com" {...register("email")} />
        </FormField>
        <div className="space-y-1.5">
          <FormField label="Password" error={errors.password?.message}>
            <PasswordInput autoComplete="current-password" placeholder="••••••••" {...register("password")} />
          </FormField>
          <div className="text-right">
            <Link href="/forgot-password" className="text-xs font-medium text-brand-600 hover:text-brand-700">
              Forgot password?
            </Link>
          </div>
        </div>
        <Button type="submit" className="w-full" size="lg" loading={isSubmitting} disabled={!hydrated}>
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        New here?{" "}
        <Link href="/register" className="font-medium text-brand-600 hover:text-brand-700">
          Create an account
        </Link>
      </p>
    </div>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const next = useRedirectIfAuthenticated();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });
  const [error, setError] = useState<string | null>(null);
  const hydrated = useHydrated();

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await signUp(values.displayName, values.email, values.password);
      toast.success("Account created! Check your inbox to verify your email.");
      router.replace(next);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Create your account</h1>
      <p className="mt-1.5 text-sm text-slate-500">Start learning in less than a minute.</p>

      <div className="mt-8">
        <GoogleButton onSuccess={() => router.replace(next)} />
      </div>
      <Divider />

      <form onSubmit={onSubmit} method="post" className="space-y-4" noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <FormField label="Full name" error={errors.displayName?.message}>
          <Input autoComplete="name" placeholder="Your full name" {...register("displayName")} />
        </FormField>
        <FormField label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" placeholder="you@example.com" {...register("email")} />
        </FormField>
        <FormField
          label="Password"
          error={errors.password?.message}
          hint="At least 8 characters with upper & lowercase letters and a number."
        >
          <PasswordInput autoComplete="new-password" {...register("password")} />
        </FormField>
        <FormField label="Confirm password" error={errors.confirmPassword?.message}>
          <PasswordInput autoComplete="new-password" {...register("confirmPassword")} />
        </FormField>
        <Button type="submit" className="w-full" size="lg" loading={isSubmitting} disabled={!hydrated}>
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const hydrated = useHydrated();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = handleSubmit(async ({ email }) => {
    try {
      await requestPasswordReset(email);
    } catch {
      // Intentionally ignored: never reveal whether an account exists.
    }
    setSentTo(email);
  });

  if (sentTo) {
    return (
      <div className="text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50">
          <MailCheck className="size-6 text-emerald-600" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-slate-900">Check your email</h1>
        <p className="mt-2 text-sm text-slate-500">
          If an account exists for <span className="font-medium text-slate-700">{sentTo}</span>, you&apos;ll receive a
          link to reset your password shortly.
        </p>
        <Link href="/login" className="mt-6 inline-block text-sm font-medium text-brand-600 hover:text-brand-700">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Reset your password</h1>
      <p className="mt-1.5 text-sm text-slate-500">Enter your email and we&apos;ll send you a reset link.</p>
      <form onSubmit={onSubmit} method="post" className="mt-8 space-y-4" noValidate>
        <FormField label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" placeholder="you@example.com" {...register("email")} />
        </FormField>
        <Button type="submit" className="w-full" size="lg" loading={isSubmitting} disabled={!hydrated}>
          Send reset link
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </div>
  );
}
