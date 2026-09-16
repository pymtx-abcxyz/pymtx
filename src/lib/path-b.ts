/**
 * Path B zero-custody invariants — fail closed if a charge omits connected account.
 */
export function assertConnectedAccountDirectCharge(
  stripeAccountId: string | null | undefined,
  context: string,
): asserts stripeAccountId is string {
  if (!stripeAccountId || !stripeAccountId.trim()) {
    throw new Error(
      `${context}: Path B requires Direct Charges on the merchant Connect account ({ stripeAccount }). Platform balance custody is forbidden.`,
    );
  }
  if (
    stripeAccountId.startsWith("acct_") === false &&
    !stripeAccountId.startsWith("acct_demo_")
  ) {
    // Allow demo ids; live ids are acct_*
    throw new Error(
      `${context}: invalid connected account id for Direct Charge`,
    );
  }
}

/** Reject Destination Charge / transfer_data shaped payloads. */
export function assertNoDestinationChargePayload(
  payload: Record<string, unknown>,
  context: string,
) {
  if ("transfer_data" in payload && payload.transfer_data != null) {
    throw new Error(
      `${context}: transfer_data / Destination Charges are forbidden under Path B zero-custody`,
    );
  }
  if ("on_behalf_of" in payload && payload.on_behalf_of != null) {
    throw new Error(
      `${context}: on_behalf_of charge routing is forbidden under Path B zero-custody`,
    );
  }
}
