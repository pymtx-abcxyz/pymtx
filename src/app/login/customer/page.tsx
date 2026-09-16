import { allowDemoMode } from "@/lib/env";
import CustomerLoginForm from "./customer-login-form";

export const metadata = {
  title: "Customer sign-in",
};

export default function CustomerLoginPage() {
  return <CustomerLoginForm allowDemo={allowDemoMode()} />;
}
