
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { userNavItems } from "@/config/nav";
import Link from "next/link";
import { LogOut, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function UserNav() {
  const { user, logout, isLoading: authActionLoading, isInitialLoading: authInitialLoading } = useAuth();
  const { toast } = useToast();

  // Show loader if initial auth check is happening or an auth action (like logout) is in progress.
  if (authInitialLoading || (authActionLoading && !user)) { // Also show loader if logging out and user becomes null
    return <Loader2 className="h-6 w-6 animate-spin text-primary" />;
  }

  // If no user after initial load (and not during an action), don't render anything.
  // This could happen if user logs out and component re-renders before redirect.
  if (!user) {
    return null;
  }
  
  // At this point, user object should exist. Profile might still be loading or null if fetch failed.
  // For Firebase, main user info (displayName, email, photoURL) is on user object itself.
  // user.profile is custom and might take a moment or fail.
  const displayName = user.displayName || user.profile?.name || user.email?.split('@')[0] || "User";
  const displayEmail = user.email || user.profile?.email || "No email";
  const avatarSrc = user.photoURL || user.profile?.avatar_url || `https://avatar.vercel.sh/${user.email || user.uid}.png`;
  const avatarFallback = displayName.charAt(0).toUpperCase();


  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
      // Redirect is handled by AuthContext or ProtectedRoute
    } catch (error: any) {
       toast({
        title: "Logout Failed",
        description: error.message || "Could not log out. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-9 w-9">
            <AvatarImage src={avatarSrc} alt={displayName} data-ai-hint="profile avatar" />
            <AvatarFallback>{avatarFallback}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {displayEmail}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {userNavItems.map((item) => (
            <DropdownMenuItem key={item.href} asChild disabled={item.disabled}>
              <Link href={item.href}>
                <item.icon className="mr-2 h-4 w-4" />
                <span>{item.title}</span>
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} disabled={authActionLoading}>
          {authActionLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="mr-2 h-4 w-4" />
          )}
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
