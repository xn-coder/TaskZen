
"use client";

import Link from 'next/link';
import { siteConfig, mainNavItems } from '@/config/nav';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CheckSquare, PanelLeft } from 'lucide-react';
import { AppSidebarNav } from './AppSidebarNav';
import { useState } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';

export function AppSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <TooltipProvider>
    <aside
      className={cn(
        "hidden md:flex flex-col border-r bg-card transition-all duration-300 ease-in-out",
        isCollapsed ? "w-16" : "w-60"
      )}
    >
      <div className={cn("flex h-16 items-center border-b px-4 shrink-0", isCollapsed ? "justify-center" : "justify-between")}>
        <Link href="/dashboard" className={cn("flex items-center text-primary", isCollapsed && "justify-center w-full")}>
          <CheckSquare className={cn("h-7 w-7", !isCollapsed && "mr-2")} />
          {!isCollapsed && <span className="text-xl font-bold">{siteConfig.name}</span>}
        </Link>
        {!isCollapsed && (
          <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(true)} className="hidden lg:flex">
            <PanelLeft className="h-5 w-5" />
            <span className="sr-only">Collapse Sidebar</span>
          </Button>
        )}
      </div>
      {isCollapsed && (
         <div className="flex h-16 items-center justify-center border-b px-2 shrink-0">
            <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(false)}>
                <PanelLeft className="h-5 w-5 rotate-180" /> {/* Icon indicates expand */}
                <span className="sr-only">Expand Sidebar</span>
            </Button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto py-4">
        <AppSidebarNav items={mainNavItems} isCollapsed={isCollapsed} />
      </div>
      {/* Optional Footer */}
      {/* <div className="mt-auto border-t p-4">
          // Sidebar footer content
      </div> */}
    </aside>
    </TooltipProvider>
  );
}
