
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
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check initial user session
    apiGetCurrentUser().then(currentUser => {
      setUser(currentUser);
      setIsInitialLoading(false);
    });

    // Subscribe to auth state changes
    const unsubscribe = onAuthStateChange(setUser);
    return () => unsubscribe(); // Cleanup subscription on unmount
  }, []);

  const handleLogin = useCallback(async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const loggedInUser = await apiLogin(email, pass);
      // setUser is handled by onAuthStateChange
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
      // setUser is handled by onAuthStateChange
      router.push('/dashboard'); // Or to a verification page if email verification is enabled
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
      // setUser is handled by onAuthStateChange
      router.push('/login');
    } catch (error) {
      console.error("Logout failed:", error);
      throw error; // Rethrow to allow UI to handle it
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

  // If trying to access auth pages while logged in, redirect to dashboard
  if (!isInitialLoading && user && (pathname === '/login' || pathname === '/register')) {
    router.replace('/dashboard');
    return ( // Render loader while redirecting
       <div className="flex h-screen w-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  // If not loading and not user, and not on auth pages, this implies redirect is pending or children shouldn't render
  if (!isInitialLoading && !user && pathname !== '/login' && pathname !== '/register') {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  return <>{children}</>;
};
