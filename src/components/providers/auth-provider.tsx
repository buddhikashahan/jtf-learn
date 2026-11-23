"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { onSnapshot } from "firebase/firestore";
import { firebaseAuth, isFirebaseConfigured } from "@/lib/firebase/client";
import { ensureUserProfile } from "@/lib/services/users";
import { refs } from "@/lib/services/refs";
import { setAuditActor } from "@/lib/services/audit";
import type { Role, UserProfile } from "@/types";

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: Error | null;
}

interface AuthContextValue extends AuthState {
  role: Role | null;
  /** Admin or super admin. */
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isInstructor: boolean;
  isStaff: boolean;
  configured: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = isFirebaseConfigured();
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: configured,
    error: null,
  });

  useEffect(() => {
    if (!configured) return;
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(firebaseAuth(), async (user) => {
      unsubscribeProfile?.();
      unsubscribeProfile = undefined;

      if (!user) {
        setState({ user: null, profile: null, loading: false, error: null });
        return;
      }

      setState((prev) => ({ ...prev, user, loading: true }));
      try {
        await ensureUserProfile(user);
      } catch (error) {
        setState({ user, profile: null, loading: false, error: error as Error });
        return;
      }

      unsubscribeProfile = onSnapshot(
        refs.user(user.uid),
        (snap) =>
          setState({
            user,
            profile: snap.exists() ? (snap.data({ serverTimestamps: "estimate" }) as UserProfile) : null,
            loading: false,
            error: null,
          }),
        (error) => setState({ user, profile: null, loading: false, error }),
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeProfile?.();
    };
  }, [configured]);

  // Staff actions are attributed to the signed-in profile in the audit log.
  useEffect(() => {
    setAuditActor(state.profile);
  }, [state.profile]);

  const value = useMemo<AuthContextValue>(() => {
    const role = state.profile?.role ?? null;
    return {
      ...state,
      role,
      isAdmin: role === "admin" || role === "superadmin",
      isSuperAdmin: role === "superadmin",
      isInstructor: role === "instructor",
      isStaff: role === "admin" || role === "superadmin" || role === "instructor",
      configured,
    };
  }, [state, configured]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

/** For pages rendered behind <AuthGuard>, where a profile is guaranteed. */
export function useProfile(): UserProfile {
  const { profile } = useAuth();
  if (!profile) throw new Error("useProfile must be used behind <AuthGuard>");
  return profile;
}
