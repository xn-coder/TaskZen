
import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, ListChecks, PlusSquare, UserCircle, Settings, LogOut } from 'lucide-react';
import { APP_NAME } from '@/lib/constants';

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  label?: string;
  disabled?: boolean;
  external?: boolean;
  variant?: "default" | "ghost";
}

export const siteConfig = {
  name: APP_NAME,
  description: "Efficiently manage your team tasks with TaskZen.",
};

export const mainNavItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'My Tasks',
    href: '/tasks',
    icon: ListChecks,
  },
  {
    title: 'Create Task',
    href: '/tasks/create',
    icon: PlusSquare,
  },
];

export const userNavItems: NavItem[] = [
   {
    title: 'Profile',
    href: '#', // Placeholder for /profile
    icon: UserCircle,
    disabled: true,
  },
  {
    title: 'Settings',
    href: '#', // Placeholder for /settings
    icon: Settings,
    disabled: true,
  }
];

// No LogOut here, it's a function call within UserNav component.
