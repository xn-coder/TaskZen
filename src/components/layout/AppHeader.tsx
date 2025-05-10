
import Link from 'next/link';
import { siteConfig, mainNavItems } from '@/config/nav'; // Moved mainNavItems import here
import { UserNav } from './UserNav';
import { Button } from '@/components/ui/button';
import { CheckSquare, Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader, SheetDescription } from '@/components/ui/sheet'; 
import { AppSidebarNav } from './AppSidebarNav'; 

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-card shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden mr-2">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[240px] p-0 flex flex-col">
               <SheetHeader className="border-b p-4">
                 <Link href="/dashboard" className="flex items-center text-primary">
                    <CheckSquare className="mr-2 h-6 w-6" />
                    <SheetTitle className="font-bold text-lg">{siteConfig.name}</SheetTitle>
                 </Link>
                </SheetHeader>
              <nav className="py-4 flex-1 overflow-y-auto">
                <AppSidebarNav items={mainNavItems} isMobile={true} />
              </nav>
              {/* Optional: Add a footer to the mobile sheet */}
              {/* <div className="border-t p-4">
                <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} {siteConfig.name}</p>
              </div> */}
            </SheetContent>
          </Sheet>
          <Link href="/dashboard" className="hidden md:flex items-center text-primary">
            <CheckSquare className="mr-2 h-7 w-7" />
            <span className="text-xl font-bold">{siteConfig.name}</span>
          </Link>
        </div>
        
        <div className="flex items-center space-x-2 sm:space-x-4">
          <UserNav />
        </div>
      </div>
    </header>
  );
}
