import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

const isDev = process.env.NODE_ENV !== "production";

/** Firebase App Check (reCAPTCHA Enterprise) is enabled when a site key is configured. */
const appCheck = Boolean(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY);

// ── Firebase web config ──────────────────────────────────────────────────────
// Explicit NEXT_PUBLIC_FIREBASE_* variables win. On Firebase App Hosting the
// platform injects FIREBASE_WEBAPP_CONFIG at build time, which is used as a
// fallback so no manual configuration is needed there.
function resolveFirebaseEnv() {
  let host: Record<string, string> = {};
  try {
    if (process.env.FIREBASE_WEBAPP_CONFIG) host = JSON.parse(process.env.FIREBASE_WEBAPP_CONFIG);
  } catch {
    /* ignore malformed value */
  }
  const pick = (name: string, hostKey: string) => process.env[name] || host[hostKey] || "";
  return {
    NEXT_PUBLIC_FIREBASE_API_KEY: pick("NEXT_PUBLIC_FIREBASE_API_KEY", "apiKey"),
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: pick("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "authDomain"),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: pick("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "projectId"),
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: pick("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "storageBucket"),
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: pick("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "messagingSenderId"),
    NEXT_PUBLIC_FIREBASE_APP_ID: pick("NEXT_PUBLIC_FIREBASE_APP_ID", "appId"),
  };
}
const firebaseEnv = resolveFirebaseEnv();

/** Fail the production build early instead of shipping a broken app. */
function assertProductionConfig() {
  const required = [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
  ] as const;
  const missing = required.filter((key) => !firebaseEnv[key]);
  if (missing.length) {
    throw new Error(
      `\n✖ Missing Firebase configuration for the production build: ${missing.join(", ")}.\n` +
        "  Set these in your hosting provider's environment (or in .env.production.local). See README → Deploy.\n",
    );
  }
  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true" && process.env.ALLOW_EMULATOR_BUILD !== "true") {
    throw new Error(
      "\n✖ NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true in a production build — the app would try to reach localhost.\n" +
        "  Unset it for deployments (note: .env.local applies to builds too; use .env.production.local to override),\n" +
        "  or set ALLOW_EMULATOR_BUILD=true to build against the emulators intentionally.\n",
    );
  }
}

/**
 * Content Security Policy — scoped to Firebase (incl. Firebase AI Logic on
 * *.googleapis.com), Google sign-in and the lesson video providers.
 * Emulator hosts are only allowed in development and emulator builds.
 */
const recaptchaScript = appCheck ? " https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/" : "";
const recaptchaFrame = appCheck ? " https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/" : "";
const local = " http://127.0.0.1:* http://localhost:*";
/** Local hosts (emulators) are allowed in development and in explicit emulator builds only. */
const allowLocal = isDev || process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://apis.google.com https://www.youtube.com https://s.ytimg.com https://player.vimeo.com${recaptchaScript}${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://firebasestorage.googleapis.com https://*.googleusercontent.com https://i.ytimg.com https://i.vimeocdn.com${allowLocal ? local : ""}`,
  `media-src 'self' blob: https://firebasestorage.googleapis.com${allowLocal ? local : ""}`,
  "font-src 'self' data:",
  `connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebaseapp.com https://firebasestorage.googleapis.com${allowLocal ? `${local} ws://127.0.0.1:* ws://localhost:*` : ""}`,
  `frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com${recaptchaFrame}${allowLocal ? local : ""}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Live classes run on external platforms, so no page needs camera/mic/screen capture.
  {
    key: "Permissions-Policy",
    value: [
      "camera=()",
      "microphone=()",
      "display-capture=()",
      `fullscreen=(self "https://www.youtube-nocookie.com" "https://player.vimeo.com")`,
      "geolocation=()",
      "payment=()",
      "usb=()",
    ].join(", "),
  },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
  // Required so Firebase Auth's signInWithPopup can communicate with the opener.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  env: firebaseEnv,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
  async headers() {
    // Pages are static shells — user data is fetched client-side under
    // Firestore security rules — so they remain safely CDN-cacheable.
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default function config(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD) assertProductionConfig();
  return nextConfig;
}
