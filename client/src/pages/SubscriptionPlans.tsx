import { useState } from "react";
import { BadgeCheck, Check, CreditCard, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type BillingPeriod = "monthly" | "annual";

const plans = [
  {
    name: "Free",
    summary: "A simple start for small school communities.",
    monthly: "KES 0",
    annual: "KES 0",
    cadence: "forever",
    features: ["Core school workspace", "Student and staff records", "Basic attendance and academics", "Community support"],
    action: "Current starter plan",
  },
  {
    name: "Pro",
    summary: "More tools for growing schools and busy teams.",
    monthly: "KES 4,999",
    annual: "KES 49,990",
    cadence: "per month",
    features: ["Everything in Free", "Finance and fee workflows", "Reports and data exports", "Priority support"],
    action: "Choose Pro",
    featured: true,
  },
  {
    name: "Enterprise",
    summary: "Flexible support for larger or multi-campus schools.",
    monthly: "KES 12,999",
    annual: "KES 129,990",
    cadence: "per month",
    features: ["Everything in Pro", "Advanced administration tools", "Multi-campus-ready workflows", "Dedicated onboarding and support"],
    action: "Choose Enterprise",
  },
] as const;

export default function SubscriptionPlans() {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");

  return (
    <div className="mx-auto max-w-7xl pb-8">
      <div className="relative mb-8 overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#0a382e] via-[#0d4437] to-[#1a6651] px-6 py-8 text-white shadow-[0_24px_65px_-35px_rgba(10,65,48,0.55)] sm:px-9 sm:py-10">
        <div className="absolute -right-10 -top-20 h-64 w-64 rounded-full border-[28px] border-white/5" />
        <div className="relative max-w-2xl">
          <Badge className="border border-white/15 bg-white/10 text-emerald-50 hover:bg-white/10"><Sparkles className="mr-1.5 h-3 w-3" />Plans for every school</Badge>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Choose the right plan for your school</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50/75">Compare the options and select a billing period. Prices and plan details shown here are placeholders while subscription billing is being prepared.</p>
        </div>
      </div>

      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold text-[#143b31] dark:text-emerald-50">Pick your billing period</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Annual amounts are illustrative placeholders, billed yearly.</p>
        </div>
        <div className="inline-flex rounded-xl border border-emerald-950/10 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-[#172420]" role="group" aria-label="Billing period">
          {(["monthly", "annual"] as const).map(period => (
            <button key={period} type="button" aria-pressed={billingPeriod === period} onClick={() => setBillingPeriod(period)} className={cn("rounded-lg px-4 py-2 text-sm font-semibold capitalize transition-colors", billingPeriod === period ? "bg-[#0d4437] text-white shadow-sm" : "text-slate-500 hover:text-[#0d4437] dark:text-slate-300 dark:hover:text-white")}>
              {period === "annual" ? "Annual" : "Monthly"}
              {period === "annual" ? <span className="ml-1.5 text-[10px] font-medium text-[#e4bd69]">Save*</span> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="grid items-stretch gap-5 lg:grid-cols-3">
        {plans.map(plan => {
          const price = billingPeriod === "monthly" ? plan.monthly : plan.annual;
          const cadence = plan.name === "Free" ? "forever" : billingPeriod === "monthly" ? "per month" : "per year";
          const featured = plan.name === "Pro";
          return (
            <Card key={plan.name} className={cn("relative flex h-full flex-col rounded-2xl border-emerald-950/10 bg-white/90 shadow-[0_14px_36px_-26px_rgba(10,65,48,0.35)] dark:border-white/10 dark:bg-[#172420]", featured && "border-[#0d4437] ring-1 ring-[#0d4437] dark:border-emerald-400 dark:ring-emerald-400")}>
              {featured ? <Badge className="absolute -top-3 left-5 border-0 bg-[#e4bd69] px-3 py-1 text-[#16382f] hover:bg-[#e4bd69]">Most popular</Badge> : null}
              <CardHeader className="pb-4 pt-7">
                <div className="flex items-center justify-between gap-2"><CardTitle className="text-xl text-[#143b31] dark:text-emerald-50">{plan.name}</CardTitle>{featured ? <BadgeCheck className="h-5 w-5 text-[#a8792c]" /> : null}</div>
                <CardDescription className="min-h-10 leading-5">{plan.summary}</CardDescription>
                <div className="pt-2"><span className="text-3xl font-semibold tracking-[-0.045em] text-[#0d4437] dark:text-emerald-200">{price}</span><span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{cadence}</span></div>
                <p className="text-[11px] font-medium text-amber-700 dark:text-amber-300">Placeholder price — not a live offer</p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <div className="mb-5 h-px bg-emerald-950/8 dark:bg-white/10" />
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Included</p>
                <ul className="mb-6 space-y-3">
                  {plan.features.map(feature => <li key={feature} className="flex items-start gap-2.5 text-sm leading-5 text-slate-600 dark:text-slate-300"><span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-emerald-100 text-[#0d4437] dark:bg-emerald-950/70 dark:text-emerald-300"><Check className="h-3 w-3" /></span>{feature}</li>)}
                </ul>
                <Button type="button" variant={featured ? "default" : "outline"} className={cn("mt-auto w-full rounded-xl", featured ? "bg-[#0d4437] text-white hover:bg-[#092f26]" : "border-emerald-950/15 hover:bg-emerald-50 dark:border-white/15 dark:hover:bg-white/5")} onClick={() => toast.info("Plan selection is a preview only. No subscription or payment has been started.")}>
                  {plan.name === "Free" ? <CreditCard className="mr-2 h-4 w-4" /> : null}{plan.action}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <p className="mt-5 text-center text-xs leading-5 text-slate-500 dark:text-slate-400">*Any displayed savings are illustrative only. Plan selection does not create a subscription or charge a payment method.</p>
    </div>
  );
}
