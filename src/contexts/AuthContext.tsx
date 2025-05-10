
"use client";

import type { AppUser } from '@/lib/auth'; 
import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import {
  getCurrentUser as apiGetCurrentUser,
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  onAuthStateChangeCallback
} from '@/lib/auth';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import type { Task } from '@/lib/types'; // Using AppTask as Task
import { onTasksUpdate } from '@/lib/taskService'; // This will be adapted for Supabase

interface AuthContextType {
  user: AppUser | null;
  session: Session | null;
  login: (email: string, pass: string) => Promise<AppUser | void>;
  register: (name: string, email: string, pass: string) => Promise<AppUser | void>;
  logout: () => Promise<void>;
  isLoading: boolean; 
  isInitialLoading: boolean;
  realtimeTasks: Task[]; // Changed from AppTask[] to Task[]
  areRealtimeTasksLoading: boolean;
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
  const tasksUnsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let didUnsubscribe = false;

    // Initial check for user session
    apiGetCurrentUser()
      .then(currentUser => {
        if (!didUnsubscribe) {
          // This might be overwritten by onAuthStateChange, but good for initial fast load
          // setUser(currentUser); // Defer to onAuthStateChange for consistency with profile
        }
      })
      .catch(error => {
        console.error("AuthContext: Error on initial getCurrentUser", error);
        if (!didUnsubscribe) {
          setUser(null);
          setSession(null);
        }
      })
      .finally(() => {
        // isInitialLoading will be set to false by onAuthStateChange's first fire
      });
    
    const { unsubscribe: unsubscribeAuthState } = onAuthStateChangeCallback((appUser, supabaseSession) => {
      if (!didUnsubscribe) {
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

        if (appUser && appUser.id) {
          // onTasksUpdate will need to be adapted for Supabase Realtime or polling
          tasksUnsubscribeRef.current = onTasksUpdate(
            appUser.id,
            (data) => { // data is { tasks: Task[], isLoading: boolean }
              if (!didUnsubscribe) {
                setRealtimeTasks(data.tasks);
                setAreRealtimeTasksLoading(data.isLoading);
              }
            },
            supabase // Pass supabase client to onTasksUpdate
          );
        } else {
          setAreRealtimeTasksLoading(false); 
        }
      }
    });

    return () => {
      didUnsubscribe = true;
      unsubscribeAuthState();
      if (tasksUnsubscribeRef.current) {
        tasksUnsubscribeRef.current();
      }
    };
  }, [isInitialLoading]);

  const handleLogin = useCallback(async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const loggedInUser = await apiLogin(email, pass);
      // User state & tasks updated by onAuthStateChangeCallback
      router.push('/dashboard');
      return loggedInUser;
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const handleRegister = useCallback(async (name: string, email: string, pass: string) => {
    setIsLoading(true);
    try {
      const registeredUser = await apiRegister(name, email, pass);
      // User state & tasks updated by onAuthStateChangeCallback
      // Supabase typically requires email confirmation. User will be in a pending state.
      // The UI should inform the user to check their email.
      // For simplicity, redirecting to dashboard, but ideally show a "confirm email" message.
      router.push('/dashboard'); 
      return registeredUser;
    } catch (error) {
      console.error("Registration failed:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const handleLogout = useCallback(async () => {
    setIsLoading(true);
    try {
      await apiLogout();
      // User state & tasks updated by onAuthStateChangeCallback
      router.push('/login');
    } catch (error) {
      console.error("Logout failed:", error);
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
        areRealtimeTasksLoading 
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
  const { user, session, isInitialLoading, areRealtimeTasksLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isInitialLoading) {
      if (!user && !session && pathname !== '/login' && pathname !== '/register') {
        router.replace('/login');
      }
      // If user is logged in (session exists) and tries to access login/register
      if ((user || session) && (pathname === '/login' || pathname === '/register')) {
         router.replace('/dashboard');
      }
    }
  }, [user, session, isInitialLoading, router, pathname]);

  const combinedLoading = isInitialLoading || ((user || session) && areRealtimeTasksLoading && pathname !== '/login' && pathname !== '/register');

  if (combinedLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-lg text-foreground">Loading TaskZen...</p>
      </div>
    );
  }
  
  if (!isInitialLoading && !user && !session && pathname !== '/login' && pathname !== '/register') {
     return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
         <p className="ml-3 text-lg text-foreground">Redirecting...</p>
      </div>
    );
  }
  
  if (!isInitialLoading && (user || session) && (pathname === '/login' || pathname === '/register')) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-lg text-foreground">Redirecting...</p>
      </div>
    );
  }

  return <>{children}</>;
};
