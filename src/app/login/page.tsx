import { allowDemoMode } from "@/lib/env";
import LoginForm from "./login-form";

export const metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return <LoginForm allowDemo={allowDemoMode()} />;
}
