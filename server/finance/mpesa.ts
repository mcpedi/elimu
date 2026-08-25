export type MpesaPaymentRequest = {
  amount: number;
  phoneNumber: string;
  accountReference: string;
  transactionDescription: string;
};

export type MpesaPaymentResult = {
  providerReference: string;
  status: "initiated" | "confirmed" | "failed";
};

/**
 * Safaricom Daraja can be connected later by implementing this boundary. The
 * finance records already retain provider-agnostic and provider references.
 */
export interface MpesaPaymentAdapter {
  initiate(request: MpesaPaymentRequest): Promise<MpesaPaymentResult>;
  verify(providerReference: string): Promise<MpesaPaymentResult>;
}
