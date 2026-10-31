import { BookOpenCheck, CheckCircle2, GraduationCap, WalletCards } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import StudentLoginCard from "./StudentLoginCard";
import { BRAND_LOGO_URL, BRAND_NAME, BRAND_TAGLINE } from "@/const";

export type PublicCapability = { icon: LucideIcon; title: string; copy: string };

export const PUBLIC_CAPABILITIES: PublicCapability[] = [
  { icon: GraduationCap, title: "Learner register", copy: "Admissions, guardians and class placement for Forms 1–4." },
  { icon: BookOpenCheck, title: "Academics", copy: "Marks, Kenyan grading, mean scores and printable report cards." },
  { icon: WalletCards, title: "Fees", copy: "KES balances, receipts, statements and M-Pesa billing." },
];

export const PUBLIC_TRUST_POINTS = ["Role-based access", "Audited changes", "Works on any phone"] as const;

export default function PublicAuthPage() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden text-slate-900 dark:text-slate-100">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/images/login-classroom.webp')" }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1] bg-[#082d24]/45 dark:bg-[#06110e]/65" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-[#082d24]/70 via-[#082d24]/20 to-[#082d24]/80" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-center lg:gap-16 lg:py-12">
        <section aria-labelledby="public-hero-title" className="text-white">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/95 p-1.5 shadow-[0_12px_28px_-14px_rgba(0,0,0,0.7)]">
              <img src={BRAND_LOGO_URL} alt={`${BRAND_NAME} logo`} className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-serif text-lg font-semibold tracking-[-0.03em]">{BRAND_NAME}</p>
              <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-100/70">{BRAND_TAGLINE}</p>
            </div>
          </div>

          <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.2em] text-[#e4bd69]">Built for Kenyan secondary schools</p>
          <h1 id="public-hero-title" className="mt-3 max-w-xl text-2xl font-semibold leading-tight tracking-[-0.045em] sm:text-3xl lg:text-[2.65rem] lg:leading-[1.1]">
            Every school record, in one calm place.
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-6 text-emerald-50/80 sm:text-base sm:leading-7">
            Keep learners, marks, attendance, fees and communication together — so your team stops chasing paperwork and gets back to teaching.
          </p>

          <ul className="mt-7 hidden gap-3 lg:grid">
            {PUBLIC_CAPABILITIES.map(capability => {
              const Icon = capability.icon;
              return (
                <li key={capability.title} className="flex items-start gap-3 rounded-2xl border border-white/12 bg-white/8 p-3.5 backdrop-blur-sm">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#e4bd69] text-[#16382f]"><Icon className="h-4 w-4" /></span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-white">{capability.title}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-emerald-50/70">{capability.copy}</span>
                  </span>
                </li>
              );
            })}
          </ul>

          <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Why schools trust Elimubora360">
            {PUBLIC_TRUST_POINTS.map(point => (
              <li key={point} className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-50/75">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#e4bd69]" />{point}
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-6 w-full lg:mt-0"><StudentLoginCard /></div>

        <p className="mt-6 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-50/55 lg:col-span-2 lg:mt-10">Designed by Jacks Webs Solutions</p>
      </div>
    </main>
  );
}
