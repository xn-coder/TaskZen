
import Link from 'next/link';
import { siteConfig } from '@/config/nav';
import { UserNav } from './UserNav';
import { Button } from '@/components/ui/button';
import { CheckSquare, Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'; // Added SheetTitle
import { AppSidebarNav } from './AppSidebarNav'; 

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-card shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden mr-2">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[240px] p-0">
              <SheetTitle className="sr-only">{siteConfig.name} Navigation Menu</SheetTitle> {/* Visually hidden title for accessibility */}
              <div className="flex h-16 items-center border-b px-4">
                <Link href="/dashboard" className="flex items-center text-primary">
                  <CheckSquare className="mr-2 h-6 w-6" />
                  <span className="font-bold">{siteConfig.name}</span>
                </Link>
              </div>
              <nav className="py-4">
                <AppSidebarNav items={mainNavItems} isMobile={true} />
              </nav>
            </SheetContent>
          </Sheet>
          <Link href="/dashboard" className="hidden md:flex items-center text-primary">
            <CheckSquare className="mr-2 h-7 w-7" />
            <span className="text-xl font-bold">{siteConfig.name}</span>
          </Link>
        </div>
        
        {/* Future: Add global search here if needed */}

        <div className="flex items-center space-x-4">
          <UserNav />
        </div>
      </div>
    </header>
  );
}

// Need to import mainNavItems for mobile sidebar.
import { mainNavItems } from '@/config/nav';

