
"use client";

import type { User } from '@/lib/types';
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { getCurrentUser as getInitialUser, login as apiLogin, register as apiRegister, logout as apiLogout } from '@/lib/auth';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

interface AuthContextType {
  user: User | null;
  login: (email: string, pass: string) => Promise<User | void>;
  register: (name: string, email: string, pass: string) => Promise<User | void>;
  logout: () => Promise<void>;
  isLoading: boolean; // General loading state for auth actions
  isInitialLoading: boolean; // For initial auth check on app load
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkUser = () => {
      const currentUser = getInitialUser();
      setUser(currentUser);
      setIsInitialLoading(false);
    };
    checkUser();
  }, []);

  const handleLogin = useCallback(async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const loggedInUser = await apiLogin(email, pass);
      setUser(loggedInUser);
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
      setUser(registeredUser);
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
      setUser(null);
      router.push('/login');
    } catch (error) {
      console.error("Logout failed:", error);
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

// Component to protect routes
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

  if (!user && pathname !== '/login' && pathname !== '/register') {
    // This will be caught by useEffect, but as an extra measure.
    // Or, if already on login/register, allow rendering.
    return null; 
  }
  
  return <>{children}</>;
};
