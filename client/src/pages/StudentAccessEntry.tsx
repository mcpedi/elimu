import { format } from "date-fns";
import { CheckCircle2, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";

export function StudentAccessEntry() {
  const students = trpc.school.students.list.useQuery({ status: "active" });
  const [studentId, setStudentId] = useState("");
  const [activation, setActivation] = useState<{ code: string; expiresAt: Date } | null>(null);
  const issue = trpc.auth.issueStudentActivationCode.useMutation({
    onSuccess: result => {
      setActivation({ code: result.activationCode, expiresAt: new Date(result.expiresAt) });
      toast.success("Activation code issued. Share it privately with the learner.");
    },
    onError: error => toast.error(error.message),
  });
  const selected = (students.data ?? []).find(student => student.id === Number(studentId));

  return <Card className="mb-6 border-emerald-950/8 bg-white/85 shadow-[0_14px_36px_-26px_rgba(10,65,48,0.28)] dark:border-white/8 dark:bg-[#172420]"><CardHeader className="pb-3"><div className="flex items-start justify-between gap-4"><div><CardTitle className="flex items-center gap-2 text-base text-[#143b31] dark:text-emerald-50"><KeyRound className="h-4 w-4 text-[#a8792c]" />Student portal access</CardTitle><CardDescription className="mt-1 leading-5">Issue a private, one-time activation code. The learner uses it with their admission number to set a password, then signs in to view their own results.</CardDescription></div><Badge variant="secondary" className="shrink-0 rounded-full bg-[#fbf1d8] text-[#94651f]">Leadership only</Badge></div></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-[1fr_auto]"><Select value={studentId} onValueChange={value => { setStudentId(value); setActivation(null); }}><SelectTrigger className="rounded-xl"><SelectValue placeholder="Select an active learner" /></SelectTrigger><SelectContent>{(students.data ?? []).map(student => <SelectItem key={student.id} value={String(student.id)}>{student.firstName} {student.lastName} · {student.admissionNo}</SelectItem>)}</SelectContent></Select><Button className="rounded-xl bg-[#0d4437] text-white hover:bg-[#092f26]" disabled={!studentId || issue.isPending} onClick={() => issue.mutate({ studentId: Number(studentId) })}>{issue.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}Issue activation code</Button></div>{activation ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" /><div className="min-w-0"><p className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">Activation code for {selected?.firstName} {selected?.lastName}</p><p className="mt-2 break-all font-mono text-xl font-bold tracking-[0.18em] text-[#0d4437] dark:text-emerald-200">{activation.code}</p><p className="mt-2 text-xs leading-5 text-emerald-900/70 dark:text-emerald-100/70">Share this code privately. It expires {format(activation.expiresAt, "d MMM yyyy, HH:mm")} and issuing another code resets the previous password.</p></div></div></div> : <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">Codes expire after 24 hours and are shown only after issuance. Never include an activation code in a public notice.</p>}</CardContent></Card>;
}
