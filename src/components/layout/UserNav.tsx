
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

  if (authInitialLoading || (authActionLoading && !user)) {
    return <Loader2 className="h-6 w-6 animate-spin text-primary" />;
  }

  if (!user) {
    return null;
  }
  
  // Supabase stores custom data in user_metadata or in a separate 'profiles' table.
  // AuthContext's AppUser tries to merge these into `user.profile`.
  // `user.user_metadata.name` might exist if set during signup.
  // `user.profile.name` is from the linked 'profiles' table.
  const displayName = user.profile?.name || user.user_metadata?.name || user.email?.split('@')[0] || "User";
  const displayEmail = user.email || user.profile?.email || "No email";
  // Supabase's `user.user_metadata.avatar_url` or `user.profile.avatar_url`
  const avatarSrc = user.profile?.avatar_url || user.user_metadata?.avatar_url || `https://avatar.vercel.sh/${user.email || user.id}.png`;
  const avatarFallback = displayName ? displayName.charAt(0).toUpperCase() : "U";


  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
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
            <AvatarImage src={avatarSrc} alt={displayName || "User avatar"} data-ai-hint="profile avatar" />
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
            <DropdownMenuItem key={item.title} asChild disabled={item.disabled}> 
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
