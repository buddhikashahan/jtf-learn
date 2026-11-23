"use client";

import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/popover";
import { AuthProvider } from "./auth-provider";
import { useTheme } from "./theme";

export function Providers({ children }: { children: React.ReactNode }) {
  const { resolved } = useTheme();
  return (
    <AuthProvider>
      <TooltipProvider>{children}</TooltipProvider>
      <Toaster position="bottom-right" richColors closeButton theme={resolved} toastOptions={{ className: "font-sans" }} />
    </AuthProvider>
  );
}
