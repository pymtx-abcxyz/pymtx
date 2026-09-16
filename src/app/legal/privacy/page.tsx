import { LegalProse, LegalShell } from "@/components/legal";
import { privacyPolicyPlainText } from "@/lib/legal";

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy & CASL Electronic Disclosure">
      <LegalProse text={privacyPolicyPlainText()} />
    </LegalShell>
  );
}
