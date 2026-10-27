-- Subscription records are managed manually by designated platform administrators.
-- This migration is intentionally not applied by the feature implementation.
CREATE TABLE IF NOT EXISTS "schoolSubscriptions" (
  "id" serial PRIMARY KEY,
  "schoolId" integer NOT NULL REFERENCES "schools" ("id"),
  "plan" text NOT NULL DEFAULT 'Free' CHECK ("plan" IN ('Free', 'Pro', 'Enterprise')),
  "status" text NOT NULL DEFAULT 'active' CHECK ("status" IN ('active')),
  "billingPeriod" text NOT NULL DEFAULT 'none' CHECK ("billingPeriod" IN ('none', 'monthly', 'annual')),
  "updatedByUserId" integer REFERENCES "users" ("id"),
  "changeNote" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "school_subscription_paid_cadence_check" CHECK (("plan" = 'Free' AND "billingPeriod" = 'none') OR ("plan" <> 'Free' AND "billingPeriod" IN ('monthly', 'annual')))
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_subscription_school_unique" ON "schoolSubscriptions" ("schoolId");
CREATE INDEX IF NOT EXISTS "school_subscription_plan_status_index" ON "schoolSubscriptions" ("plan", "status");
