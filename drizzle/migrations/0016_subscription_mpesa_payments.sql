ALTER TABLE "schoolSubscriptions"
  ADD COLUMN IF NOT EXISTS "currentPeriodStartsAt" timestamp,
  ADD COLUMN IF NOT EXISTS "currentPeriodEndsAt" timestamp;

CREATE TABLE IF NOT EXISTS "subscriptionPayments" (
  "id" serial PRIMARY KEY,
  "schoolId" integer NOT NULL REFERENCES "schools"("id"),
  "userId" integer NOT NULL REFERENCES "users"("id"),
  "plan" text NOT NULL CHECK ("plan" IN ('Pro', 'Enterprise')),
  "billingPeriod" text NOT NULL CHECK ("billingPeriod" IN ('monthly', 'annual')),
  "amount" integer NOT NULL CHECK ("amount" > 0),
  "currency" varchar(3) NOT NULL DEFAULT 'KES',
  "phoneNumber" varchar(12) NOT NULL,
  "idempotencyKey" varchar(36) NOT NULL,
  "expectedSubscriptionUpdatedAt" timestamp,
  "checkoutRequestId" varchar(128),
  "merchantRequestId" varchar(128),
  "receiptNumber" varchar(32),
  "status" text NOT NULL DEFAULT 'initiating' CHECK ("status" IN ('initiating', 'pending', 'succeeded', 'failed', 'review_required')),
  "callbackResultCode" integer,
  "callbackResultDescription" text,
  "callbackAmount" integer,
  "callbackPhoneNumber" varchar(12),
  "callbackReceivedAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  "completedAt" timestamp
);

CREATE TABLE IF NOT EXISTS "subscriptionPaymentCallbacks" (
  "id" serial PRIMARY KEY,
  "checkoutRequestId" varchar(128) NOT NULL,
  "merchantRequestId" varchar(128) NOT NULL,
  "resultCode" integer NOT NULL,
  "resultDescription" text,
  "amount" integer,
  "phoneNumber" varchar(12),
  "receiptNumber" varchar(32),
  "receivedAt" timestamp NOT NULL DEFAULT now(),
  "processedAt" timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS "subscription_payment_idempotency_unique"
  ON "subscriptionPayments" ("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_payment_checkout_unique"
  ON "subscriptionPayments" ("checkoutRequestId");
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_payment_receipt_unique"
  ON "subscriptionPayments" ("receiptNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_payment_one_inflight_per_school"
  ON "subscriptionPayments" ("schoolId")
  WHERE "status" IN ('initiating', 'pending', 'review_required');
CREATE INDEX IF NOT EXISTS "subscription_payment_school_status_index"
  ON "subscriptionPayments" ("schoolId", "status");
CREATE INDEX IF NOT EXISTS "subscription_payment_user_created_index"
  ON "subscriptionPayments" ("userId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_payment_callback_checkout_unique"
  ON "subscriptionPaymentCallbacks" ("checkoutRequestId");
CREATE INDEX IF NOT EXISTS "subscription_payment_callback_pending_index"
  ON "subscriptionPaymentCallbacks" ("processedAt", "receivedAt");
