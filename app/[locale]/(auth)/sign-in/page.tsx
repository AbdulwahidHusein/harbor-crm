import { LoginComponent } from "./components/LoginComponent";
import { BRAND } from "@/lib/brand";

const SignInPage = async () => {
  return (
    <div className="w-full max-w-md">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in to {BRAND.name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Pick up where your relationships left off.</p>
      <div className="mt-8">
        <LoginComponent />
      </div>
    </div>
  );
};

export default SignInPage;
