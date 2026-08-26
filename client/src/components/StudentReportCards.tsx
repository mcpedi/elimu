import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { BRAND_LOGO_URL } from "@/const";
import { format } from "date-fns";
import { Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

function escapePrintable(value: unknown) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function formatDate(value: Date | string | null | undefined) {
  return value ? format(new Date(value), "d MMM yyyy") : "—";
}

function printableReportCard(title: string, school: { name: string; code: string; phone?: string | null; email?: string | null; address?: string | null; logoUrl?: string | null }, body: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapePrintable(title)}</title><style>body{font-family:Arial,sans-serif;color:#16382f;margin:0;padding:36px;background:#f3f6f4}main{max-width:820px;margin:auto;background:#fff;padding:42px;box-shadow:0 8px 30px rgba(13,68,55,.12)}header{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #e4bd69;padding-bottom:22px;margin-bottom:28px}.brand{display:flex;align-items:center;gap:14px}.brand img{width:58px;height:58px;object-fit:contain}h1{font-size:26px;margin:0 0 6px}h2{font-size:18px;margin:26px 0 10px}.muted{color:#64756d;font-size:12px;line-height:1.6}.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:18px 0 26px}.meta div{background:#f3f6f4;padding:10px 12px}.meta strong{display:block;font-size:11px;color:#64756d;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;border-bottom:1px solid #dfe8e2;padding:10px 8px}th{font-size:11px;text-transform:uppercase;color:#64756d}td:last-child,th:last-child{text-align:right}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:18px 0 26px}.summary div{background:#e8f1ec;padding:12px}.summary strong{display:block;font-size:11px;color:#64756d;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px}.summary span{font-size:18px;font-weight:700}.comment{margin-top:24px;padding:14px;background:#f3f6f4;line-height:1.6;font-size:13px}@media print{body{background:#fff;padding:0}main{box-shadow:none;max-width:none;padding:0}}@media(max-width:640px){body{padding:12px}main{padding:20px}header{display:block}.summary{grid-template-columns:1fr}table{font-size:11px}th,td{padding:7px 4px}}</style></head><body><main><header><div class="brand"><img src="${escapePrintable(school.logoUrl || BRAND_LOGO_URL)}" alt="School logo"><div><h1>${escapePrintable(school.name)}</h1><p class="muted">${escapePrintable(school.code)} · ${escapePrintable(school.address)}<br>${escapePrintable(school.phone)} · ${escapePrintable(school.email)}</p></div></div><div><h1>${escapePrintable(title)}</h1><p class="muted">Generated ${escapePrintable(new Date().toLocaleString("en-KE"))}</p></div></header>${body}</main></body></html>`;
}

function openPrintableReportCard(title: string, html: string) {
  const popup = window.open("", "_blank", "width=900,height=900");
  if (!popup) {
    toast.error("Allow pop-ups to print or save this report card as a PDF.");
    return false;
  }
  popup.document.write(html);
  popup.document.close();
  popup.document.title = title;
  popup.focus();
  popup.print();
  return true;
}

export default function StudentReportCards() {
  const reportCards = trpc.school.reportCards.mine.useQuery();
  const exportPdf = trpc.school.reportCards.exportPdf.useMutation({ onSuccess: () => toast.success("Report card export recorded. Use the print dialog to save the document as PDF."), onError: error => toast.error(error.message) });
  const data = reportCards.data;
  const buildDocument = (card: NonNullable<typeof data>["reportCards"][number]) => {
    if (!data) return "";
    const resultRows = card.resultSnapshot.map(result => `<tr><td>${escapePrintable(result.subject)}</td><td>${escapePrintable(result.subjectCode)}</td><td>${escapePrintable(result.assessment)}</td><td>${escapePrintable(formatDate(result.assessmentDate))}</td><td>${result.score} / ${result.maxMarks}</td><td>${escapePrintable(result.grade)}</td><td>${result.gradePoints}</td></tr>`).join("");
    const body = `<div class="meta"><div><strong>Learner</strong>${escapePrintable(card.studentFirstName)} ${escapePrintable(card.studentLastName)}</div><div><strong>Admission number</strong>${escapePrintable(card.admissionNo)}</div><div><strong>Academic year</strong>${escapePrintable(card.academicYear)}</div><div><strong>Term</strong>${escapePrintable(card.term)}</div><div><strong>Class</strong>${escapePrintable(card.form)} · ${escapePrintable(card.stream)}</div><div><strong>Published</strong>${escapePrintable(formatDate(card.publishedAt))}</div></div><div class="summary"><div><strong>Average</strong><span>${escapePrintable(card.averagePercentage)}%</span></div><div><strong>Mean points</strong><span>${escapePrintable(card.meanPoints)}</span></div><div><strong>Overall grade</strong><span>${escapePrintable(card.overallGrade)}</span></div></div><h2>Subject results</h2><table><thead><tr><th>Subject</th><th>Code</th><th>Assessment</th><th>Date</th><th>Score</th><th>Grade</th><th>Points</th></tr></thead><tbody>${resultRows || `<tr><td colspan="7">No subject results were included.</td></tr>`}</tbody></table>${card.teacherComment ? `<div class="comment"><strong>Teacher comment</strong><br>${escapePrintable(card.teacherComment)}</div>` : ""}`;
    return printableReportCard(card.title, data.school, body);
  };
  const handleDownload = (card: NonNullable<typeof data>["reportCards"][number]) => {
    const html = buildDocument(card);
    if (!html) return toast.error("Report card data is not ready yet.");
    if (openPrintableReportCard(card.title, html)) exportPdf.mutate({ reportCardId: card.id });
  };
  return <Card className="border-emerald-950/8 bg-white/85 dark:border-white/8 dark:bg-[#172420]"><CardHeader><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><CardTitle className="text-base text-[#143b31] dark:text-emerald-50">My report cards</CardTitle><CardDescription>Published term reports prepared by your teachers. Choose Print / save PDF and select “Save to PDF” in the browser print dialog.</CardDescription></div><FileText className="h-5 w-5 shrink-0 text-[#a8792c]" /></div></CardHeader><CardContent>{reportCards.isLoading ? <div className="space-y-3"><Skeleton className="h-28" /><Skeleton className="h-28" /></div> : reportCards.error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-950 dark:bg-rose-950/30 dark:text-rose-200">Your report cards could not be loaded. Please try again shortly.</div> : data?.reportCards.length ? <div className="grid gap-4 lg:grid-cols-2">{data.reportCards.map(card => <article key={card.id} className="rounded-2xl border border-emerald-950/8 bg-[#f7faf8] p-4 dark:border-white/8 dark:bg-white/5"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-[#133b30] dark:text-emerald-50">{card.title}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{card.academicYear} · {card.term} · {card.form} {card.stream}</p></div><Badge className="border-0 bg-[#fbf1d8] text-[#94651f] dark:bg-amber-950/50 dark:text-amber-300">{card.overallGrade}</Badge></div><div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-xl bg-white p-2.5 dark:bg-white/8"><p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Average</p><p className="mt-1 text-lg font-semibold text-[#0d4437] dark:text-emerald-300">{card.averagePercentage}%</p></div><div className="rounded-xl bg-white p-2.5 dark:bg-white/8"><p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Mean pts</p><p className="mt-1 text-lg font-semibold text-[#0d4437] dark:text-emerald-300">{card.meanPoints}</p></div><div className="rounded-xl bg-white p-2.5 dark:bg-white/8"><p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Subjects</p><p className="mt-1 text-lg font-semibold text-[#0d4437] dark:text-emerald-300">{card.resultSnapshot.length}</p></div></div><div className="mt-4 flex items-center justify-between gap-3"><p className="text-xs text-slate-500 dark:text-slate-400">Published {formatDate(card.publishedAt)}</p><Button size="sm" className="rounded-xl bg-[#0d4437] text-white hover:bg-[#092f26]" disabled={exportPdf.isPending} onClick={() => handleDownload(card)}>{exportPdf.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Print / save PDF</Button></div></article>)}</div> : <div className="rounded-xl border border-dashed border-emerald-950/12 p-5 text-sm leading-6 text-slate-500 dark:border-white/12 dark:text-slate-400">No published report cards are available yet. Your teacher will publish a term report after marks have been entered.</div>}</CardContent></Card>;
}
