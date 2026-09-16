import { Suspense } from "react";
import { LoadingScreen } from "@/components/ui";
import ResetPasswordForm from "./reset-password-form";

export const metadata = {
  title: "Reset password",
};

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingScreen label="Loading reset…" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
