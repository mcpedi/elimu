import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";

export default function StudentPasswordCard() {
  const utils = trpc.useUtils();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const changePassword = trpc.auth.changeStudentPassword.useMutation({
    onSuccess: async () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await utils.auth.me.invalidate();
      toast.success("Your password has been changed.");
    },
    onError: error => toast.error(error.message),
  });

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    changePassword.mutate({ currentPassword, newPassword, confirmPassword });
  };

  return <Card className="border-emerald-950/8 bg-white/85 shadow-[0_14px_36px_-26px_rgba(10,65,48,0.28)] dark:border-white/8 dark:bg-[#172420]"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base text-[#143b31] dark:text-emerald-50"><KeyRound className="h-4 w-4 text-[#a8792c]" />Change password</CardTitle><CardDescription className="mt-1 leading-5">Replace the admission-number password with a private password only you know.</CardDescription></CardHeader><CardContent><form className="grid gap-4 sm:grid-cols-3" onSubmit={submit}><div><Label htmlFor="student-current-password">Current password</Label><Input id="student-current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} className="mt-2 rounded-xl" required /></div><div><Label htmlFor="student-new-password">New password</Label><Input id="student-new-password" type="password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} className="mt-2 rounded-xl" minLength={8} required /><p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">Use at least 8 characters.</p></div><div><Label htmlFor="student-confirm-password">Confirm new password</Label><Input id="student-confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className="mt-2 rounded-xl" minLength={8} required /></div><div className="flex flex-col gap-3 sm:col-span-3 sm:flex-row sm:items-center sm:justify-between"><p className="flex items-start gap-2 text-xs leading-5 text-slate-500 dark:text-slate-400"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />Changing your password keeps this session active and records the change securely.</p><Button type="submit" disabled={changePassword.isPending} className="shrink-0 rounded-xl bg-[#0d4437] text-white hover:bg-[#092f26]">{changePassword.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save new password</Button></div></form></CardContent></Card>;
}
