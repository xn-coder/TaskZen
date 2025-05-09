
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
  const { user, logout, isLoading: authActionLoading } = useAuth(); // Renamed isLoading to authActionLoading
  const { toast } = useToast();

  if (!user || !user.profile) { // Check for user and profile
    // If still loading or no user/profile, show minimal or nothing
    return authActionLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : null; 
  }

  const { profile } = user; // Destructure profile for easier access

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
    } catch (error) {
       toast({
        title: "Logout Failed",
        description: "Could not log out. Please try again.",
        variant: "destructive",
      });
    }
  };

  const avatarSrc = profile.avatar_url || `https://avatar.vercel.sh/${profile.email || profile.id}.png`;
  const avatarFallback = profile.name ? profile.name.charAt(0).toUpperCase() : (profile.email ? profile.email.charAt(0).toUpperCase() : 'U');


  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-9 w-9">
            <AvatarImage src={avatarSrc} alt={profile.name || 'User Avatar'} data-ai-hint="profile avatar" />
            <AvatarFallback>{avatarFallback}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{profile.name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {profile.email}
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
