import { LockKeyhole, Loader2, School, ShieldCheck } from "lucide-react";
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
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const login = trpc.auth.loginStudent.useMutation({
    onSuccess: async result => {
      toast.success(`Welcome, ${result.student.name}.`);
      await utils.auth.me.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    login.mutate({ username, password });
  };

  return <main className="grid min-h-screen place-items-center bg-[#f5f7f5] p-4 text-slate-900 dark:bg-[#101b18] dark:text-slate-100 sm:p-6"><Card className="w-full max-w-md overflow-hidden rounded-[2rem] border-emerald-950/10 bg-white shadow-[0_24px_80px_-32px_rgba(11,61,46,0.32)] dark:border-white/10 dark:bg-[#172420]"><CardHeader className="p-6 pb-4 sm:p-8 sm:pb-5"><div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0d4437] text-white shadow-lg shadow-emerald-950/20"><School className="h-6 w-6" /></div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#ae7d2c]">Learner portal</p><CardTitle className="mt-3 text-3xl tracking-[-0.045em] text-[#103b31] dark:text-emerald-50">Access your results.</CardTitle><CardDescription className="mt-3 leading-6">Sign in with the full name recorded by the school and your admission number as the password.</CardDescription></CardHeader><CardContent className="p-6 pt-0 sm:p-8 sm:pt-0"><form className="space-y-4" onSubmit={submit}><div><Label htmlFor="student-username">Learner name</Label><Input id="student-username" value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" placeholder="e.g. Amina Otieno" className="mt-2 rounded-xl" required /><p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">Use your first, middle, and last names as recorded in the school register.</p></div><div><Label htmlFor="student-password">Admission number</Label><Input id="student-password" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" placeholder="e.g. ADM-0001" className="mt-2 rounded-xl font-mono" required /><p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">Your admission number is your password. Ask the school office if your name is shared with another learner.</p></div><Button type="submit" size="lg" disabled={login.isPending} className="mt-2 w-full rounded-xl bg-[#0d4437] text-white hover:bg-[#092f26]">{login.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LockKeyhole className="mr-2 h-4 w-4" />}Sign in to results</Button></form><div className="mt-5 rounded-2xl border border-emerald-950/8 bg-[#f4f7f5] p-3.5 dark:border-white/8 dark:bg-white/5"><p className="flex items-start gap-2 text-xs leading-5 text-slate-600 dark:text-slate-300"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#a8792c]" />Your results, attendance, timetable, and fee status are scoped to your own learner account.</p></div><div className="mt-6 border-t border-emerald-950/8 pt-5 text-center dark:border-white/8"><p className="text-xs text-slate-500 dark:text-slate-400">School staff and parents</p><Button type="button" variant="outline" onClick={() => startLogin()} className="mt-2 rounded-xl bg-white dark:bg-transparent">Use secure school sign-in</Button></div></CardContent></Card></main>;
}
