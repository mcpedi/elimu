import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { useTheme } from "@/contexts/ThemeContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Bell, ChevronDown, LogOut, Menu, Moon, School, Sun, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

export type NavigationItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

type DashboardLayoutProps = {
  children: React.ReactNode;
  navigation: NavigationItem[];
  activeId: string;
  onNavigate: (id: string) => void;
  title: string;
  subtitle?: string;
  notificationCount?: number;
};

export default function DashboardLayout({ children, navigation, activeId, onNavigate, title, subtitle, notificationCount = 0 }: DashboardLayoutProps) {
  const { loading, user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeLabel = navigation.find(item => item.id === activeId)?.label ?? title;

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <main className="min-h-screen bg-[#f5f7f5] text-slate-900 grid place-items-center p-6">
        <section className="w-full max-w-md rounded-[2rem] border border-emerald-950/10 bg-white p-8 shadow-[0_24px_80px_-32px_rgba(11,61,46,0.32)]">
          <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0d4437] text-white shadow-lg shadow-emerald-950/20"><School className="h-6 w-6" /></div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ae7d2c]">Kenyan school operating system</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-[#103b31]">One secure place for the school day.</h1>
          <p className="mt-4 leading-7 text-slate-600">Sign in to access the workspace that matches your role and linked school records.</p>
          <Button onClick={() => startLogin()} size="lg" className="mt-8 w-full rounded-xl bg-[#0d4437] text-white hover:bg-[#0a352b]">Sign in securely</Button>
        </section>
      </main>
    );
  }

  const navigate = (id: string) => {
    onNavigate(id);
    setMobileOpen(false);
  };

  const initials = (user.name || "School User").split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-[#f4f7f5] text-slate-900 dark:bg-[#101b18] dark:text-slate-100">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[270px] flex-col border-r border-emerald-950/10 bg-[#0d4437] px-4 py-5 text-emerald-50 lg:flex">
        <div className="flex items-center gap-3 px-2">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#d5a74b] text-[#16382f] shadow-[0_12px_28px_-12px_rgba(0,0,0,0.65)]"><School className="h-5 w-5" /></div>
          <div className="min-w-0"><p className="font-serif text-lg font-semibold tracking-[-0.03em]">Shule</p><p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100/55">School workspace</p></div>
        </div>

        <div className="mt-9 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-100/45">Workspace</div>
        <nav className="mt-3 space-y-1" aria-label="Primary navigation">
          {navigation.map(item => {
            const Icon = item.icon;
            const active = item.id === activeId;
            return <button key={item.id} onClick={() => navigate(item.id)} className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-all duration-150 ${active ? "bg-white/14 text-white shadow-inner" : "text-emerald-50/68 hover:bg-white/8 hover:text-white"}`}>
              <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-[#e4bd69]" : "text-emerald-100/65 group-hover:text-emerald-50"}`} />
              <span className="flex-1 font-medium">{item.label}</span>
              {item.badge ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#d5a74b] px-1 text-[10px] font-bold text-[#16382f]">{item.badge}</span> : null}
            </button>;
          })}
        </nav>

        <div className="mt-auto rounded-2xl border border-white/10 bg-white/6 p-3">
          <p className="text-xs font-semibold text-white">Security-first access</p>
          <p className="mt-1 text-xs leading-5 text-emerald-50/58">Views and records are scoped to your school role.</p>
        </div>
      </aside>

      <div className="lg:pl-[270px]">
        <header className="sticky top-0 z-20 border-b border-emerald-950/8 bg-[#f4f7f5]/90 px-4 py-3 backdrop-blur-xl dark:border-white/8 dark:bg-[#101b18]/90 sm:px-6 lg:px-9">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Button variant="ghost" size="icon" className="rounded-xl lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu className="h-5 w-5" /></Button>
              <div className="min-w-0"><p className="truncate text-lg font-semibold tracking-[-0.03em] text-[#143b31] dark:text-emerald-50">{activeLabel}</p>{subtitle ? <p className="hidden truncate text-xs text-slate-500 sm:block dark:text-slate-400">{subtitle}</p> : null}</div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-xl text-slate-600 hover:bg-white hover:text-[#0d4437] dark:text-slate-300 dark:hover:bg-white/10" aria-label="Switch colour theme">{theme === "dark" ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}</Button>
              <Button variant="ghost" size="icon" className="relative rounded-xl text-slate-600 hover:bg-white hover:text-[#0d4437] dark:text-slate-300 dark:hover:bg-white/10" aria-label="Notifications"><Bell className="h-4.5 w-4.5" />{notificationCount ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#c48c31] ring-2 ring-[#f4f7f5] dark:ring-[#101b18]" /> : null}</Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><button className="ml-1 flex items-center gap-2 rounded-xl px-1.5 py-1.5 text-left transition-colors hover:bg-white dark:hover:bg-white/10"><Avatar className="h-8 w-8 border border-[#d5a74b]/35"><AvatarFallback className="bg-[#e4bd69] text-xs font-bold text-[#17382f]">{initials}</AvatarFallback></Avatar><div className="hidden min-w-0 sm:block"><p className="max-w-32 truncate text-xs font-semibold">{user.name || "School user"}</p><p className="max-w-32 truncate text-[10px] font-medium capitalize text-slate-500 dark:text-slate-400">{user.role.replaceAll("_", " ")}</p></div><ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 sm:block" /></button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 rounded-xl"><div className="px-3 py-2"><p className="text-sm font-medium">{user.name || "School user"}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{user.email || "No email available"}</p></div><DropdownMenuSeparator /><DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive" onClick={logout}><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem></DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] px-4 py-6 pb-24 sm:px-6 lg:px-9 lg:py-8 lg:pb-10">{children}</main>
      </div>

      {mobileOpen ? <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Close navigation overlay" className="absolute inset-0 bg-[#092f26]/55 backdrop-blur-[2px]" onClick={() => setMobileOpen(false)} /><div className="relative h-full w-[84%] max-w-[320px] bg-[#0d4437] px-4 py-5 text-emerald-50 shadow-2xl"><div className="flex items-center justify-between px-2"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#d5a74b] text-[#16382f]"><School className="h-5 w-5" /></div><span className="font-serif text-lg font-semibold">Shule</span></div><Button variant="ghost" size="icon" className="rounded-xl text-white hover:bg-white/10 hover:text-white" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X className="h-5 w-5" /></Button></div><nav className="mt-8 space-y-1">{navigation.map(item => { const Icon = item.icon; const active = item.id === activeId; return <button key={item.id} onClick={() => navigate(item.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm ${active ? "bg-white/14 text-white" : "text-emerald-50/70"}`}><Icon className={`h-[18px] w-[18px] ${active ? "text-[#e4bd69]" : ""}`} /><span className="font-medium">{item.label}</span></button>; })}</nav></div></div> : null}

      <nav className="fixed inset-x-3 bottom-3 z-30 flex items-center justify-around rounded-2xl border border-white/70 bg-white/95 p-1.5 shadow-[0_18px_45px_-20px_rgba(8,52,42,0.45)] backdrop-blur-xl dark:border-white/10 dark:bg-[#1a2925]/95 lg:hidden" aria-label="Mobile navigation">{navigation.slice(0, 5).map(item => { const Icon = item.icon; const active = item.id === activeId; return <button key={item.id} onClick={() => navigate(item.id)} className={`grid min-w-12 place-items-center gap-0.5 rounded-xl px-2 py-1.5 text-[9px] font-semibold ${active ? "bg-[#e8f1ec] text-[#0d4437] dark:bg-emerald-950/60 dark:text-[#e4bd69]" : "text-slate-500 dark:text-slate-400"}`}><Icon className="h-4 w-4" /><span className="max-w-14 truncate">{item.label}</span></button>; })}</nav>
    </div>
  );
}
