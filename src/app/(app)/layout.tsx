
"use client"; // Required for ProtectedRoute and hooks

import { AppHeader } from "@/components/layout/AppHeader";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { ProtectedRoute } from "@/contexts/AuthContext"; // Import ProtectedRoute

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute> {/* Wrap content with ProtectedRoute */}
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <div className="flex flex-1">
          <AppSidebar />
          <main className="flex-1 bg-secondary/50 p-4 md:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
