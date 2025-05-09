
import { mockUsers } from './store';
import type { User } from './types';

// Simulate a session by storing user in localStorage (for persistence across refreshes in mock environment)
const SESSION_KEY = 'taskzen_mock_user';

export const getCurrentUser = (): User | null => {
  if (typeof window === 'undefined') return null; // Avoid SSR errors
  const storedUser = localStorage.getItem(SESSION_KEY);
  return storedUser ? JSON.parse(storedUser) : null;
};

const setCurrentUser = (user: User | null) => {
  if (typeof window === 'undefined') return;
  if (user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
};

export const login = (email: string, _password: string): Promise<User> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const user = mockUsers.find(u => u.email === email);
      if (user) {
        setCurrentUser(user);
        resolve(user);
      } else {
        reject(new Error('Invalid email or password'));
      }
    }, 500);
  });
};

export const register = (name: string, email: string, _password: string): Promise<User> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (mockUsers.find(u => u.email === email)) {
        reject(new Error('User already exists with this email'));
        return;
      }
      const newUser: User = {
        id: `user${mockUsers.length + 1}`, // In a real app, ID would come from backend
        name,
        email,
        avatar: `https://picsum.photos/seed/${encodeURIComponent(email)}/40/40`,
      };
      mockUsers.push(newUser); // Add to in-memory store (not persistent beyond server restarts if this were backend)
      setCurrentUser(newUser);
      resolve(newUser);
    }, 500);
  });
};

export const logout = (): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      setCurrentUser(null);
      resolve();
    }, 300);
  });
};
