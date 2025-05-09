
import { LoginForm } from "@/components/auth/LoginForm";
import { CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Welcome Back!</CardTitle>
        <CardDescription>
          Please enter your credentials to access your tasks.
        </CardDescription>
      </CardHeader>
      <LoginForm />
    </>
  );
}
