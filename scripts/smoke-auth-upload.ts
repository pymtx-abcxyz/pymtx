import { prisma } from "../src/lib/db";
import { createSession, verifyPassword } from "../src/lib/auth";
import { parseInvoiceCsv, uploadInvoicesForBusiness } from "../src/lib/invoice-upload";

async function main() {
  const admin = await prisma.user.findUnique({
    where: { email: "admin@harbor.example" },
  });
  const bizUser = await prisma.user.findUnique({
    where: { email: "billing@mapleridgedental.example" },
  });
  if (!admin || !bizUser || !bizUser.businessId) {
    throw new Error("Seed users missing — run npm run db:seed");
  }

  console.log("admin password", await verifyPassword("harbor-admin-demo", admin.passwordHash));
  console.log(
    "business password",
    await verifyPassword("harbor-business-demo", bizUser.passwordHash),
  );

  const session = await createSession(bizUser.id);
  console.log("session ok", session.token.slice(0, 8));

  const csv = `external_ref,description,amount,due_date,first_name,last_name,email,phone
INV-AUTH-1,Auth upload smoke,99.50,2026-04-01,Taylor,Kim,taylor.kim@example.com,`;
  const parsed = parseInvoiceCsv(csv);
  if (parsed.errors.length) {
    console.error(parsed.errors);
    throw new Error("CSV parse failed");
  }
  const result = await uploadInvoicesForBusiness(bizUser.businessId, parsed.rows);
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
