import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

const displayDateTime = (value: Date | string) => new Date(value).toLocaleString();

export default function PlatformAuditPanel() {
  const [query, setQuery] = useState("");
  const [actor, setActor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const result = trpc.school.platform.auditEvents.useQuery({
    query: query.trim() || undefined,
    actorUserId: Number(actor) || undefined,
    from: from ? new Date(`${from}T00:00:00`) : undefined,
    to: to ? new Date(new Date(`${to}T00:00:00`).getTime() + 24 * 60 * 60 * 1000) : undefined,
    page,
    pageSize: 25,
  });
  const totalPages = Math.max(1, Math.ceil((result.data?.total ?? 0) / 25));
  return <Card className="border-emerald-950/8 bg-white/85 dark:border-white/8 dark:bg-[#172420]">
    <CardHeader><CardTitle className="text-base">Administrative audit trail</CardTitle><CardDescription>Search recorded actions by event, actor ID, and date. Sensitive event metadata is intentionally not returned to the browser.</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <Input aria-label="Search audit events" placeholder="Event/action" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} />
        <Input aria-label="Filter by actor user ID" type="number" min="1" placeholder="Actor user ID" value={actor} onChange={event => { setActor(event.target.value); setPage(1); }} />
        <Input aria-label="Audit start date" type="date" value={from} onChange={event => { setFrom(event.target.value); setPage(1); }} />
        <Input aria-label="Audit end date" type="date" value={to} onChange={event => { setTo(event.target.value); setPage(1); }} />
        <Button variant="outline" onClick={() => void result.refetch()} disabled={result.isFetching}>{result.isFetching ? "Refreshing…" : "Refresh events"}</Button>
      </div>
      {result.error ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{result.error.message}</p> : null}
      <div className="overflow-x-auto rounded-xl border border-emerald-950/8 dark:border-white/8"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-[#f4f7f5] text-xs uppercase text-slate-500 dark:bg-white/5"><tr>{["Time", "Event", "Resource", "Actor", "School"].map(label => <th key={label} className="px-3 py-3 font-semibold">{label}</th>)}</tr></thead><tbody>
        {result.isLoading ? <tr><td colSpan={5} className="p-6 text-center text-slate-500">Loading audit events…</td></tr> : result.data?.rows.length ? result.data.rows.map(event => <tr key={event.id} className="border-t border-emerald-950/7 dark:border-white/8"><td className="px-3 py-3">{displayDateTime(event.createdAt)}</td><td className="px-3 py-3 font-mono text-xs">{event.action}</td><td className="px-3 py-3">{event.entityType}{event.entityId ? ` #${event.entityId}` : ""}</td><td className="px-3 py-3">{event.actorName || "System"}{event.actorUserId ? ` · ID ${event.actorUserId}` : ""}</td><td className="px-3 py-3">{event.schoolId ? `#${event.schoolId}` : "Platform"}</td></tr>) : <tr><td colSpan={5} className="p-8 text-center text-slate-500">No audit events match these filters.</td></tr>}
      </tbody></table></div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><p className="text-slate-500">{result.data?.total ?? 0} event(s) · Page {page} of {totalPages}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1 || result.isFetching} onClick={() => setPage(current => Math.max(1, current - 1))}>Previous</Button><Button variant="outline" size="sm" disabled={page >= totalPages || result.isFetching} onClick={() => setPage(current => Math.min(totalPages, current + 1))}>Next</Button></div></div>
    </CardContent>
  </Card>;
}
