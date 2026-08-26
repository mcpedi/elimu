import { ArrowLeft, KeyRound, LockKeyhole, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { BRAND_LOGO_URL, BRAND_NAME, BRAND_TAGLINE, startLogin } from "@/const";

type AccessMode = "login" | "reset";

export default function StudentLoginCard() {
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<AccessMode>("login");
  const [schoolCode, setSchoolCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const login = trpc.auth.loginStudent.useMutation({
    onSuccess: async result => {
      toast.success(`Welcome, ${result.student.name}.`);
      await utils.auth.me.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const reset = trpc.auth.resetStudentPassword.useMutation({
    onSuccess: () => {
      setMode("login");
      setPassword("");
      setResetCode("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password reset complete. Sign in with your new password.");
    },
    onError: error => toast.error(error.message),
  });

  const submitLogin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    login.mutate({ schoolCode, username, password });
  };

  const submitReset = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    reset.mutate({ schoolCode, username, resetCode, newPassword, confirmPassword });
  };

  const schoolCodeField = (id: string) => (
    <div>
      <Label htmlFor={id}>School code</Label>
      <Input id={id} value={schoolCode} onChange={event => setSchoolCode(event.target.value.toUpperCase())} autoComplete="organization" placeholder="e.g. ONY" className="mt-2 rounded-xl font-mono uppercase tracking-[0.1em]" required />
      <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">Ask your school office for the short code shown in its school profile.</p>
    </div>
  );

  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f7f5] p-4 text-slate-900 dark:bg-[#101b18] dark:text-slate-100 sm:p-6">
      <Card className="w-full max-w-md overflow-hidden rounded-[2rem] border-emerald-950/10 bg-white shadow-[0_24px_80px_-32px_rgba(11,61,46,0.32)] dark:border-white/10 dark:bg-[#172420]">
        <CardHeader className="p-6 pb-4 sm:p-8 sm:pb-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#0d4437] p-2 shadow-lg shadow-emerald-950/20"><img src={BRAND_LOGO_URL} alt={`${BRAND_NAME} logo`} className="h-full w-full object-contain" /></div>
            <div><p className="font-serif text-lg font-semibold tracking-[-0.03em] text-[#103b31] dark:text-emerald-50">{BRAND_NAME}</p><p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.11em] text-[#a8792c]">{BRAND_TAGLINE}</p></div>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#ae7d2c]">Learner portal</p>
          <CardTitle className="mt-3 text-3xl tracking-[-0.045em] text-[#103b31] dark:text-emerald-50">{mode === "login" ? "Access your results." : "Reset your password."}</CardTitle>
          <CardDescription className="mt-3 leading-6">{mode === "login" ? "Enter your school code, full name, and admission number or private password." : "Enter your school code and a one-time reset code issued by the school office."}</CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-0 sm:p-8 sm:pt-0">
          {mode === "login" ? (
            <form className="space-y-4" onSubmit={submitLogin}>
              {schoolCodeField("student-school-code")}
              <div><Label htmlFor="student-username">Learner name</Label><Input id="student-username" value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" placeholder="e.g. Amina Otieno" className="mt-2 rounded-xl" required /><p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">Use your first, middle, and last names as recorded in the school register.</p></div>
              <div><Label htmlFor="student-password">Admission number or current password</Label><Input id="student-password" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" placeholder="e.g. ADM-0001" className="mt-2 rounded-xl font-mono" required /><p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">Use your admission number until you set a custom password.</p></div>
              <Button type="submit" size="lg" disabled={login.isPending} className="mt-2 w-full rounded-xl bg-[#0d4437] text-white hover:bg-[#092f26]">{login.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LockKeyhole className="mr-2 h-4 w-4" />}Sign in to results</Button>
              <Button type="button" variant="ghost" onClick={() => setMode("reset")} className="w-full rounded-xl text-[#0d4437] hover:bg-emerald-50 hover:text-[#092f26] dark:text-emerald-300 dark:hover:bg-emerald-950/30">Forgot custom password?</Button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={submitReset}>
              {schoolCodeField("reset-student-school-code")}
              <div><Label htmlFor="reset-student-username">Learner name</Label><Input id="reset-student-username" value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" placeholder="e.g. Amina Otieno" className="mt-2 rounded-xl" required /></div>
              <div><Label htmlFor="student-reset-code">One-time reset code</Label><Input id="student-reset-code" value={resetCode} onChange={event => setResetCode(event.target.value.toUpperCase())} autoComplete="one-time-code" placeholder="Enter code from school office" className="mt-2 rounded-xl font-mono uppercase tracking-[0.12em]" required /><p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">Codes expire after 30 minutes and can be used once.</p></div>
              <div><Label htmlFor="student-reset-new-password">New password</Label><Input id="student-reset-new-password" type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} autoComplete="new-password" className="mt-2 rounded-xl" minLength={8} required /><p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">Use at least 8 characters.</p></div>
              <div><Label htmlFor="student-reset-confirm-password">Confirm new password</Label><Input id="student-reset-confirm-password" type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} autoComplete="new-password" className="mt-2 rounded-xl" minLength={8} required /></div>
              <Button type="submit" size="lg" disabled={reset.isPending} className="w-full rounded-xl bg-[#0d4437] text-white hover:bg-[#092f26]">{reset.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}Reset password</Button>
              <Button type="button" variant="ghost" onClick={() => setMode("login")} className="w-full rounded-xl text-[#0d4437] hover:bg-emerald-50 hover:text-[#092f26] dark:text-emerald-300 dark:hover:bg-emerald-950/30"><ArrowLeft className="mr-2 h-4 w-4" />Back to learner sign-in</Button>
            </form>
          )}
          <div className="mt-5 rounded-2xl border border-emerald-950/8 bg-[#f4f7f5] p-3.5 dark:border-white/8 dark:bg-white/5"><p className="flex items-start gap-2 text-xs leading-5 text-slate-600 dark:text-slate-300"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#a8792c]" />Your results, attendance, timetable, and fee status are scoped to your own learner account. Never share a reset code publicly.</p></div>
          <div className="mt-6 border-t border-emerald-950/8 pt-5 text-center dark:border-white/8"><p className="text-xs text-slate-500 dark:text-slate-400">School staff and parents</p><Button type="button" variant="outline" onClick={() => startLogin()} className="mt-2 rounded-xl bg-white dark:bg-transparent">Use secure school sign-in</Button></div>
        </CardContent>
      </Card>
    </main>
  );
}
