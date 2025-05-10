
"use client";

import type { AppUser } from '@/lib/auth'; 
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  getCurrentUser as apiGetCurrentUser,
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  onAuthStateChangeCallback // Use the renamed callback
} from '@/lib/auth';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

interface AuthContextType {
  user: AppUser | null;
  login: (email: string, pass: string) => Promise<AppUser | void>;
  register: (name: string, email: string, pass: string) => Promise<AppUser | void>;
  logout: () => Promise<void>;
  isLoading: boolean; 
  isInitialLoading: boolean; 
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(false); 
  const [isInitialLoading, setIsInitialLoading] = useState(true); 
  const router = useRouter();

  useEffect(() => {
    let didUnsubscribe = false;

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

    const unsubscribeAuthState = onAuthStateChangeCallback((appUser) => { // Use the renamed callback
      if (!didUnsubscribe) {
        setUser(appUser);
        if (isInitialLoading) {
            setIsInitialLoading(false);
        }
      }
    });

    return () => {
      didUnsubscribe = true;
      unsubscribeAuthState();
    };
  }, []); 

  const handleLogin = useCallback(async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const loggedInUser = await apiLogin(email, pass);
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
      router.push('/dashboard'); // Consider redirecting to a "please verify email" page or dashboard
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
    // If initial load is done, and there's no user, and we are not on public auth pages
    if (!isInitialLoading && !user && pathname !== '/login' && pathname !== '/register') {
      router.replace('/login');
    }
    // If initial load is done, and there IS a user, and we ARE on public auth pages
    if (!isInitialLoading && user && (pathname === '/login' || pathname === '/register')) {
       router.replace('/dashboard');
    }
  }, [user, isInitialLoading, router, pathname]);


  // While initial auth check is in progress, show a global loader
  if (isInitialLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-lg text-foreground">Loading TaskZen...</p>
      </div>
    );
  }

  // If after initial load, we are on a protected route without a user, show loader while redirecting
  if (!user && pathname !== '/login' && pathname !== '/register') {
     return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
         <p className="ml-3 text-lg text-foreground">Redirecting...</p>
      </div>
    );
  }
  
  // If user is logged in and tries to access login/register, show loader while redirecting
  if (user && (pathname === '/login' || pathname === '/register')) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-lg text-foreground">Redirecting...</p>
      </div>
    );
  }


  return <>{children}</>;
};
