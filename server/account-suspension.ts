export const DISABLED_ACCOUNT_MESSAGE = "Your account is temporarily disabled. Contact System Admin for help.";

export function normalizeSuspensionReason(reason?: string | null) {
  return reason?.trim() || "Temporarily disabled by school administration";
}

export function isAccountDisabled(disabledAt?: Date | null) {
  return Boolean(disabledAt);
}
