import express, { type Express, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { auditLogs, subscriptionPaymentCallbacks, subscriptionPayments, schoolSubscriptions } from "../../drizzle/schema";
import { getDb } from "../db";
import { classifyDarajaCallback, getDarajaConfig, isValidDarajaCallbackUrl, normalizeKenyanPhoneNumber } from "./mpesa";

type CallbackValue = string | number | null | undefined;

type StoredCallback = {
  checkoutRequestId: string;
  merchantRequestId: string;
  resultCode: number;
  resultDescription: string;
  amount: number | null;
  phoneNumber: string | null;
  receiptNumber: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}

function extractMetadata(items: unknown): Map<string, CallbackValue> {
  const result = new Map<string, CallbackValue>();
  if (!Array.isArray(items)) return result;
  for (const item of items) {
    const entry = asRecord(item);
    if (entry && typeof entry.Name === "string") result.set(entry.Name, entry.Value as CallbackValue);
  }
  return result;
}

export function addBillingPeriod(start: Date, period: "monthly" | "annual"): Date {
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth();
  const day = start.getUTCDate();
  const targetMonth = period === "monthly" ? month + 1 : month;
  const targetYear = period === "monthly" ? year : year + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay), start.getUTCHours(), start.getUTCMinutes(), start.getUTCSeconds(), start.getUTCMilliseconds()));
}

export async function processPendingDarajaCallback(checkoutRequestId: string) {
  const db = await getDb();
  if (!db) return { kind: "unavailable" as const };

  return db.transaction(async tx => {
    const [event] = await tx.select().from(subscriptionPaymentCallbacks)
      .where(eq(subscriptionPaymentCallbacks.checkoutRequestId, checkoutRequestId))
      .for("update");
    if (!event || event.processedAt) return { kind: "already_processed" as const };

    const [payment] = await tx.select().from(subscriptionPayments)
      .where(eq(subscriptionPayments.checkoutRequestId, checkoutRequestId))
      .for("update");
    // The provider callback can beat persistence of the STK response. Keep the event
    // pending; startCheckout replays it immediately after saving the request IDs.
    if (!payment) return { kind: "waiting_for_checkout" as const };

    const now = new Date();
    // A verified success is terminal. Failed/review rows may still receive a genuine
    // late success callback, which must be allowed to activate a paid subscription.
    if (payment.status === "succeeded") {
      await tx.update(subscriptionPaymentCallbacks).set({ processedAt: now }).where(eq(subscriptionPaymentCallbacks.id, event.id));
      return { kind: "duplicate" as const };
    }
    const auditPayment = (action: string, metadata?: Record<string, unknown>) => tx.insert(auditLogs).values({
      schoolId: payment.schoolId,
      actorUserId: null,
      action,
      entityType: "subscriptionPayment",
      entityId: String(payment.id),
      metadata,
    });

    const classification = classifyDarajaCallback({
      merchantRequestMatches: payment.merchantRequestId === event.merchantRequestId,
      resultCode: event.resultCode,
      expectedAmount: payment.amount,
      callbackAmount: event.amount ?? Number.NaN,
      expectedPhoneNumber: payment.phoneNumber,
      callbackPhoneNumber: event.phoneNumber ?? "",
      receiptNumber: event.receiptNumber ?? "",
    });

    if (classification === "failed") {
      await tx.update(subscriptionPayments).set({
        status: "failed",
        callbackResultCode: event.resultCode,
        callbackResultDescription: (event.resultDescription ?? "").slice(0, 500),
        callbackReceivedAt: event.receivedAt,
        completedAt: now,
        updatedAt: now,
      }).where(eq(subscriptionPayments.id, payment.id));
      await tx.update(subscriptionPaymentCallbacks).set({ processedAt: now }).where(eq(subscriptionPaymentCallbacks.id, event.id));
      await auditPayment("subscription.payment_failed", { resultCode: event.resultCode, resultDescription: event.resultDescription });
      return { kind: "failed" as const, paymentId: payment.id, schoolId: payment.schoolId };
    }

    if (classification === "review_required") {
      const mismatchedMerchant = payment.merchantRequestId !== event.merchantRequestId;
      await tx.update(subscriptionPayments).set({
        status: "review_required",
        callbackResultCode: event.resultCode,
        callbackResultDescription: mismatchedMerchant
          ? "Merchant request reference did not match the stored checkout."
          : "Success callback did not match the expected amount, phone, or receipt fields.",
        callbackAmount: event.amount,
        callbackPhoneNumber: event.phoneNumber,
        callbackReceivedAt: event.receivedAt,
        updatedAt: now,
      }).where(eq(subscriptionPayments.id, payment.id));
      await tx.update(subscriptionPaymentCallbacks).set({ processedAt: now }).where(eq(subscriptionPaymentCallbacks.id, event.id));
      await auditPayment("subscription.payment_review_required", { reason: mismatchedMerchant ? "merchant_request_mismatch" : "success_callback_mismatch", resultCode: event.resultCode });
      return { kind: "review" as const, paymentId: payment.id, schoolId: payment.schoolId };
    }

    const [currentSubscription] = await tx.select().from(schoolSubscriptions)
      .where(eq(schoolSubscriptions.schoolId, payment.schoolId))
      .for("update");
    const [receiptOwner] = event.receiptNumber
      ? await tx.select({ id: subscriptionPayments.id }).from(subscriptionPayments).where(eq(subscriptionPayments.receiptNumber, event.receiptNumber)).limit(1)
      : [];
    if (receiptOwner && receiptOwner.id !== payment.id) {
      await tx.update(subscriptionPayments).set({
        status: "review_required",
        callbackResultCode: event.resultCode,
        callbackResultDescription: "M-Pesa receipt is already associated with another payment.",
        callbackAmount: event.amount,
        callbackPhoneNumber: event.phoneNumber,
        callbackReceivedAt: event.receivedAt,
        updatedAt: now,
      }).where(eq(subscriptionPayments.id, payment.id));
      await tx.update(subscriptionPaymentCallbacks).set({ processedAt: now }).where(eq(subscriptionPaymentCallbacks.id, event.id));
      await auditPayment("subscription.payment_review_required", { reason: "receipt_already_used", resultCode: event.resultCode });
      return { kind: "review" as const, paymentId: payment.id, schoolId: payment.schoolId };
    }
    const versionMatches = currentSubscription
      ? payment.expectedSubscriptionUpdatedAt?.getTime() === currentSubscription.updatedAt.getTime()
      : payment.expectedSubscriptionUpdatedAt === null;
    if (!versionMatches) {
      await tx.update(subscriptionPayments).set({
        status: "review_required",
        callbackResultCode: event.resultCode,
        callbackResultDescription: "The school subscription changed after checkout began; administrator review is required.",
        callbackAmount: event.amount,
        callbackPhoneNumber: event.phoneNumber,
        receiptNumber: event.receiptNumber,
        callbackReceivedAt: event.receivedAt,
        updatedAt: now,
      }).where(eq(subscriptionPayments.id, payment.id));
      await tx.update(subscriptionPaymentCallbacks).set({ processedAt: now }).where(eq(subscriptionPaymentCallbacks.id, event.id));
      await auditPayment("subscription.payment_review_required", { reason: "subscription_changed_during_checkout", resultCode: event.resultCode });
      return { kind: "review" as const, paymentId: payment.id, schoolId: payment.schoolId };
    }

    const existingPeriodEnd = currentSubscription?.currentPeriodEndsAt;
    const continuation = currentSubscription
      && currentSubscription.plan === payment.plan
      && currentSubscription.billingPeriod === payment.billingPeriod
      && existingPeriodEnd
      && existingPeriodEnd > now;
    const periodStartsAt = continuation ? existingPeriodEnd : now;
    const periodEndsAt = addBillingPeriod(periodStartsAt, payment.billingPeriod);

    await tx.update(subscriptionPayments).set({
      status: "succeeded",
      callbackResultCode: event.resultCode,
      callbackResultDescription: (event.resultDescription ?? "").slice(0, 500),
      callbackAmount: event.amount,
      callbackPhoneNumber: event.phoneNumber,
      receiptNumber: event.receiptNumber,
      callbackReceivedAt: event.receivedAt,
      completedAt: now,
      updatedAt: now,
    }).where(eq(subscriptionPayments.id, payment.id));

    await tx.insert(schoolSubscriptions).values({
      schoolId: payment.schoolId,
      plan: payment.plan,
      status: "active",
      billingPeriod: payment.billingPeriod,
      updatedByUserId: payment.userId,
      changeNote: `M-Pesa payment ${event.receiptNumber}`,
      currentPeriodStartsAt: periodStartsAt,
      currentPeriodEndsAt: periodEndsAt,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: schoolSubscriptions.schoolId,
      set: {
        plan: payment.plan,
        status: "active",
        billingPeriod: payment.billingPeriod,
        updatedByUserId: payment.userId,
        changeNote: `M-Pesa payment ${event.receiptNumber}`,
        currentPeriodStartsAt: periodStartsAt,
        currentPeriodEndsAt: periodEndsAt,
        updatedAt: now,
      },
    });
    await tx.update(subscriptionPaymentCallbacks).set({ processedAt: now }).where(eq(subscriptionPaymentCallbacks.id, event.id));
    await auditPayment("subscription.payment_confirmed", { plan: payment.plan, billingPeriod: payment.billingPeriod, amount: payment.amount, currency: "KES", receiptNumber: event.receiptNumber });
    return { kind: "succeeded" as const, paymentId: payment.id, schoolId: payment.schoolId, plan: payment.plan, billingPeriod: payment.billingPeriod, amount: payment.amount, receiptNumber: event.receiptNumber };
  });
}

async function handleDarajaCallback(req: Request, res: Response) {
  const body = asRecord(req.body);
  const bodyContent = asRecord(body?.Body);
  const callback = asRecord(bodyContent?.stkCallback);
  const checkoutRequestId = asString(callback?.CheckoutRequestID);
  const merchantRequestId = asString(callback?.MerchantRequestID);
  const resultCode = Number(callback?.ResultCode);
  if (!checkoutRequestId || !merchantRequestId || !Number.isInteger(resultCode)) {
    res.status(400).json({ ResultCode: 1, ResultDesc: "Invalid callback payload" });
    return;
  }

  const db = await getDb();
  if (!db) {
    res.status(503).json({ ResultCode: 1, ResultDesc: "Callback could not be stored" });
    return;
  }

  try {
    const metadata = extractMetadata(asRecord(callback?.CallbackMetadata)?.Item);
    const rawAmount = Number(metadata.get("Amount"));
    let phoneNumber: string | null = null;
    try {
      phoneNumber = normalizeKenyanPhoneNumber(asString(metadata.get("PhoneNumber")));
    } catch {
      phoneNumber = null;
    }
    const event: StoredCallback = {
      checkoutRequestId,
      merchantRequestId,
      resultCode,
      resultDescription: asString(callback?.ResultDesc).slice(0, 500),
      amount: Number.isInteger(rawAmount) ? rawAmount : null,
      phoneNumber,
      receiptNumber: asString(metadata.get("MpesaReceiptNumber")).slice(0, 32) || null,
    };
    await db.insert(subscriptionPaymentCallbacks).values(event).onConflictDoNothing({ target: subscriptionPaymentCallbacks.checkoutRequestId });
    await processPendingDarajaCallback(checkoutRequestId);
    // Acknowledge only after the callback was durably stored. If processing fails,
    // the event remains unprocessed and can be replayed by checkout creation/status polling.
    res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error) {
    console.error("[M-Pesa] Callback processing failed; callback contents omitted.", error instanceof Error ? error.name : "unknown error");
    res.status(503).json({ ResultCode: 1, ResultDesc: "Callback could not be stored" });
  }
}

export function registerDarajaCallback(app: Express) {
  const callbackUrl = getDarajaConfig().callbackUrl;
  if (!isValidDarajaCallbackUrl(callbackUrl)) return;
  const callbackPath = new URL(callbackUrl).pathname;
  app.post(callbackPath, express.json({ limit: "64kb", type: "application/json" }), (req, res) => {
    void handleDarajaCallback(req, res);
  });
}
