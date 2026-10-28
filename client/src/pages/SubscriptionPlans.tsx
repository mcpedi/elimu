import { useEffect, useState } from "react";
import { BadgeCheck, Check, CreditCard, Smartphone, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { formatKsh, SUBSCRIPTION_PRICES, type PaidBillingPeriod, type PaidSubscriptionPlan } from "@shared/subscription-pricing";

type BillingPeriod = PaidBillingPeriod;
type SelectedPlan = { name: PaidSubscriptionPlan; billingPeriod: BillingPeriod };

const plans = [
  {
    name: "Free",
    summary: "A simple start for small school communities.",
    monthly: 0,
    annual: 0,
    features: ["Core school workspace", "Student and staff records", "Basic attendance and academics", "Community support"],
  },
  {
    name: "Pro",
    summary: "More tools for growing schools and busy teams.",
    monthly: SUBSCRIPTION_PRICES.Pro.monthly,
    annual: SUBSCRIPTION_PRICES.Pro.annual,
    features: ["Everything in Free", "Finance and fee workflows", "Reports and data exports", "Priority support"],
    featured: true,
  },
  {
    name: "Enterprise",
    summary: "Flexible support for larger or multi-campus schools.",
    monthly: SUBSCRIPTION_PRICES.Enterprise.monthly,
    annual: SUBSCRIPTION_PRICES.Enterprise.annual,
    features: ["Everything in Pro", "Advanced administration tools", "Multi-campus-ready workflows", "Dedicated onboarding and support"],
  },
] as const;

function paymentMessage(status: string) {
  if (status === "succeeded") return "Payment confirmed. Your plan is active.";
  if (status === "failed") return "The payment was not completed. You can try again.";
  if (status === "review_required") return "This payment needs administrator review. Please do not send another payment prompt.";
  if (status === "initiating") return "Contacting Safaricom to request the M-Pesa prompt…";
  return "M-Pesa prompt sent. Complete the payment on your phone; your plan changes only after Safaricom confirms it.";
}

export default function SubscriptionPlans({ allowCheckout = false }: { allowCheckout?: boolean }) {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");
  const [selectedPlan, setSelectedPlan] = useState<SelectedPlan | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [confirmedPrompt, setConfirmedPrompt] = useState(false);
  const [activePaymentId, setActivePaymentId] = useState<number | null>(null);
  const configuration = trpc.school.subscriptionBilling.configuration.useQuery(undefined, { enabled: allowCheckout, retry: false });
  const currentPayment = trpc.school.subscriptionBilling.paymentStatus.useQuery(
    { paymentId: activePaymentId ?? 0 },
    {
      enabled: allowCheckout && activePaymentId !== null,
      refetchInterval: query => {
        const status = query.state.data?.status;
        return status === "pending" || status === "initiating" ? 4_000 : false;
      },
    },
  );
  const startCheckout = trpc.school.subscriptionBilling.startCheckout.useMutation({
    onSuccess: result => {
      setActivePaymentId(result.paymentId);
      setSelectedPlan(null);
      setConfirmedPrompt(false);
      toast.info("M-Pesa prompt requested. Complete it on your phone; the subscription will update only after payment confirmation.");
    },
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    if (configuration.data?.schoolPhone && !phoneNumber) setPhoneNumber(configuration.data.schoolPhone);
  }, [configuration.data?.schoolPhone, phoneNumber]);

  useEffect(() => {
    if (currentPayment.data?.status === "succeeded") void configuration.refetch();
  }, [currentPayment.data?.status]);

  const currentSubscription = configuration.data?.subscription;
  const currentPeriodEnd = currentSubscription?.currentPeriodEndsAt ? new Date(currentSubscription.currentPeriodEndsAt) : null;
  const paidPeriodActive = Boolean(currentSubscription && currentSubscription.plan !== "Free" && (!currentPeriodEnd || currentPeriodEnd > new Date()));
  const pendingPayment = currentPayment.data?.status === "pending" || currentPayment.data?.status === "initiating";
  const paymentAmount = selectedPlan ? SUBSCRIPTION_PRICES[selectedPlan.name][selectedPlan.billingPeriod] : 0;

  const openCheckout = (plan: PaidSubscriptionPlan) => {
    setSelectedPlan({ name: plan, billingPeriod });
    setConfirmedPrompt(false);
    setPhoneNumber(configuration.data?.schoolPhone ?? "");
  };

  const sendPrompt = () => {
    if (!selectedPlan) return;
    startCheckout.mutate({
      plan: selectedPlan.name,
      billingPeriod: selectedPlan.billingPeriod,
      phoneNumber,
      idempotencyKey: crypto.randomUUID(),
    });
  };

  return (
    <div className="mx-auto max-w-7xl pb-8">
      <div className="relative mb-8 overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#0a382e] via-[#0d4437] to-[#1a6651] px-6 py-8 text-white shadow-[0_24px_65px_-35px_rgba(10,65,48,0.55)] sm:px-9 sm:py-10">
        <div className="absolute -right-10 -top-20 h-64 w-64 rounded-full border-[28px] border-white/5" />
        <div className="relative max-w-2xl">
          <Badge className="border border-white/15 bg-white/10 text-emerald-50 hover:bg-white/10"><Sparkles className="mr-1.5 h-3 w-3" />Plans for every school</Badge>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Choose the right plan for your school</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50/75">Compare the plans and choose monthly or annual pricing. M-Pesa checkout sends a payment prompt to your phone; subscriptions update only after confirmed payment.</p>
        </div>
      </div>

      {allowCheckout && currentSubscription ? (
        <div className="mb-6 rounded-2xl border border-emerald-950/10 bg-white/80 p-4 text-sm dark:border-white/10 dark:bg-[#172420]">
          <span className="font-semibold text-[#143b31] dark:text-emerald-50">Current plan: {currentSubscription.plan}</span>
          {currentSubscription.billingPeriod !== "none" ? <span className="ml-2 text-slate-500 dark:text-slate-400">({currentSubscription.billingPeriod})</span> : null}
          {currentPeriodEnd ? <span className="ml-2 text-slate-500 dark:text-slate-400">· paid through {currentPeriodEnd.toLocaleDateString("en-KE")}</span> : currentSubscription.plan !== "Free" ? <span className="ml-2 text-slate-500 dark:text-slate-400">· set manually by an administrator</span> : null}
        </div>
      ) : null}

      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold text-[#143b31] dark:text-emerald-50">Pick your billing period</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Annual prices are billed once per year. No automatic renewal.</p>
        </div>
        <div className="inline-flex rounded-xl border border-emerald-950/10 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-[#172420]" role="group" aria-label="Billing period">
          {(["monthly", "annual"] as const).map(period => (
            <button key={period} type="button" aria-pressed={billingPeriod === period} onClick={() => setBillingPeriod(period)} className={cn("rounded-lg px-4 py-2 text-sm font-semibold capitalize transition-colors", billingPeriod === period ? "bg-[#0d4437] text-white shadow-sm" : "text-slate-500 hover:text-[#0d4437] dark:text-slate-300 dark:hover:text-white")}>
              {period === "annual" ? "Annual" : "Monthly"}
            </button>
          ))}
        </div>
      </div>

      {allowCheckout && configuration.isError ? <p role="alert" className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">Subscription checkout is temporarily unavailable. Please try again later.</p> : null}
      {allowCheckout && configuration.data && !configuration.data.checkoutEnabled ? <p className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">M-Pesa checkout is not active yet. The payment gateway must be configured and enabled by the platform administrator.</p> : null}

      <div className="grid items-stretch gap-5 lg:grid-cols-3">
        {plans.map(plan => {
          const price = billingPeriod === "monthly" ? plan.monthly : plan.annual;
          const cadence = plan.name === "Free" ? "forever" : billingPeriod === "monthly" ? "per month" : "per year";
          const featured = plan.name === "Pro";
          const isPaid = plan.name !== "Free";
          const sameAsCurrent = currentSubscription?.plan === plan.name && currentSubscription?.billingPeriod === billingPeriod;
          const manuallySetPlan = paidPeriodActive && !currentPeriodEnd;
          const differentActivePlan = paidPeriodActive && currentPeriodEnd && currentSubscription?.plan !== plan.name;
          const checkoutDisabled = !isPaid || !allowCheckout || configuration.isLoading || !configuration.data?.checkoutEnabled || pendingPayment || Boolean(manuallySetPlan) || Boolean(differentActivePlan);
          let action = "Current starter plan";
          if (isPaid) {
            if (!allowCheckout) action = "Sign in to pay with M-Pesa";
            else if (configuration.isLoading) action = "Checking checkout…";
            else if (!configuration.data?.checkoutEnabled) action = "M-Pesa setup pending";
            else if (pendingPayment) action = "Payment in progress";
            else if (manuallySetPlan) action = "Contact platform administrator";
            else if (differentActivePlan) action = "Available after current period";
            else action = sameAsCurrent ? `Renew ${plan.name} with M-Pesa` : `Pay with M-Pesa`;
          }
          return (
            <Card key={plan.name} className={cn("relative flex h-full flex-col rounded-2xl border-emerald-950/10 bg-white/90 shadow-[0_14px_36px_-26px_rgba(10,65,48,0.35)] dark:border-white/10 dark:bg-[#172420]", featured && "border-[#0d4437] ring-1 ring-[#0d4437] dark:border-emerald-400 dark:ring-emerald-400")}>
              {featured ? <Badge className="absolute -top-3 left-5 border-0 bg-[#e4bd69] px-3 py-1 text-[#16382f] hover:bg-[#e4bd69]">Most popular</Badge> : null}
              <CardHeader className="pb-4 pt-7">
                <div className="flex items-center justify-between gap-2"><CardTitle className="text-xl text-[#143b31] dark:text-emerald-50">{plan.name}</CardTitle>{featured ? <BadgeCheck className="h-5 w-5 text-[#a8792c]" /> : null}</div>
                <CardDescription className="min-h-10 leading-5">{plan.summary}</CardDescription>
                <div className="pt-2"><span className="text-3xl font-semibold tracking-[-0.045em] text-[#0d4437] dark:text-emerald-200">{formatKsh(price)}</span><span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{cadence}</span></div>
                {isPaid ? <p className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">Official offer · {allowCheckout && configuration.data?.checkoutEnabled ? "pay securely with M-Pesa" : "checkout requires merchant setup"}</p> : null}
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <div className="mb-5 h-px bg-emerald-950/8 dark:bg-white/10" />
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Included</p>
                <ul className="mb-6 space-y-3">
                  {plan.features.map(feature => <li key={feature} className="flex items-start gap-2.5 text-sm leading-5 text-slate-600 dark:text-slate-300"><span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-emerald-100 text-[#0d4437] dark:bg-emerald-950/70 dark:text-emerald-300"><Check className="h-3 w-3" /></span>{feature}</li>)}
                </ul>
                <Button type="button" variant={featured ? "default" : "outline"} disabled={checkoutDisabled} className={cn("mt-auto w-full rounded-xl", featured ? "bg-[#0d4437] text-white hover:bg-[#092f26]" : "border-emerald-950/15 hover:bg-emerald-50 dark:border-white/15 dark:hover:bg-white/5")} onClick={() => isPaid && openCheckout(plan.name)}>
                  {plan.name === "Free" ? <CreditCard className="mr-2 h-4 w-4" /> : <Smartphone className="mr-2 h-4 w-4" />}{action}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {currentPayment.data ? <div className={cn("mt-6 rounded-xl border p-4 text-sm", currentPayment.data.status === "succeeded" ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200" : currentPayment.data.status === "review_required" ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200" : "border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-[#172420] dark:text-slate-200")} role="status">
        <p className="font-semibold">{paymentMessage(currentPayment.data.status)}</p>
        <p className="mt-1">{currentPayment.data.plan} · {currentPayment.data.billingPeriod} · {formatKsh(currentPayment.data.amount)}</p>
        {currentPayment.data.receiptNumber ? <p className="mt-1">M-Pesa receipt: {currentPayment.data.receiptNumber}</p> : null}
      </div> : null}

      <p className="mt-5 text-center text-xs leading-5 text-slate-500 dark:text-slate-400">Prices are shown in Kenyan shillings (KSh). Payment is a one-time M-Pesa prompt for the selected period and does not renew automatically. A successful verified payment activates the selected plan; no subscription or payment is started from the public preview.</p>

      <Dialog open={Boolean(selectedPlan)} onOpenChange={open => { if (!open && !startCheckout.isPending) setSelectedPlan(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pay for {selectedPlan?.name} with M-Pesa</DialogTitle>
            <DialogDescription>Review the amount, enter the M-Pesa number, then choose whether to send a payment prompt to that phone.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/30">
              <p className="font-semibold text-[#143b31] dark:text-emerald-100">{selectedPlan?.name} · {selectedPlan?.billingPeriod}</p>
              <p className="mt-1 text-2xl font-semibold text-[#0d4437] dark:text-emerald-200">{formatKsh(paymentAmount)}</p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">One-time payment for this period. No automatic renewal.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mpesa-phone">M-Pesa phone number</Label>
              <Input id="mpesa-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0712 345 678" value={phoneNumber} onChange={event => setPhoneNumber(event.target.value)} maxLength={24} />
              <p className="text-xs text-slate-500 dark:text-slate-400">Enter a Kenyan mobile number registered with M-Pesa. Safaricom will send a PIN prompt; the app never asks for your M-Pesa PIN.</p>
            </div>
            <label className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input className="mt-1" type="checkbox" checked={confirmedPrompt} onChange={event => setConfirmedPrompt(event.target.checked)} />
              <span>I confirm that I want Safaricom to send an M-Pesa payment prompt for {formatKsh(paymentAmount)}. My subscription changes only after payment is confirmed.</span>
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSelectedPlan(null)} disabled={startCheckout.isPending}>Cancel</Button>
            <Button type="button" onClick={sendPrompt} disabled={!confirmedPrompt || !phoneNumber.trim() || startCheckout.isPending} className="bg-[#0d4437] text-white hover:bg-[#092f26]">
              {startCheckout.isPending ? "Requesting prompt…" : "Send M-Pesa prompt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
