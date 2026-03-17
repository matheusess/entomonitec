'use client';

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/components/AuthContext";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { useOnlineSync } from "@/hooks/useOnlineSync";
import { useState } from "react";

/** Mounts the background sync engine once inside the auth/provider tree. */
function OnlineSyncManager() {
  useOnlineSync();
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <OnlineSyncManager />
          {children}
          <Toaster />
          <Sonner />
          <ServiceWorkerRegistration />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

