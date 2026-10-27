import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";

type Plan = "Free" | "Pro" | "Enterprise";
type BillingPeriod = "none" | "monthly" | "annual";
type Draft = { plan: Plan; billingPeriod: BillingPeriod; changeNote: string };

function displayDate(value: Date | string | null) {
  if (!value) return "Not changed yet";
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function SubscriptionManagement() {
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const subscriptions = trpc.school.platform.subscriptions.useQuery();
  const utils = trpc.useUtils();
  const changePlan = trpc.school.platform.setSubscriptionPlan.useMutation({
    onSuccess: async result => {
      toast.success(`Saved ${result.plan} for the school account. No payment was collected.`);
      setDrafts(current => ({ ...current, [result.schoolId]: { plan: result.plan, billingPeriod: result.billingPeriod, changeNote: "" } }));
      await utils.school.platform.subscriptions.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (subscriptions.data ?? []).filter(row => !normalized || `${row.schoolName} ${row.schoolCode} ${row.schoolEmail ?? ""}`.toLowerCase().includes(normalized));
  }, [subscriptions.data, query]);
  const activeCount = subscriptions.data?.filter(row => row.status === "active").length ?? 0;
  const paidCount = subscriptions.data?.filter(row => row.status === "active" && row.plan !== "Free").length ?? 0;
  const manuallyManagedCount = subscriptions.data?.filter(row => !row.isDefaultPlan).length ?? 0;

  const updateDraft = (schoolId: number, row: NonNullable<typeof subscriptions.data>[number], change: Partial<Draft>) => {
    setDrafts(current => ({
      ...current,
      [schoolId]: {
        plan: current[schoolId]?.plan ?? row.plan,
        billingPeriod: current[schoolId]?.billingPeriod ?? row.billingPeriod,
        changeNote: current[schoolId]?.changeNote ?? "",
        ...change,
      },
    }));
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-8">
      <div className="rounded-[1.5rem] bg-gradient-to-br from-[#0a382e] via-[#0d4437] to-[#1a6651] p-6 text-white shadow-[0_24px_65px_-35px_rgba(10,65,48,0.55)] sm:p-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#e4bd69]">Platform administration</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">Subscription management</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-50/75">View the plan on each school account and make an audited, manual tier change. These controls do not process payments, activate checkout, or verify that an invoice has been paid.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-emerald-950/8 bg-white/90 dark:border-white/10 dark:bg-[#172420]"><CardContent className="p-5"><p className="text-xs text-slate-500 dark:text-slate-400">School accounts</p><p className="mt-2 text-2xl font-semibold text-[#143b31] dark:text-emerald-50">{subscriptions.isLoading ? "—" : subscriptions.data?.length ?? 0}</p></CardContent></Card>
        <Card className="border-emerald-950/8 bg-white/90 dark:border-white/10 dark:bg-[#172420]"><CardContent className="p-5"><p className="text-xs text-slate-500 dark:text-slate-400">Active plan records</p><p className="mt-2 text-2xl font-semibold text-[#143b31] dark:text-emerald-50">{subscriptions.isLoading ? "—" : activeCount}</p></CardContent></Card>
        <Card className="border-emerald-950/8 bg-white/90 dark:border-white/10 dark:bg-[#172420]"><CardContent className="p-5"><p className="text-xs text-slate-500 dark:text-slate-400">Manually managed / paid tiers</p><p className="mt-2 text-2xl font-semibold text-[#143b31] dark:text-emerald-50">{subscriptions.isLoading ? "—" : `${manuallyManagedCount} / ${paidCount}`}</p></CardContent></Card>
      </div>

      <Card className="border-emerald-950/8 bg-white/90 dark:border-white/10 dark:bg-[#172420]">
        <CardHeader className="gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><CardTitle className="text-lg text-[#143b31] dark:text-emerald-50">School accounts and current plans</CardTitle><CardDescription className="mt-1">Unchanged accounts appear on the Free baseline until a platform admin records a plan change. Placeholder price labels are not used to bill.</CardDescription></div>
          <div className="flex gap-2"><Input aria-label="Search schools" placeholder="Search school, code, email" value={query} onChange={event => setQuery(event.target.value)} className="w-full rounded-xl sm:w-64" /><Button variant="outline" className="rounded-xl" onClick={() => void subscriptions.refetch()} disabled={subscriptions.isFetching}>{subscriptions.isFetching ? "Refreshing…" : "Refresh"}</Button></div>
        </CardHeader>
        <CardContent>
          {subscriptions.error ? <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{subscriptions.error.message}</p> : null}
          <div className="overflow-x-auto rounded-xl border border-emerald-950/8 dark:border-white/10">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="bg-[#f4f7f5] text-[10px] uppercase tracking-[0.12em] text-slate-500 dark:bg-white/5 dark:text-slate-400"><tr><th className="px-3 py-3">School account</th><th className="px-3 py-3">Current tier</th><th className="px-3 py-3">Status / billing</th><th className="px-3 py-3">Last admin change</th><th className="px-3 py-3">Manual plan change</th></tr></thead>
              <tbody>
                {subscriptions.isLoading ? <tr><td colSpan={5} className="p-8 text-center text-slate-500">Loading subscription records…</td></tr> : rows.length ? rows.map(row => {
                  const draft = drafts[row.schoolId] ?? { plan: row.plan, billingPeriod: row.billingPeriod, changeNote: "" };
                  return <tr key={row.schoolId} className="border-t border-emerald-950/7 align-top dark:border-white/8">
                    <td className="px-3 py-4"><p className="font-semibold text-slate-800 dark:text-slate-100">{row.schoolName}</p><p className="mt-1 text-xs text-slate-500">{row.schoolCode} · {row.schoolEmail || "No email on file"}</p><p className="mt-1 text-[11px] text-slate-400">School ID {row.schoolId}</p></td>
                    <td className="px-3 py-4"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-[#0d4437] dark:text-emerald-300">{row.plan}</span>{row.isDefaultPlan ? <Badge className="border-0 bg-slate-100 text-[10px] text-slate-600 dark:bg-white/10 dark:text-slate-300">Default baseline</Badge> : <Badge className="border-0 bg-emerald-100 text-[10px] text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">Stored</Badge>}</div>{row.changeNote ? <p className="mt-1 max-w-52 text-xs text-slate-500">{row.changeNote}</p> : null}</td>
                    <td className="px-3 py-4"><Badge className="border-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">Active</Badge><p className="mt-2 text-xs text-slate-500">{row.billingPeriod === "none" ? "No billing cadence" : `Billed ${row.billingPeriod}`}</p><p className="mt-1 text-[10px] text-amber-700 dark:text-amber-300">Manual record · unpaid</p></td>
                    <td className="px-3 py-4"><p className="text-xs text-slate-600 dark:text-slate-300">{displayDate(row.updatedAt)}</p><p className="mt-1 text-xs text-slate-500">{row.updatedByName ? `By ${row.updatedByName}` : "No admin change recorded"}</p></td>
                    <td className="px-3 py-4">
                      <form className="grid min-w-72 gap-2" onSubmit={event => { event.preventDefault(); changePlan.mutate({ schoolId: row.schoolId, plan: draft.plan, billingPeriod: draft.billingPeriod, changeNote: draft.changeNote.trim() }); }}>
                        <div className="grid grid-cols-2 gap-2"><Select value={draft.plan} onValueChange={value => updateDraft(row.schoolId, row, { plan: value as Plan, billingPeriod: value === "Free" ? "none" : draft.billingPeriod === "none" ? "monthly" : draft.billingPeriod })}><SelectTrigger aria-label={`Plan for ${row.schoolName}`} className="rounded-lg"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Free">Free</SelectItem><SelectItem value="Pro">Pro</SelectItem><SelectItem value="Enterprise">Enterprise</SelectItem></SelectContent></Select>
                          <Select value={draft.billingPeriod} onValueChange={value => updateDraft(row.schoolId, row, { billingPeriod: value as BillingPeriod })} disabled={draft.plan === "Free"}><SelectTrigger aria-label={`Billing period for ${row.schoolName}`} className="rounded-lg"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="annual">Annual</SelectItem></SelectContent></Select></div>
                        <Input aria-label={`Change note for ${row.schoolName}`} placeholder="Reason for manual change (required)" minLength={3} maxLength={280} required value={draft.changeNote} onChange={event => updateDraft(row.schoolId, row, { changeNote: event.target.value })} className="rounded-lg" />
                        <Button type="submit" size="sm" disabled={changePlan.isPending || (draft.plan === row.plan && draft.billingPeriod === row.billingPeriod && !row.isDefaultPlan)} className="rounded-lg bg-[#0d4437] text-white hover:bg-[#092f26]">{changePlan.isPending ? "Saving…" : "Save manual change"}</Button>
                      </form>
                    </td>
                  </tr>;
                }) : <tr><td colSpan={5} className="p-8 text-center text-slate-500">{subscriptions.data?.length ? "No school accounts match your search." : "No school accounts are available yet."}</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">A saved tier change is effective immediately as an administrative record only. It does not collect payment, create an invoice, or validate an external subscription.</p>
        </CardContent>
      </Card>
    </div>
  );
}
