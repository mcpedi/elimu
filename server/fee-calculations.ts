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

export function adjustFeeDue(amountPaid: number, newAmountDue: number) {
  if (![amountPaid, newAmountDue].every(Number.isFinite) || amountPaid < 0 || newAmountDue < 0) {
    throw new Error("Fee amounts must be valid and non-negative.");
  }
  if (newAmountDue < amountPaid) {
    throw new Error("New fee amount cannot be lower than recorded payments.");
  }
  return {
    balance: newAmountDue - amountPaid,
    status: amountPaid === 0 ? "unpaid" as const : amountPaid >= newAmountDue ? "paid" as const : "partial" as const,
  };
}
