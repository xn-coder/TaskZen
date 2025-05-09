"use client";

import type { AppUser } from '@/lib/auth'; // Updated User type
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  getCurrentUser as apiGetCurrentUser,
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  onAuthStateChange // Import Supabase auth state listener
} from '@/lib/auth';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

interface AuthContextType {
  user: AppUser | null;
  login: (email: string, pass: string) => Promise<AppUser | void>;
  register: (name: string, email: string, pass: string) => Promise<AppUser | void>;
  logout: () => Promise<void>;
  isLoading: boolean; // General loading state for auth actions
  isInitialLoading: boolean; // For initial auth check on app load
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(false); // For login/register/logout actions
  const [isInitialLoading, setIsInitialLoading] = useState(true); // For the very first auth check
  const router = useRouter();

  useEffect(() => {
    let didUnsubscribe = false;

    // Perform the initial check for an existing session
    setIsInitialLoading(true);
    apiGetCurrentUser()
      .then(currentUser => {
        if (!didUnsubscribe) {
          setUser(currentUser);
        }
      })
      .catch(error => {
        console.error("AuthContext: Error on initial getCurrentUser", error);
        if (!didUnsubscribe) {
          setUser(null);
        }
      })
      .finally(() => {
        if (!didUnsubscribe) {
          setIsInitialLoading(false);
        }
      });

    // Subscribe to subsequent auth state changes (login, logout)
    const unsubscribeAuthState = onAuthStateChange((appUser) => {
      if (!didUnsubscribe) {
        // console.log("AuthContext: Auth state changed, new AppUser:", appUser);
        setUser(appUser);
        // If an auth event occurs (login/logout), it means the initial loading phase is effectively over,
        // or this is an update. Ensure isInitialLoading is false.
        if (isInitialLoading) {
            setIsInitialLoading(false);
        }
      }
    });

    return () => {
      didUnsubscribe = true;
      unsubscribeAuthState();
    };
  }, []); // Empty dependency array: runs once on mount and cleans up on unmount

  const handleLogin = useCallback(async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const loggedInUser = await apiLogin(email, pass);
      // setUser(loggedInUser) is handled by onAuthStateChange
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
      // setUser(registeredUser) is handled by onAuthStateChange
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
      // setUser(null) is handled by onAuthStateChange
      router.push('/login');
    } catch (error) {
      console.error("Logout failed:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, login: handleLogin, register: handleRegister, logout: handleLogout, isLoading, isInitialLoading }}>
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
  const { user, isInitialLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isInitialLoading && !user && pathname !== '/login' && pathname !== '/register') {
      router.replace('/login');
    }
  }, [user, isInitialLoading, router, pathname]);

  if (isInitialLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!isInitialLoading && user && (pathname === '/login' || pathname === '/register')) {
    router.replace('/dashboard');
    return (
       <div className="flex h-screen w-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!isInitialLoading && !user && pathname !== '/login' && pathname !== '/register') {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
};
