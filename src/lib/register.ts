import { hashPassword, MIN_PASSWORD_LENGTH } from "./auth";
import { prisma } from "./db";
import { UserRole } from "./domain";
import { SAAS_AGREEMENT_VERSION } from "./legal";

export type RegisterMerchantInput = {
  name: string;
  email: string;
  password: string;
  legalName: string;
  tradeName: string;
  phone?: string;
  ontarioCorpNumber?: string;
  physicalAddress?: string;
  supportEmail?: string;
  saasAgreementAccepted: boolean;
  caslConsent: boolean;
};

export type RegisterMerchantResult = {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    businessId: string;
  };
  business: {
    id: string;
    legalName: string;
    tradeName: string;
  };
};

/**
 * Public merchant (OWNER) self-registration.
 * Creates Business + OWNER user under Path B SaaS / CASL consent.
 */
export async function registerMerchant(
  input: RegisterMerchantInput,
): Promise<RegisterMerchantResult> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const legalName = input.legalName.trim();
  const tradeName = input.tradeName.trim();
  const phone = input.phone?.trim() || null;
  const ontarioCorpNumber = input.ontarioCorpNumber?.trim() || null;
  const physicalAddress = input.physicalAddress?.trim() || null;
  const supportEmail =
    input.supportEmail?.trim().toLowerCase() || email;

  if (!name) throw new Error("Name is required");
  if (!email.includes("@")) throw new Error("Valid email required");
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (!legalName) throw new Error("Legal business name is required");
  if (!tradeName) throw new Error("Trade name is required");
  if (!input.saasAgreementAccepted) {
    throw new Error(
      "You must accept the Master SaaS Agreement & Merchant Indemnity",
    );
  }
  if (!input.caslConsent) {
    throw new Error("CASL identity consent is required");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("An account with that email already exists");
  }

  const passwordHash = await hashPassword(password);

  const result = await prisma.$transaction(async (tx) => {
    const business = await tx.business.create({
      data: {
        legalName,
        tradeName,
        email,
        phone,
        ontarioCorpNumber,
        physicalAddress,
        supportEmail,
        caslConsentAt: new Date(),
        saasAgreementAcceptedAt: new Date(),
        saasAgreementVersion: SAAS_AGREEMENT_VERSION,
      },
    });

    const user = await tx.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: UserRole.OWNER,
        businessId: business.id,
      },
    });

    return { user, business };
  });

  return {
    user: {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      role: result.user.role,
      businessId: result.business.id,
    },
    business: {
      id: result.business.id,
      legalName: result.business.legalName,
      tradeName: result.business.tradeName,
    },
  };
}
