"use client"; // Make AuthLayout a client component

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { APP_NAME } from '@/lib/constants';
import { CheckSquare, Loader2 } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isInitialLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If auth state is loaded and user is authenticated, redirect to dashboard
    if (!isInitialLoading && user) {
      router.replace('/dashboard');
    }
  }, [user, isInitialLoading, router]);

  // Show a loading indicator while checking auth status or if user is logged in (and redirect is pending)
  // This prevents a flash of the login/register form if already authenticated.
  if (isInitialLoading || (!isInitialLoading && user)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-secondary p-4 sm:p-6">
        <div className="flex flex-col items-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If auth state is loaded and user is not authenticated, show the auth form (children)
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 sm:mb-8 flex flex-col items-center">
          <div className="flex items-center text-primary mb-2">
            <CheckSquare className="h-10 w-10 sm:h-12 sm:w-12 mr-2" />
            <h1 className="text-3xl sm:text-4xl font-bold">{APP_NAME}</h1>
          </div>
          <p className="text-sm sm:text-base text-muted-foreground text-center">Efficiently manage your team tasks.</p>
        </div>
        <div className="rounded-lg border bg-card p-4 sm:p-6 shadow-lg md:p-8">
          {children}
        </div>
         <p className="mt-4 sm:mt-6 text-center text-xs sm:text-sm text-muted-foreground">
            A modern solution for team collaboration.
          </p>
      </div>
    </div>
  );
}
