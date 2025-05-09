
import { APP_NAME } from '@/lib/constants';
import { CheckSquare } from 'lucide-react'; // Using CheckSquare as a logo icon
import Image from 'next/image';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          {/* Logo/App Name */}
          <div className="flex items-center text-primary mb-2">
            <CheckSquare size={48} className="mr-2" />
            <h1 className="text-4xl font-bold">{APP_NAME}</h1>
          </div>
          <p className="text-muted-foreground text-center">Efficiently manage your team tasks.</p>
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-lg sm:p-8">
          {children}
        </div>
         <p className="mt-6 text-center text-sm text-muted-foreground">
            A modern solution for team collaboration.
          </p>
      </div>
    </div>
  );
}
