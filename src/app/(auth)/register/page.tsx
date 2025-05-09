
import { RegisterForm } from "@/components/auth/RegisterForm";
import { CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function RegisterPage() {
  return (
    <>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Create an Account</CardTitle>
        <CardDescription>
          Join TaskZen and start managing your tasks effectively.
        </CardDescription>
      </CardHeader>
      <RegisterForm />
    </>
  );
}
