import { KeyRound, Loader2, LockKeyhole, School, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { startLogin } from "@/const";

export default function StudentLoginCard() {
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<"login" | "activate">("login");
  const [admissionNo, setAdmissionNo] = useState("");
  const [password, setPassword] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const login = trpc.auth.loginStudent.useMutation({
    onSuccess: async result => {
      toast.success(`Welcome, ${result.student.name}.`);
      await utils.auth.me.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const activate = trpc.auth.activateStudentPassword.useMutation({
    onSuccess: () => {
      toast.success("Password set. You can now sign in with your admission number.");
      setMode("login");
      setActivationCode("");
      setPassword("");
      setConfirmPassword("");
    },
    onError: error => toast.error(error.message),
  });
  const isPending = login.isPending || activate.isPending;

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mode === "login") {
      login.mutate({ admissionNo, password });
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    activate.mutate({ admissionNo, activationCode, password, confirmPassword });
  };

  return <main className="grid min-h-screen place-items-center bg-[#f5f7f5] p-4 text-slate-900 dark:bg-[#101b18] dark:text-slate-100 sm:p-6"><Card className="w-full max-w-md overflow-hidden rounded-[2rem] border-emerald-950/10 bg-white shadow-[0_24px_80px_-32px_rgba(11,61,46,0.32)] dark:border-white/10 dark:bg-[#172420]"><CardHeader className="p-6 pb-4 sm:p-8 sm:pb-5"><div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0d4437] text-white shadow-lg shadow-emerald-950/20"><School className="h-6 w-6" /></div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#ae7d2c]">Learner portal</p><CardTitle className="mt-3 text-3xl tracking-[-0.045em] text-[#103b31] dark:text-emerald-50">Access your results.</CardTitle><CardDescription className="mt-3 leading-6">Use the admission number issued by your school. Your password is private and only unlocks records linked to your learner profile.</CardDescription></CardHeader><CardContent className="p-6 pt-0 sm:p-8 sm:pt-0"><div className="mb-5 grid grid-cols-2 rounded-xl bg-[#eef4f0] p-1 dark:bg-white/8" role="tablist" aria-label="Learner account actions"><button type="button" role="tab" aria-selected={mode === "login"} onClick={() => setMode("login")} className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${mode === "login" ? "bg-white text-[#0d4437] shadow-sm dark:bg-[#20342d] dark:text-emerald-200" : "text-slate-500 hover:text-[#0d4437] dark:text-slate-400"}`}>Sign in</button><button type="button" role="tab" aria-selected={mode === "activate"} onClick={() => setMode("activate")} className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${mode === "activate" ? "bg-white text-[#0d4437] shadow-sm dark:bg-[#20342d] dark:text-emerald-200" : "text-slate-500 hover:text-[#0d4437] dark:text-slate-400"}`}>Set password</button></div><form className="space-y-4" onSubmit={submit}><div><Label htmlFor="student-admission">Admission number</Label><Input id="student-admission" value={admissionNo} onChange={event => setAdmissionNo(event.target.value.toUpperCase())} autoComplete="username" placeholder="e.g. ADM-0001" className="mt-2 rounded-xl" required /></div>{mode === "activate" ? <div><Label htmlFor="student-activation">Activation code</Label><Input id="student-activation" value={activationCode} onChange={event => setActivationCode(event.target.value.toUpperCase())} autoComplete="one-time-code" placeholder="Code from the school office" className="mt-2 rounded-xl font-mono tracking-[0.14em]" required /><p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">Ask the school office for a private activation code. It expires after 24 hours.</p></div> : null}<div><Label htmlFor="student-password">{mode === "activate" ? "New password" : "Password"}</Label><Input id="student-password" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete={mode === "activate" ? "new-password" : "current-password"} placeholder={mode === "activate" ? "At least 8 characters" : "Your password"} className="mt-2 rounded-xl" minLength={8} required /></div>{mode === "activate" ? <div><Label htmlFor="student-confirm-password">Confirm password</Label><Input id="student-confirm-password" type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} autoComplete="new-password" placeholder="Repeat your password" className="mt-2 rounded-xl" minLength={8} required /></div> : null}<Button type="submit" size="lg" disabled={isPending} className="mt-2 w-full rounded-xl bg-[#0d4437] text-white hover:bg-[#092f26]">{isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : mode === "activate" ? <KeyRound className="mr-2 h-4 w-4" /> : <LockKeyhole className="mr-2 h-4 w-4" />}{mode === "activate" ? "Set password" : "Sign in to results"}</Button></form><div className="mt-5 rounded-2xl border border-emerald-950/8 bg-[#f4f7f5] p-3.5 dark:border-white/8 dark:bg-white/5"><p className="flex items-start gap-2 text-xs leading-5 text-slate-600 dark:text-slate-300"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#a8792c]" />Your results, attendance, timetable, and fee status are scoped to your own learner account.</p></div><div className="mt-6 border-t border-emerald-950/8 pt-5 text-center dark:border-white/8"><p className="text-xs text-slate-500 dark:text-slate-400">School staff and parents</p><Button type="button" variant="outline" onClick={() => startLogin()} className="mt-2 rounded-xl bg-white dark:bg-transparent">Use secure school sign-in</Button></div></CardContent></Card></main>;
}
