
"use client";

import type { AppUser } from '@/lib/auth'; 
import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import {
  getCurrentUser as apiGetCurrentUser,
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  onAuthStateChangeCallback
} from '@/lib/auth';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import type { Task } from '@/lib/types';
import { onTasksUpdate } from '@/lib/taskService';

interface AuthContextType {
  user: AppUser | null;
  login: (email: string, pass: string) => Promise<AppUser | void>;
  register: (name: string, email: string, pass: string) => Promise<AppUser | void>;
  logout: () => Promise<void>;
  isLoading: boolean; 
  isInitialLoading: boolean;
  realtimeTasks: Task[];
  areRealtimeTasksLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(false); 
  const [isInitialLoading, setIsInitialLoading] = useState(true); 
  const router = useRouter();

  const [realtimeTasks, setRealtimeTasks] = useState<Task[]>([]);
  const [areRealtimeTasksLoading, setAreRealtimeTasksLoading] = useState(true);
  const tasksUnsubscribeRef = useRef<(() => void) | null>(null);


  useEffect(() => {
    let didUnsubscribe = false;

    // Initial check for user persistence
    apiGetCurrentUser()
      .then(currentUser => {
        if (!didUnsubscribe) {
          // This initial setUser might be overwritten by onAuthStateChangeCallback,
          // but it's good for the very first load if the user is already logged in.
          // The onAuthStateChangeCallback will handle profile fetching and task listeners.
          // setUser(currentUser); // Potentially defer this to onAuthStateChangeCallback entirely
        }
      })
      .catch(error => {
        console.error("AuthContext: Error on initial getCurrentUser", error);
        if (!didUnsubscribe) {
          setUser(null);
        }
      })
      .finally(() => {
        // isInitialLoading will be set to false by onAuthStateChangeCallback's first fire
      });
    
    const unsubscribeAuthState = onAuthStateChangeCallback((appUser) => {
      if (!didUnsubscribe) {
        setUser(appUser);
        if (isInitialLoading) { // Only set this once
            setIsInitialLoading(false);
        }

        if (tasksUnsubscribeRef.current) {
          tasksUnsubscribeRef.current();
          tasksUnsubscribeRef.current = null;
        }
        
        setRealtimeTasks([]); // Clear tasks on auth state change

        if (appUser && appUser.uid) {
          // setAreRealtimeTasksLoading(true); // Handled by onTasksUpdate's initial callback
          tasksUnsubscribeRef.current = onTasksUpdate(
            appUser.uid,
            (data) => { // data is { tasks: Task[], isLoading: boolean }
              if (!didUnsubscribe) {
                setRealtimeTasks(data.tasks);
                setAreRealtimeTasksLoading(data.isLoading);
              }
            }
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
  }, [isInitialLoading]); // Keep isInitialLoading to ensure it runs once correctly

  const handleLogin = useCallback(async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const loggedInUser = await apiLogin(email, pass);
      // User state and task listeners will be updated by onAuthStateChangeCallback
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
      // User state and task listeners will be updated by onAuthStateChangeCallback
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
      // User state (to null) and task listeners (cleanup) will be handled by onAuthStateChangeCallback
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
  const { user, isInitialLoading, areRealtimeTasksLoading } = useAuth(); // Include areRealtimeTasksLoading
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isInitialLoading) { // Wait for auth to settle
      if (!user && pathname !== '/login' && pathname !== '/register') {
        router.replace('/login');
      }
      if (user && (pathname === '/login' || pathname === '/register')) {
         router.replace('/dashboard');
      }
    }
  }, [user, isInitialLoading, router, pathname]);

  // Consider overall loading state: auth initially, then tasks for protected app routes
  const combinedLoading = isInitialLoading || (user && areRealtimeTasksLoading && pathname !== '/login' && pathname !== '/register');


  if (combinedLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-lg text-foreground">Loading TaskZen...</p>
      </div>
    );
  }
  
  // If auth is done, no user, and on a protected route (should be caught by useEffect redirect)
  if (!isInitialLoading && !user && pathname !== '/login' && pathname !== '/register') {
     return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
         <p className="ml-3 text-lg text-foreground">Redirecting...</p>
      </div>
    );
  }
  
  // If user is logged in and tries to access login/register (should be caught by useEffect redirect)
  if (!isInitialLoading && user && (pathname === '/login' || pathname === '/register')) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-lg text-foreground">Redirecting...</p>
      </div>
    );
  }

  return <>{children}</>;
};
