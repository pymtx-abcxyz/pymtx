import { NextRequest, NextResponse } from "next/server";
import { createConnectAccount } from "@/lib/payments";

export async function POST(req: NextRequest) {
  const { businessId } = await req.json();
  if (!businessId) {
    return NextResponse.json({ error: "businessId required" }, { status: 400 });
  }
  try {
    const result = await createConnectAccount(businessId);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Connect onboarding failed" },
      { status: 400 },
    );
  }
}
