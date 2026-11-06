import { KeyRound, LockKeyhole, Loader2, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { BRAND_LOGO_URL, BRAND_NAME, BRAND_TAGLINE } from "@/const";

type AccessMode = "learner" | "staff" | "reset" | "staff-reset" | "setup";

type AccessModeConfig = { portal: "Learner portal" | "School access" | "Account setup"; title: string; description: string };

export const ACCESS_MODE_COPY: Record<AccessMode, AccessModeConfig> = {
  learner: { portal: "Learner portal", title: "Access your results.", description: "Enter your school code, full name, and admission number or private password." },
  reset: { portal: "Learner portal", title: "Reset your password.", description: "Enter your school code and a one-time reset code issued by the school office." },
  staff: { portal: "School access", title: "Welcome back.", description: "Sign in with the username and password issued by your school administrator." },
  "staff-reset": { portal: "School access", title: "Reset your password.", description: "Use a one-time recovery code issued by your school administrator to reset your school account password." },
  setup: { portal: "Account setup", title: "Set up your account.", description: "Use the one-time setup code from your school administrator to create your private sign-in." },
};

export function accessFlow(mode: AccessMode): "learner" | "staff" {
  return mode === "learner" || mode === "reset" ? "learner" : "staff";
}

export default function StudentLoginCard() {
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<AccessMode>("learner");
  const [schoolCode, setSchoolCode] = useState("");
  const [username, setUsername] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [staffResetUserId, setStaffResetUserId] = useState("");
  const [staffResetCode, setStaffResetCode] = useState("");
  const [staffResetPassword, setStaffResetPassword] = useState("");
  const [staffResetConfirmPassword, setStaffResetConfirmPassword] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [setupUserId, setSetupUserId] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const login = trpc.auth.loginStudent.useMutation({ onSuccess: async result => { toast.success(`Welcome, ${result.student.name}.`); await utils.auth.me.invalidate(); }, onError: error => toast.error(error.message) });
  const staffLogin = trpc.auth.loginLocal.useMutation({ onSuccess: async result => { toast.success(`Welcome${result.user.name ? `, ${result.user.name}` : ""}.`); await utils.auth.me.invalidate(); }, onError: error => toast.error(error.message) });
  const reset = trpc.auth.resetStudentPassword.useMutation({ onSuccess: () => { setMode("learner"); setPassword(""); setResetCode(""); setNewPassword(""); setConfirmPassword(""); toast.success("Password reset complete. Sign in with your new password."); }, onError: error => toast.error(error.message) });
  const staffReset = trpc.auth.resetLocalPassword.useMutation({ onSuccess: () => { setMode("staff"); setStaffResetUserId(""); setStaffResetCode(""); setStaffResetPassword(""); setStaffResetConfirmPassword(""); setPassword(""); toast.success("Password reset complete. Sign in with your new password."); }, onError: error => toast.error(error.message) });
  const setup = trpc.auth.completeLocalSetup.useMutation({ onSuccess: result => { setMode("staff"); setIdentifier(result.username); setSetupCode(""); setSetupUserId(""); setNewUsername(""); setNewPassword(""); setConfirmPassword(""); toast.success("Account ready. Sign in with your new username and password."); }, onError: error => toast.error(error.message) });

  const submitLearner = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); login.mutate({ schoolCode, username, password, rememberMe }); };
  const submitStaff = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); staffLogin.mutate({ identifier, password, rememberMe }); };
  const submitReset = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); reset.mutate({ schoolCode, username, resetCode, newPassword, confirmPassword }); };
  const submitStaffReset = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); staffReset.mutate({ userId: Number(staffResetUserId), setupCode: staffResetCode, password: staffResetPassword, confirmPassword: staffResetConfirmPassword }); };
  const submitSetup = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); setup.mutate({ userId: Number(setupUserId), setupCode, username: newUsername, password: newPassword, confirmPassword }); };

  const schoolCodeField = (id: string) => (
    <div>
      <Label htmlFor={id}>School code</Label>
      <Input id={id} value={schoolCode} onChange={event => setSchoolCode(event.target.value.toUpperCase())} autoComplete="organization" placeholder="e.g. ONY" className="mt-2 rounded-xl font-mono uppercase tracking-[0.1em]" required />
      <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">Ask your school office for the short code shown in its school profile.</p>
    </div>
  );

  const rememberMeField = (id: string) => (
    <div className="flex items-start gap-2 rounded-xl py-1">
      <input id={id} type="checkbox" checked={rememberMe} onChange={event => setRememberMe(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[#0d4437]" />
      <label htmlFor={id} className="cursor-pointer">
        <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">Remember me</span>
        <span className="block text-xs leading-5 text-slate-500 dark:text-slate-400">Stay signed in on this device for up to 30 days.</span>
      </label>
    </div>
  );

  const copy = ACCESS_MODE_COPY[mode];
  const flow = accessFlow(mode);
  const busy = login.isPending || staffLogin.isPending || reset.isPending || staffReset.isPending || setup.isPending;
  const flowTab = (value: "learner" | "staff", label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={flow === value}
      onClick={() => { if (flow !== value) { setMode(value); setPassword(""); } }}
      className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${flow === value ? "bg-white text-[#0d4437] shadow-sm dark:bg-[#22352f] dark:text-emerald-50" : "text-slate-500 hover:text-[#0d4437] dark:text-slate-400 dark:hover:text-emerald-100"}`}
    >
      {label}
    </button>
  );

  return (
    <Card className="w-full overflow-hidden rounded-[2rem] border-emerald-950/10 bg-white/97 shadow-[0_24px_80px_-32px_rgba(11,61,46,0.48)] backdrop-blur-md dark:border-white/10 dark:bg-[#172420]/97">
      <CardHeader className="p-6 pb-4 sm:p-7 sm:pb-4">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#0d4437] p-2 shadow-lg shadow-emerald-950/20"><img src={BRAND_LOGO_URL} alt={`${BRAND_NAME} logo`} className="h-full w-full object-contain" /></div>
          <div className="min-w-0">
            <p className="truncate font-serif text-lg font-semibold tracking-[-0.03em] text-[#103b31] dark:text-emerald-50">{BRAND_NAME}</p>
            <p className="mt-0.5 truncate text-[9px] font-semibold uppercase tracking-[0.11em] text-[#a8792c]">{BRAND_TAGLINE}</p>
          </div>
        </div>
        <div role="tablist" aria-label="Choose how you sign in" className="grid grid-cols-2 gap-1 rounded-xl bg-[#edf4ef] p-1 dark:bg-white/8">
          {flowTab("learner", "Learner")}
          {flowTab("staff", "Staff & parents")}
        </div>
        <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#ae7d2c]">{copy.portal}</p>
        <CardTitle className="mt-2 text-2xl tracking-[-0.045em] text-[#103b31] dark:text-emerald-50 sm:text-3xl">{copy.title}</CardTitle>
        <CardDescription className="mt-2 leading-6">{copy.description}</CardDescription>
      </CardHeader>
      <CardContent className="p-6 pt-0 sm:p-7 sm:pt-0">
        {mode === "learner" ? (
          <form className="space-y-4" onSubmit={submitLearner}>
            {schoolCodeField("student-school-code")}
            <div>
              <Label htmlFor="student-username">Learner name</Label>
              <Input id="student-username" value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" placeholder="e.g. Amina Otieno" className="mt-2 rounded-xl" required />
              <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">Use your first, middle, and last names as recorded in the school register.</p>
            </div>
            <div>
              <Label htmlFor="student-password">Admission number or current password</Label>
              <Input id="student-password" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" placeholder="e.g. ADM-0001" className="mt-2 rounded-xl font-mono" required />
              <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">Use your admission number until you set a custom password.</p>
            </div>
            {rememberMeField("learner-remember-me")}
            <Button type="submit" size="lg" disabled={busy} className="mt-2 w-full rounded-xl bg-[#0d4437] text-white hover:bg-[#092f26]">{login.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LockKeyhole className="mr-2 h-4 w-4" />}Sign in to results</Button>
            <div className="flex flex-col gap-1">
              <Button type="button" variant="ghost" onClick={() => setMode("reset")} className="w-full rounded-xl text-[#0d4437] hover:bg-emerald-50 hover:text-[#092f26] dark:text-emerald-300 dark:hover:bg-emerald-950/30">Forgot password?</Button>
              <Button type="button" variant="ghost" onClick={() => setMode("setup")} className="w-full rounded-xl text-[#0d4437] hover:bg-emerald-50 dark:text-emerald-300">Have an admin setup code? Set up your account</Button>
            </div>
          </form>
        ) : null}

        {mode === "staff" ? (
          <form className="space-y-4" onSubmit={submitStaff}>
            <div><Label htmlFor="staff-identifier">Username or email</Label><Input id="staff-identifier" value={identifier} onChange={event => setIdentifier(event.target.value)} autoComplete="username" placeholder="e.g. principal" className="mt-2 rounded-xl" required /></div>
            <div><Label htmlFor="staff-password">Password</Label><Input id="staff-password" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" className="mt-2 rounded-xl" required /></div>
            {rememberMeField("staff-remember-me")}
            <Button type="submit" size="lg" disabled={busy} className="mt-2 w-full rounded-xl bg-[#0d4437] text-white hover:bg-[#092f26]">{staffLogin.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserRound className="mr-2 h-4 w-4" />}Sign in to school workspace</Button>
            <div className="flex flex-col gap-1">
              <Button type="button" variant="ghost" onClick={() => setMode("staff-reset")} className="w-full rounded-xl text-[#0d4437] hover:bg-emerald-50 dark:text-emerald-300">Forgot password?</Button>
              <Button type="button" variant="ghost" onClick={() => setMode("setup")} className="w-full rounded-xl text-[#0d4437] hover:bg-emerald-50 dark:text-emerald-300">First time here? Set up your account</Button>
            </div>
          </form>
        ) : null}

        {mode === "staff-reset" ? (
          <form className="space-y-4" onSubmit={submitStaffReset}>
            <div>
              <Label htmlFor="staff-reset-user-id">Account setup ID</Label>
              <Input id="staff-reset-user-id" inputMode="numeric" value={staffResetUserId} onChange={event => setStaffResetUserId(event.target.value)} placeholder="Account ID from admin" className="mt-2 rounded-xl font-mono" required />
              <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">Ask your school administrator for your account ID and one-time recovery code. The code expires after 24 hours.</p>
            </div>
            <div><Label htmlFor="staff-reset-code">One-time recovery code</Label><Input id="staff-reset-code" value={staffResetCode} onChange={event => setStaffResetCode(event.target.value.toUpperCase())} autoComplete="one-time-code" className="mt-2 rounded-xl font-mono uppercase tracking-[0.12em]" required /></div>
            <div><Label htmlFor="staff-reset-password">New password</Label><Input id="staff-reset-password" type="password" value={staffResetPassword} onChange={event => setStaffResetPassword(event.target.value)} autoComplete="new-password" className="mt-2 rounded-xl" minLength={8} required /></div>
            <div><Label htmlFor="staff-reset-confirm-password">Confirm new password</Label><Input id="staff-reset-confirm-password" type="password" value={staffResetConfirmPassword} onChange={event => setStaffResetConfirmPassword(event.target.value)} autoComplete="new-password" className="mt-2 rounded-xl" minLength={8} required /></div>
            <Button type="submit" size="lg" disabled={busy} className="w-full rounded-xl bg-[#0d4437] text-white hover:bg-[#092f26]">{staffReset.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}Reset staff password</Button>
          </form>
        ) : null}

        {mode === "reset" ? (
          <form className="space-y-4" onSubmit={submitReset}>
            {schoolCodeField("reset-student-school-code")}
            <div><Label htmlFor="reset-student-username">Learner name</Label><Input id="reset-student-username" value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" placeholder="e.g. Amina Otieno" className="mt-2 rounded-xl" required /></div>
            <div><Label htmlFor="student-reset-code">One-time reset code</Label><Input id="student-reset-code" value={resetCode} onChange={event => setResetCode(event.target.value.toUpperCase())} autoComplete="one-time-code" placeholder="Enter code from school office" className="mt-2 rounded-xl font-mono uppercase tracking-[0.12em]" required /></div>
            <div><Label htmlFor="student-reset-new-password">New password</Label><Input id="student-reset-new-password" type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} autoComplete="new-password" className="mt-2 rounded-xl" minLength={8} required /></div>
            <div><Label htmlFor="student-reset-confirm-password">Confirm new password</Label><Input id="student-reset-confirm-password" type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} autoComplete="new-password" className="mt-2 rounded-xl" minLength={8} required /></div>
            <Button type="submit" size="lg" disabled={busy} className="w-full rounded-xl bg-[#0d4437] text-white hover:bg-[#092f26]">{reset.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}Reset password</Button>
          </form>
        ) : null}

        {mode === "setup" ? (
          <form className="space-y-4" onSubmit={submitSetup}>
            <div>
              <Label htmlFor="setup-user-id">Account setup ID</Label>
              <Input id="setup-user-id" inputMode="numeric" value={setupUserId} onChange={event => setSetupUserId(event.target.value)} placeholder="Provided by the administrator" className="mt-2 rounded-xl font-mono" required />
              <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">Your administrator gives you this ID together with the one-time code.</p>
            </div>
            <div><Label htmlFor="setup-code">One-time setup code</Label><Input id="setup-code" value={setupCode} onChange={event => setSetupCode(event.target.value.toUpperCase())} autoComplete="one-time-code" className="mt-2 rounded-xl font-mono uppercase tracking-[0.12em]" required /></div>
            <div><Label htmlFor="setup-username">Choose a username</Label><Input id="setup-username" value={newUsername} onChange={event => setNewUsername(event.target.value)} autoComplete="username" className="mt-2 rounded-xl" required /></div>
            <div><Label htmlFor="setup-password">Create a password</Label><Input id="setup-password" type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} autoComplete="new-password" minLength={8} className="mt-2 rounded-xl" required /></div>
            <div><Label htmlFor="setup-confirm-password">Confirm password</Label><Input id="setup-confirm-password" type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} className="mt-2 rounded-xl" required /></div>
            <Button type="submit" size="lg" disabled={busy} className="w-full rounded-xl bg-[#0d4437] text-white hover:bg-[#092f26]">{setup.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}Create local account</Button>
          </form>
        ) : null}

        <div className="mt-5 rounded-2xl border border-emerald-950/8 bg-[#f4f7f5] p-3.5 dark:border-white/8 dark:bg-white/5">
          <p className="flex items-start gap-2 text-xs leading-5 text-slate-600 dark:text-slate-300"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#a8792c]" />Your account is protected by Elimubora360. Never share a password, setup code, or reset code publicly.</p>
        </div>
        <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400"><a href="/setup/super-admin" className="font-semibold text-[#0d4437] underline-offset-4 hover:underline dark:text-emerald-300">Super Administrator one-time setup</a></p>
      </CardContent>
    </Card>
  );
}
