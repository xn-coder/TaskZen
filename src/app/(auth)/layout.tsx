
import { APP_NAME } from '@/lib/constants';
import { CheckSquare } from 'lucide-react'; 
import Image from 'next/image';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 sm:mb-8 flex flex-col items-center">
          <div className="flex items-center text-primary mb-2">
            {/* Apply responsive sizing using Tailwind classes */}
            <CheckSquare className="h-10 w-10 sm:h-12 sm:w-12 mr-2" />
            <h1 className="text-3xl sm:text-4xl font-bold">{APP_NAME}</h1>
          </div>
          <p className="text-sm sm:text-base text-muted-foreground text-center">Efficiently manage your team tasks.</p>
        </div>
        <div className="rounded-lg border bg-card p-4 sm:p-6 shadow-lg md:p-8">
          {children}
        </div>
         <p className="mt-4 sm:mt-6 text-center text-xs sm:text-sm text-muted-foreground">
            A modern solution for team collaboration.
          </p>
      </div>
    </div>
  );
}

