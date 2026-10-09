import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";

const roles = ["user", "principal", "deputy_principal", "teacher", "class_teacher", "bursar", "parent", "student"] as const;
const displayDate = (value?: Date | string | null) => value ? new Date(value).toLocaleDateString() : "Never";
const roleLabel = (role: string) => role.replaceAll("_", " ");

export default function PlatformUserDirectory() {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [schoolId, setSchoolId] = useState("");
  const [createdAfter, setCreatedAfter] = useState("");
  const [createdBefore, setCreatedBefore] = useState("");
  const [page, setPage] = useState(1);
  const utils = trpc.useUtils();
  const result = trpc.school.platform.users.useQuery({
    query: query.trim() || undefined,
    role: role === "all" ? undefined : role as typeof roles[number] | "super_admin",
    status: status === "all" ? undefined : status as "active" | "suspended",
    schoolId: Number(schoolId) || undefined,
    createdAfter: createdAfter ? new Date(`${createdAfter}T00:00:00`) : undefined,
    createdBefore: createdBefore ? new Date(new Date(`${createdBefore}T00:00:00`).getTime() + 24 * 60 * 60 * 1000) : undefined,
    page,
    pageSize: 20,
  });
  const roleMutation = trpc.school.platform.setUserRole.useMutation({
    onSuccess: () => { toast.success("User role updated."); void utils.school.platform.users.invalidate(); void utils.school.platform.dashboard.invalidate(); },
    onError: error => toast.error(error.message),
  });
  const statusMutation = trpc.school.platform.setUserStatus.useMutation({
    onSuccess: result => { toast.success(result.suspended ? "Account suspended." : "Account reinstated."); void utils.school.platform.users.invalidate(); void utils.school.platform.dashboard.invalidate(); },
    onError: error => toast.error(error.message),
  });
  const totalPages = Math.max(1, Math.ceil((result.data?.total ?? 0) / 20));
  const resetFilters = () => { setQuery(""); setRole("all"); setStatus("all"); setSchoolId(""); setCreatedAfter(""); setCreatedBefore(""); setPage(1); };

  return <Card className="border-emerald-950/8 bg-white/85 dark:border-white/8 dark:bg-[#172420]">
    <CardHeader><CardTitle className="text-base">Global user directory</CardTitle><CardDescription>Search and manage accounts across schools. Super Administrator and platform-admin accounts are protected from role/status changes here.</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Input aria-label="Search users" placeholder="Search name or email" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} />
        <Select value={role} onValueChange={value => { setRole(value); setPage(1); }}><SelectTrigger aria-label="Filter by role"><SelectValue placeholder="All roles" /></SelectTrigger><SelectContent><SelectItem value="all">All roles</SelectItem><SelectItem value="super_admin">Super Admin</SelectItem>{roles.map(item => <SelectItem key={item} value={item}>{roleLabel(item)}</SelectItem>)}</SelectContent></Select>
        <Select value={status} onValueChange={value => { setStatus(value); setPage(1); }}><SelectTrigger aria-label="Filter by account status"><SelectValue placeholder="All statuses" /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="suspended">Suspended</SelectItem></SelectContent></Select>
        <Input aria-label="Filter by school ID" inputMode="numeric" type="number" min="1" placeholder="School ID (optional)" value={schoolId} onChange={event => { setSchoolId(event.target.value); setPage(1); }} />
        <label className="grid gap-1 text-xs text-slate-500">Registered from<Input aria-label="Registered from" type="date" value={createdAfter} onChange={event => { setCreatedAfter(event.target.value); setPage(1); }} /></label>
        <label className="grid gap-1 text-xs text-slate-500">Registered through<Input aria-label="Registered through" type="date" value={createdBefore} onChange={event => { setCreatedBefore(event.target.value); setPage(1); }} /></label>
        <Button variant="outline" onClick={resetFilters}>Clear filters</Button>
        <Button variant="outline" onClick={() => void result.refetch()} disabled={result.isFetching}>{result.isFetching ? "Refreshing…" : "Refresh list"}</Button>
      </div>
      {result.error ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{result.error.message}</p> : null}
      <div className="overflow-x-auto rounded-xl border border-emerald-950/8 dark:border-white/8"><table className="w-full min-w-[950px] text-left text-sm"><thead className="bg-[#f4f7f5] text-xs uppercase text-slate-500 dark:bg-white/5"><tr>{["Account", "School", "Role", "Status", "Registered", "Last sign-in", "Actions"].map(label => <th key={label} className="px-3 py-3 font-semibold">{label}</th>)}</tr></thead><tbody>
        {result.isLoading ? <tr><td colSpan={7} className="p-6 text-center text-slate-500">Loading accounts…</td></tr> : result.data?.rows.length ? result.data.rows.map(account => {
          const protectedAccount = account.role === "super_admin" || account.isPlatformAdmin;
          const suspended = Boolean(account.disabledAt);
          return <tr key={account.id} className="border-t border-emerald-950/7 dark:border-white/8"><td className="px-3 py-3"><p className="font-semibold">{account.name || "Unnamed account"}</p><p className="text-xs text-slate-500">{account.email || "No email"} · ID {account.id}</p></td><td className="px-3 py-3">{account.schoolName || (account.schoolId ? `School #${account.schoolId}` : "Unassigned")}</td><td className="px-3 py-3">{protectedAccount ? <span className="font-medium">{roleLabel(account.role)}{account.isPlatformAdmin ? " · platform admin" : ""}</span> : <Select value={account.role} onValueChange={value => roleMutation.mutate({ userId: account.id, role: value as typeof roles[number] })}><SelectTrigger aria-label={`Role for ${account.name || account.email || account.id}`} className="h-9 w-40"><SelectValue /></SelectTrigger><SelectContent>{roles.map(item => <SelectItem key={item} value={item}>{roleLabel(item)}</SelectItem>)}</SelectContent></Select>}</td><td className="px-3 py-3"><span className={suspended ? "rounded-full bg-rose-100 px-2 py-1 text-xs text-rose-800" : "rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-800"}>{suspended ? "Suspended" : "Active"}</span></td><td className="px-3 py-3">{displayDate(account.createdAt)}</td><td className="px-3 py-3">{displayDate(account.lastSignedIn)}</td><td className="px-3 py-3">{protectedAccount ? <span className="text-xs text-slate-500">Protected account</span> : <Button size="sm" variant={suspended ? "outline" : "destructive"} disabled={statusMutation.isPending} onClick={() => { const next = !suspended; if (window.confirm(`${next ? "Suspend" : "Reinstate"} ${account.name || account.email || "this account"}? ${next ? "They will no longer be able to sign in." : "They will be able to sign in again."}`)) statusMutation.mutate({ userId: account.id, suspended: next, reason: next ? "Suspended by platform administrator" : undefined }); }}>{suspended ? "Reinstate" : "Suspend"}</Button>}</td></tr>;
        }) : <tr><td colSpan={7} className="p-8 text-center text-slate-500">No accounts match the selected filters.</td></tr>}
      </tbody></table></div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><p className="text-slate-500">{result.data?.total ?? 0} account(s) · Page {page} of {totalPages}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1 || result.isFetching} onClick={() => setPage(current => Math.max(1, current - 1))}>Previous</Button><Button variant="outline" size="sm" disabled={page >= totalPages || result.isFetching} onClick={() => setPage(current => Math.min(totalPages, current + 1))}>Next</Button></div></div>
    </CardContent>
  </Card>;
}
