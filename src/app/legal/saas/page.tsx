import { LegalProse, LegalShell } from "@/components/legal";
import { SAAS_AGREEMENT_TITLE, saasAgreementPlainText } from "@/lib/legal";

export default function SaasAgreementPage() {
  return (
    <LegalShell title={SAAS_AGREEMENT_TITLE}>
      <LegalProse text={saasAgreementPlainText()} />
    </LegalShell>
  );
}
