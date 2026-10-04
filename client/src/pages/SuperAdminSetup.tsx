import { ArrowLeft, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { BRAND_LOGO_URL, BRAND_NAME, BRAND_TAGLINE } from "@/const";

export default function SuperAdminSetup() {
  const [, navigate] = useLocation();
  const [setupCode, setSetupCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const setup = trpc.auth.completeSuperAdminSetup.useMutation({
    onSuccess: result => {
      toast.success("Super Administrator account configured. Sign in with your new credentials.");
      navigate(`/?setup=complete&username=${encodeURIComponent(result.username)}`);
    },
    onError: error => toast.error(error.message),
  });
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setup.mutate({ setupCode, username, password, confirmPassword });
  };

  return <main className="grid min-h-screen place-items-center bg-[#f5f7f5] p-4 text-slate-900 dark:bg-[#101b18] dark:text-slate-100 sm:p-6"><Card className="w-full max-w-md overflow-hidden rounded-[2rem] border-emerald-950/10 bg-white shadow-[0_24px_80px_-32px_rgba(11,61,46,0.32)] dark:border-white/10 dark:bg-[#172420]"><CardHeader className="p-6 pb-4 sm:p-8 sm:pb-5"><div className="mb-5 flex items-center gap-3"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#0d4437] p-2 shadow-lg shadow-emerald-950/20"><img src={BRAND_LOGO_URL} alt={`${BRAND_NAME} logo`} className="h-full w-full object-contain" /></div><div><p className="font-serif text-lg font-semibold tracking-[-0.03em] text-[#103b31] dark:text-emerald-50">{BRAND_NAME}</p><p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.11em] text-[#a8792c]">{BRAND_TAGLINE}</p></div></div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#ae7d2c]">Secure account setup</p><CardTitle className="mt-3 text-3xl tracking-[-0.045em] text-[#103b31] dark:text-emerald-50">Configure your administrator access.</CardTitle><CardDescription className="mt-3 leading-6">Use the one-time code issued for the Super Administrator account. Choose a permanent username and a private password for future school access.</CardDescription></CardHeader><CardContent className="p-6 pt-0 sm:p-8 sm:pt-0"><form className="space-y-4" onSubmit={submit}><div><Label htmlFor="super-admin-setup-code">One-time setup code</Label><Input id="super-admin-setup-code" value={setupCode} onChange={event => setSetupCode(event.target.value.toUpperCase())} autoComplete="one-time-code" placeholder="Enter the 12-character code" className="mt-2 rounded-xl font-mono uppercase tracking-[0.12em]" required /><p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">The code expires after 24 hours and can be used once.</p></div><div><Label htmlFor="super-admin-username">Permanent username</Label><Input id="super-admin-username" value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" placeholder="e.g. system.admin" className="mt-2 rounded-xl" minLength={3} maxLength={80} required /><p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">Use a memorable username without spaces.</p></div><div><Label htmlFor="super-admin-password">Permanent password</Label><Input id="super-admin-password" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" className="mt-2 rounded-xl" minLength={8} maxLength={128} required /><p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">Use at least 8 characters and do not reuse a shared school password.</p></div><div><Label htmlFor="super-admin-confirm-password">Confirm password</Label><Input id="super-admin-confirm-password" type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} autoComplete="new-password" className="mt-2 rounded-xl" minLength={8} maxLength={128} required /></div><Button type="submit" size="lg" disabled={setup.isPending} className="w-full rounded-xl bg-[#0d4437] text-white hover:bg-[#092f26]">{setup.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}Save administrator credentials</Button></form><div className="mt-5 rounded-2xl border border-emerald-950/8 bg-[#f4f7f5] p-3.5 dark:border-white/8 dark:bg-white/5"><p className="flex items-start gap-2 text-xs leading-5 text-slate-600 dark:text-slate-300"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#a8792c]" />Your password is hashed before storage. The setup code is consumed immediately and is never displayed again after use.</p></div><Button type="button" variant="ghost" onClick={() => navigate("/")} className="mt-5 w-full rounded-xl text-[#0d4437] dark:text-emerald-300"><ArrowLeft className="mr-2 h-4 w-4" />Back to school sign-in</Button></CardContent></Card></main>;
}
