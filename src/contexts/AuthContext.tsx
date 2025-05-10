"use client";

import type { AppUser } from '@/lib/auth'; 
import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import type { Session, PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient'; // Import supabase client directly
import {
  getCurrentUser as apiGetCurrentUser,
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  onAuthStateChangeCallback
} from '@/lib/auth';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import type { Task } from '@/lib/types';
import type { Database } from '@/lib/types/supabase';
// Corrected import path for onTasksUpdate
import { onTasksUpdate } from '@/lib/taskService';


interface AuthContextType {
  user: AppUser | null;
  session: Session | null;
  login: (email: string, pass: string) => Promise<AppUser | void>;
  register: (name: string, email: string, pass: string) => Promise<AppUser | void>;
  logout: () => Promise<void>;
  isLoading: boolean; 
  isInitialLoading: boolean;
  realtimeTasks: Task[];
  areRealtimeTasksLoading: boolean;
  realtimeTasksError: PostgrestError | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(false); 
  const [isInitialLoading, setIsInitialLoading] = useState(true); 
  const router = useRouter();

  const [realtimeTasks, setRealtimeTasks] = useState<Task[]>([]);
  const [areRealtimeTasksLoading, setAreRealtimeTasksLoading] = useState(true);
  const [realtimeTasksError, setRealtimeTasksError] = useState<PostgrestError | null>(null);
  const tasksUnsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let didUnsubscribe = false;

    const initializeAuth = async () => {
      try {
        // No need to call apiGetCurrentUser here, onAuthStateChange will handle it.
      } catch (error) {
        console.error("AuthContext: Error on initial setup (should not happen with current logic):", error);
        if (!didUnsubscribe) {
          setUser(null);
          setSession(null);
        }
      }
    };
    
    initializeAuth();
    
    const { unsubscribe: unsubscribeAuthState } = onAuthStateChangeCallback((appUser, supabaseSession) => {
      if (didUnsubscribe) return;

      setUser(appUser);
      setSession(supabaseSession);

      if (isInitialLoading) {
          setIsInitialLoading(false);
      }

      if (tasksUnsubscribeRef.current) {
        tasksUnsubscribeRef.current();
        tasksUnsubscribeRef.current = null;
      }
      
      setRealtimeTasks([]);
      setRealtimeTasksError(null);

      if (appUser && appUser.id) {
        setAreRealtimeTasksLoading(true);
        tasksUnsubscribeRef.current = onTasksUpdate(
          appUser.id,
          (data) => { 
            if (didUnsubscribe) return;
            console.log("AuthContext: realtimeTasks updated", data.tasks.length, "tasks, loading:", data.isLoading, "error:", data.error);
            setRealtimeTasks(data.tasks);
            setAreRealtimeTasksLoading(data.isLoading);
            if (data.error) {
              const err = data.error as PostgrestError; 
              console.error(
                "Error from onTasksUpdate callback in AuthContext:",
                `Message: ${err.message || 'N/A'}, Code: ${err.code || 'N/A'}, Details: ${err.details || 'N/A'}, Hint: ${err.hint || 'N/A'}. Raw object:`,
                data.error 
              );
              setRealtimeTasksError(data.error);
            } else {
              setRealtimeTasksError(null);
            }
          },
          supabase 
        );
      } else {
        setAreRealtimeTasksLoading(false); 
        setRealtimeTasks([]);
      }
    });

    return () => {
      didUnsubscribe = true;
      unsubscribeAuthState();
      if (tasksUnsubscribeRef.current) {
        tasksUnsubscribeRef.current();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const handleLogin = useCallback(async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const loggedInUser = await apiLogin(email, pass);
      // State updates are handled by onAuthStateChangeCallback
      router.push('/dashboard'); 
      return loggedInUser;
    } catch (error) {
      console.error("Login failed in AuthContext:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [router]); 

  const handleRegister = useCallback(async (name: string, email: string, pass: string) => {
    setIsLoading(true);
    try {
      const registeredUser = await apiRegister(name, email, pass);
      router.push('/login'); 
      return registeredUser;
    } catch (error) {
      console.error("Registration failed in AuthContext:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [router]); 

  const handleLogout = useCallback(async () => {
    setIsLoading(true);
    try {
      await apiLogout();
      // State updates are handled by onAuthStateChangeCallback
      router.push('/login'); 
    } catch (error) {
      console.error("Logout failed in AuthContext:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  return (
    <AuthContext.Provider value={{ 
        user, 
        session,
        login: handleLogin, 
        register: handleRegister, 
        logout: handleLogout, 
        isLoading, 
        isInitialLoading,
        realtimeTasks,
        areRealtimeTasksLoading,
        realtimeTasksError
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, session, isInitialLoading, areRealtimeTasksLoading, realtimeTasksError } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (!isInitialLoading) {
      setAuthChecked(true); 
      if (!user && !session) {
        if (pathname !== '/login' && pathname !== '/register') {
          router.replace('/login');
        }
      } else if (user && session) {
        if (pathname === '/login' || pathname === '/register') {
          router.replace('/dashboard');
        }
      }
    }
  }, [user, session, isInitialLoading, router, pathname]);
  

  if (isInitialLoading || !authChecked) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-lg text-foreground">Loading TaskZen...</p>
      </div>
    );
  }

  if (authChecked && !user && !session && pathname !== '/login' && pathname !== '/register') {
     return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
         <p className="ml-3 text-lg text-foreground">Redirecting to login...</p>
      </div>
    );
  }
  
   if (authChecked && user && session && (pathname === '/login' || pathname === '/register')) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-lg text-foreground">Redirecting to dashboard...</p>
      </div>
    );
  }

  const showAppTasksLoadingSpinner = user && areRealtimeTasksLoading && 
                                  (pathname === '/dashboard' || pathname.startsWith('/tasks')) &&
                                  !realtimeTasksError; 

  if (showAppTasksLoadingSpinner) { 
     return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-lg text-foreground">Loading tasks...</p>
      </div>
    );
  }


  if (realtimeTasksError && user && (pathname === '/dashboard' || pathname.startsWith('/tasks'))) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-background p-4 text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mb-6" />
        <h2 className="text-xl font-semibold text-destructive mb-3">Error Loading Tasks</h2>
        <p className="text-muted-foreground mb-5 max-w-md">
          There was an issue fetching your tasks in real-time. This might be due to a network problem or an issue with the database connection.
        </p>
        <details className="mb-5 p-3 bg-muted/50 border border-destructive/30 rounded-md text-left text-xs w-full max-w-md">
          <summary className="cursor-pointer font-medium text-destructive/80">Error Details</summary>
          <pre className="mt-2 whitespace-pre-wrap break-all">
            {`Message: ${realtimeTasksError.message}\nCode: ${realtimeTasksError.code}\nDetails: ${realtimeTasksError.details}\nHint: ${realtimeTasksError.hint}`}
          </pre>
        </details>
        <Button onClick={() => window.location.reload()} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4"/>
          Try Refreshing Page
        </Button>
      </div>
    );
  }
  
  if ((user && session) || pathname === '/login' || pathname === '/register') {
    return <>{children}</>;
  }

  return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-lg text-foreground">Verifying access...</p>
      </div>
  );
};