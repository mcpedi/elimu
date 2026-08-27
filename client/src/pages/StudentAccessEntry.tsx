import { CheckCircle2, Copy, Info, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";

export function StudentAccessEntry() {
  const students = trpc.school.students.list.useQuery({ status: "active" });
  const [studentId, setStudentId] = useState("");
  const [sendNotice, setSendNotice] = useState(false);
  const [issued, setIssued] = useState<{ code: string; expiresAt: Date; name: string; admissionNo: string; notice?: { requested: boolean; sent: boolean; email: string | null } } | null>(null);
  const issue = trpc.auth.issueStudentPasswordResetCode.useMutation({
    onSuccess: result => {
      setIssued({ code: result.resetCode, expiresAt: result.expiresAt, name: result.student.name, admissionNo: result.student.admissionNo, notice: result.notice });
      toast.success(result.notice?.sent ? "Reset code issued and recovery notice sent to the linked learner account." : "One-time reset code issued. Share it directly with the learner.");
    },
    onError: error => toast.error(error.message),
  });

  const copyCode = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.code);
      toast.success("Reset code copied.");
    } catch {
      toast.error("Copy was blocked. Select the code and copy it manually.");
    }
  };

  return <Card className="mb-6 border-emerald-950/8 bg-white/85 shadow-[0_14px_36px_-26px_rgba(10,65,48,0.28)] dark:border-white/8 dark:bg-[#172420]"><CardHeader className="pb-3"><div className="flex items-start justify-between gap-4"><div><CardTitle className="flex items-center gap-2 text-base text-[#143b31] dark:text-emerald-50"><KeyRound className="h-4 w-4 text-[#a8792c]" />Learner password recovery</CardTitle><CardDescription className="mt-1 leading-5">Issue a one-time code when a learner forgets a custom password. The code is stored only as a hash.</CardDescription></div><Badge variant="secondary" className="shrink-0 rounded-full bg-[#fbf1d8] text-[#94651f]">Leadership view</Badge></div></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"><div><Label htmlFor="reset-learner">Active learner</Label><Select value={studentId} onValueChange={value => { setStudentId(value); setIssued(null); }}><SelectTrigger id="reset-learner" className="mt-2 rounded-xl"><SelectValue placeholder="Select a learner" /></SelectTrigger><SelectContent>{students.data?.map(student => <SelectItem key={student.id} value={String(student.id)}>{student.firstName} {student.middleName ? `${student.middleName} ` : ""}{student.lastName} · {student.admissionNo}</SelectItem>)}</SelectContent></Select></div><Button type="button" disabled={!studentId || issue.isPending} onClick={() => issue.mutate({ studentId: Number(studentId), sendNotice })} className="rounded-xl bg-[#0d4437] text-white hover:bg-[#092f26]">{issue.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}Issue reset code</Button></div><label className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-600 dark:text-slate-300"><Checkbox checked={sendNotice} onCheckedChange={checked => setSendNotice(checked === true)} /><span>Also send a safe recovery notice to the learner’s linked account{students.data?.find(student => String(student.id) === studentId)?.email ? ` (${students.data.find(student => String(student.id) === studentId)?.email})` : ""}. The one-time code is never sent in the notice.</span></label>{students.isLoading ? <p className="mt-3 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading active learners…</p> : !students.data?.length ? <p className="mt-3 text-sm text-slate-500">Add an active learner record before issuing a reset code.</p> : null}{issued ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/25"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="flex items-center gap-2 text-sm font-semibold text-emerald-950 dark:text-emerald-100"><CheckCircle2 className="h-4 w-4" />Code ready for {issued.name}</p><p className="mt-1 text-xs text-emerald-900/70 dark:text-emerald-100/70">Admission number: {issued.admissionNo} · Expires {issued.expiresAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p></div><Button type="button" variant="outline" onClick={copyCode} className="rounded-xl bg-white dark:bg-transparent"><Copy className="mr-2 h-4 w-4" />Copy code</Button></div><p className="mt-3 select-all rounded-xl border border-emerald-300/70 bg-white px-4 py-3 text-center font-mono text-xl font-bold tracking-[0.2em] text-[#0d4437] dark:border-emerald-800 dark:bg-[#10251f] dark:text-emerald-200">{issued.code}</p><p className="mt-3 text-xs leading-5 text-emerald-950/75 dark:text-emerald-100/75">Give this code directly to the learner. It can be used once and is not recoverable from the system after the learner completes the reset.</p>{issued.notice?.requested ? <p className="mt-2 text-xs font-medium text-emerald-900 dark:text-emerald-200">{issued.notice.sent ? `Recovery notice sent to the linked learner account (${issued.notice.email}).` : issued.notice.email ? `The learner has a linked email (${issued.notice.email}), but no student account is available for an in-app notice yet.` : "No linked learner email is available for the recovery notice."}</p> : null}</div> : null}<div className="mt-4 rounded-2xl border border-amber-200/70 bg-amber-50/70 p-3.5 dark:border-amber-900/50 dark:bg-amber-950/20"><p className="flex items-start gap-2 text-xs leading-5 text-amber-950/80 dark:text-amber-100/80"><Info className="mt-0.5 h-4 w-4 shrink-0" />Never post reset codes in class groups, notices, or shared documents. If the wrong learner is selected, issue a new code to invalidate the previous one.</p></div><p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500 dark:text-slate-400"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />Password reset changes are restricted to leadership roles and recorded in the school audit log.</p></CardContent></Card>;
}
