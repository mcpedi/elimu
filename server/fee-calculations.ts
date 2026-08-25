export function applyPayment(amountDue: number, amountPaid: number, paymentAmount: number) {
  if (![amountDue, amountPaid, paymentAmount].every(Number.isFinite) || amountDue < 0 || amountPaid < 0 || paymentAmount <= 0) {
    throw new Error("Fee amounts must be valid and the payment amount must be positive.");
  }
  const newPaid = amountPaid + paymentAmount;
  return {
    newPaid,
    balance: Math.max(0, amountDue - newPaid),
    status: newPaid >= amountDue ? "paid" as const : "partial" as const,
  };
}
