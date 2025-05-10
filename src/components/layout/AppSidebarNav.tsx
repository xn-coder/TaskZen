
"use client";

import * as React from "react"; // Imported React for React.memo
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/config/nav";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AppSidebarNavProps {
  items: NavItem[];
  isCollapsed?: boolean;
  isMobile?: boolean; 
}

const AppSidebarNavComponent = ({ items, isCollapsed = false, isMobile = false }: AppSidebarNavProps) => {
  const pathname = usePathname();

  if (!items?.length) {
    return null;
  }

  let mostSpecificActiveHref = "";
  if (pathname) {
    for (const navItem of items) {
      if (navItem.href && pathname.startsWith(navItem.href)) {
        if (navItem.href.length > mostSpecificActiveHref.length) {
          mostSpecificActiveHref = navItem.href;
        }
      }
    }
  }


  return (
    <nav className={cn("grid gap-1 px-2", isMobile && "mt-2")}>
      {items.map((item, index) => {
        const Icon = item.icon;
        const isActive = item.href === mostSpecificActiveHref;

        if (isCollapsed && !isMobile) {
          return (
            <Tooltip key={index} delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  className={cn(
                    buttonVariants({ variant: isActive ? "default" : "ghost", size: "icon" }),
                    "h-10 w-10",
                    isActive && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
                    !isActive && "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    item.disabled && "pointer-events-none opacity-60"
                  )}
                  aria-label={item.title}
                >
                  <Icon className="h-5 w-5" />
                  <span className="sr-only">{item.title}</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="flex items-center gap-4">
                {item.title}
                {item.label && (
                  <span className="ml-auto text-muted-foreground">
                    {item.label}
                  </span>
                )}
              </TooltipContent>
            </Tooltip>
          );
        }

        return (
          <Link
            key={index}
            href={item.href}
            className={cn(
              buttonVariants({ variant: isActive ? "default" : "ghost", size: "default" }),
              "justify-start px-3",
               isActive && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
               !isActive && "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              item.disabled && "pointer-events-none opacity-60"
            )}
          >
            <Icon className={cn("mr-2 h-5 w-5", isActive && "text-primary-foreground")}/>
            {item.title}
            {item.label && (
              <span
                className={cn(
                  "ml-auto",
                  isActive && "text-primary-foreground"
                )}
              >
                {item.label}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
};

export const AppSidebarNav = React.memo(AppSidebarNavComponent);
