import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { escapePrintable, openPrintableDocument, printableDocument, type PrintableSchool } from "@/lib/printable";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { FileSpreadsheet, FileText, Loader2, Printer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const academicAccess = ["super_admin", "principal", "deputy_principal", "teacher", "class_teacher"];
const financeAccess = ["super_admin", "principal", "bursar"];

const money = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });

function formatMoney(value: number) {
  return money.format(Number(value ?? 0));
}

function formatDay(value: string | null | undefined) {
  if (!value) return "—";
  return format(new Date(value), "d MMM yyyy");
}

function classLabel(item: { form: string; stream: string } | null | undefined) {
  return item ? `${item.form} ${item.stream}`.trim() : "Class";
}

function useStateOverride(fallback: string) {
  const [value, setValue] = useState("");
  return [value || fallback, setValue] as const;
}

function signatureBlock() {
  return `<div class="meta" style="grid-template-columns:repeat(3,1fr);margin-top:34px"><div><strong>Class teacher</strong>&nbsp;</div><div><strong>Deputy principal</strong>&nbsp;</div><div><strong>Principal</strong>&nbsp;</div></div>`;
}

function resultSheetDocument(data: {
  school: PrintableSchool;
  class: { id: number; form: string; stream: string };
  academicYear: string;
  term: string;
  subjects: Array<{ id: number; name: string; code: string }>;
  rows: Array<{ fullName: string; admissionNo: string; position: number | null; average: number | null; overallGrade: string | null; marks: Array<{ score: number | null; maxMarks: number | null }> }>;
  summary: {
    learners: number;
    graded: number;
    classMean: number | null;
    highest: { fullName: string; average: number } | null;
    gradeDistribution: Array<{ grade: string; count: number }>;
    subjectMeans: Array<{ subject: string; entries: number; mean: number | null }>;
  };
}) {
  const headerCells = data.subjects.map(subject => `<th class="num">${escapePrintable(subject.code)}</th>`).join("");
  const bodyRows = data.rows
    .map(
      row =>
        `<tr><td>${row.position ?? "—"}</td><td>${escapePrintable(row.fullName)}<br><span class="muted">${escapePrintable(row.admissionNo)}</span></td>${row.marks
          .map(mark => `<td class="num">${mark.score === null ? "—" : `${mark.score}/${mark.maxMarks}`}</td>`)
          .join("")}<td class="num">${row.average ?? "—"}</td><td class="num">${escapePrintable(row.overallGrade ?? "—")}</td></tr>`,
    )
    .join("");
  const distribution = data.summary.gradeDistribution.map(item => `${escapePrintable(item.grade)}: ${item.count}`).join(" · ") || "No graded learners yet";
  const subjectMeans = data.summary.subjectMeans
    .map(row => `<tr><td>${escapePrintable(row.subject)}</td><td class="num">${row.entries}</td><td class="num">${row.mean === null ? "—" : `${row.mean}%`}</td></tr>`)
    .join("");
  const body = `<div class="meta"><div><strong>Class</strong>${escapePrintable(classLabel(data.class))}</div><div><strong>Academic year</strong>${escapePrintable(data.academicYear)}</div><div><strong>Term</strong>${escapePrintable(data.term)}</div><div><strong>Class mean</strong>${data.summary.classMean === null ? "—" : `${data.summary.classMean}%`}</div></div><div class="summary"><div><strong>Learners</strong><span>${data.summary.learners}</span></div><div><strong>Graded</strong><span>${data.summary.graded}</span></div><div><strong>Class mean</strong><span>${data.summary.classMean === null ? "—" : `${data.summary.classMean}%`}</span></div><div><strong>Top average</strong><span>${data.summary.highest ? `${data.summary.highest.average}%` : "—"}</span></div></div><h2>Subject results</h2><table><thead><tr><th>Pos</th><th>Learner</th>${headerCells}<th class="num">Avg</th><th class="num">Grade</th></tr></thead><tbody>${bodyRows || `<tr><td colspan="${data.subjects.length + 4}">No active learners in this class.</td></tr>`}</tbody></table><p class="muted" style="margin-top:14px">Grade distribution — ${distribution}</p><h2>Subject means</h2><table><thead><tr><th>Subject</th><th class="num">Marks</th><th class="num">Mean</th></tr></thead><tbody>${subjectMeans || `<tr><td colspan="3">No marks recorded for this term.</td></tr>`}</tbody></table>${signatureBlock()}`;
  return printableDocument(`Class result sheet — ${classLabel(data.class)}`, data.school, body);
}

function feeStatementDocument(data: {
  school: PrintableSchool;
  class: { id: number; form: string; stream: string };
  term: { name: string } | null;
  rows: Array<{
    fullName: string;
    admissionNo: string;
    billed: number;
    paid: number;
    balance: number;
    status: string;
    charges: Array<{ feeName: string; due: number; paid: number; dueDate: string | null }>;
    payments: Array<{ receiptNo: string; amount: number; method: string; paymentDate: string }>;
  }>;
  totals: { learners: number; billed: number; paid: number; balance: number; cleared: number; outstanding: number };
}) {
  const sections = data.rows
    .map(learner => {
      const charges = learner.charges
        .map(
          charge =>
            `<tr><td>${escapePrintable(charge.feeName)}</td><td>${escapePrintable(formatDay(charge.dueDate))}</td><td class="num">${formatMoney(charge.due)}</td><td class="num">${formatMoney(charge.paid)}</td><td class="num">${formatMoney(charge.due - charge.paid)}</td></tr>`,
        )
        .join("");
      const payments = learner.payments
        .map(
          payment =>
            `<tr><td>${escapePrintable(payment.receiptNo)}</td><td>${escapePrintable(formatDay(payment.paymentDate))}</td><td>${escapePrintable(payment.method.toUpperCase())}</td><td class="num">${formatMoney(payment.amount)}</td></tr>`,
        )
        .join("");
      return `<section class="learner"><div class="learner-head"><div><h2>${escapePrintable(learner.fullName)}</h2><p class="muted">Admission ${escapePrintable(learner.admissionNo)} · ${escapePrintable(classLabel(data.class))}</p></div><span class="tag ${learner.status === "cleared" ? "cleared" : learner.status === "unpaid" ? "unpaid" : ""}">${escapePrintable(learner.status.replace("_", " "))}</span></div><div class="summary" style="grid-template-columns:repeat(3,1fr)"><div><strong>Billed</strong><span>${formatMoney(learner.billed)}</span></div><div><strong>Paid</strong><span>${formatMoney(learner.paid)}</span></div><div><strong>Balance</strong><span>${formatMoney(learner.balance)}</span></div></div><table><thead><tr><th>Fee</th><th>Due date</th><th class="num">Billed</th><th class="num">Paid</th><th class="num">Balance</th></tr></thead><tbody>${charges || `<tr><td colspan="5">No fee charges recorded for this learner.</td></tr>`}</tbody></table><table style="margin-top:14px"><thead><tr><th>Receipt</th><th>Date</th><th>Method</th><th class="num">Amount</th></tr></thead><tbody>${payments || `<tr><td colspan="4">No payments recorded.</td></tr>`}</tbody></table></section>`;
    })
    .join("");
  const title = data.term ? `Fee statement — ${classLabel(data.class)} — ${data.term.name}` : `Fee statement — ${classLabel(data.class)} — all terms`;
  const body = `<div class="summary"><div><strong>Learners</strong><span>${data.totals.learners}</span></div><div><strong>Billed</strong><span>${formatMoney(data.totals.billed)}</span></div><div><strong>Collected</strong><span>${formatMoney(data.totals.paid)}</span></div><div><strong>Balance</strong><span>${formatMoney(data.totals.balance)}</span></div></div><p class="muted">${data.totals.cleared} cleared · ${data.totals.outstanding} with an outstanding balance. Statements cover ${data.term ? escapePrintable(data.term.name) : "all recorded terms"}.</p>${sections || `<p class="muted">No active learners in this class.</p>`}`;
  return printableDocument(title, data.school, body);
}

export default function ReportSheets({ role }: { role?: string }) {
  const canResults = Boolean(role && academicAccess.includes(role));
  const canFees = Boolean(role && financeAccess.includes(role));
  const options = trpc.school.reports.sheetOptions.useQuery(undefined, { enabled: canResults || canFees });
  const classes = options.data?.classes ?? [];
  const years = options.data?.academicYears ?? [];
  const terms = options.data?.terms ?? [];

  const activeYear = years.find(year => year.isActive) ?? years[0];
  const yearId = activeYear ? String(activeYear.id) : "";
  const yearTerms = terms.filter(term => String(term.academicYearId) === yearId);
  const defaultTerm = yearTerms.find(term => term.isActive) ?? yearTerms[0];
  const termId = defaultTerm ? String(defaultTerm.id) : "";
  const classId = classes[0] ? String(classes[0].id) : "";

  const [resultClass, setResultClass] = useStateOverride(classId);
  const [resultTerm, setResultTerm] = useStateOverride(termId);
  const [feeClass, setFeeClass] = useStateOverride(classId);
  const [feeTerm, setFeeTerm] = useStateOverride("all");

  const resultSheet = trpc.school.reports.classResultSheet.useQuery(
    { classId: Number(resultClass), academicYearId: Number(yearId), termId: Number(resultTerm) },
    { enabled: canResults && Boolean(resultClass && yearId && resultTerm) },
  );
  const feeSheet = trpc.school.reports.feeStatementSheet.useQuery(
    { classId: Number(feeClass), termId: feeTerm === "all" ? null : Number(feeTerm) },
    { enabled: canFees && Boolean(feeClass) },
  );
  const recordExport = trpc.school.reports.recordExport.useMutation({ onError: error => toast.error(error.message) });

  const printResults = () => {
    const data = resultSheet.data;
    if (!data) return toast.error("Choose a class and term before printing the result sheet.");
    if (!openPrintableDocument(`Class result sheet — ${classLabel(data.class)}`, resultSheetDocument(data))) {
      return toast.error("Allow pop-ups to print or save this result sheet as a PDF.");
    }
    recordExport.mutate({ reportType: "class_result_sheet", format: "pdf", filters: { classId: String(data.class.id), termId: resultTerm, academicYearId: yearId } });
    toast.success("Result sheet opened. Choose “Save to PDF” in the print dialog to keep a copy.");
  };

  const printStatements = () => {
    const data = feeSheet.data;
    if (!data) return toast.error("Choose a class before printing fee statements.");
    if (!openPrintableDocument(`Fee statement — ${classLabel(data.class)}`, feeStatementDocument(data))) {
      return toast.error("Allow pop-ups to print or save these statements as a PDF.");
    }
    recordExport.mutate({ reportType: "class_fee_statements", format: "pdf", filters: { classId: String(data.class.id), ...(feeTerm === "all" ? {} : { termId: feeTerm }) } });
    toast.success("Fee statements opened. Choose “Save to PDF” in the print dialog to keep a copy.");
  };

  if (!canResults && !canFees) {
    return <Card className="border-emerald-950/8 bg-white/85 dark:border-white/8 dark:bg-[#172420]"><CardContent className="p-5 text-sm text-slate-500 dark:text-slate-400">This workspace is available to teaching, finance, and leadership roles. Use the module workspaces on your dashboard to review records.</CardContent></Card>;
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {canResults ? (
        <Card className="border-emerald-950/8 bg-white/85 dark:border-white/8 dark:bg-[#172420]">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base text-[#143b31] dark:text-emerald-50">Class result sheet</CardTitle>
                <CardDescription>Every learner, every subject, ranked, with the class mean and grade distribution for one term.</CardDescription>
              </div>
              <FileText className="h-5 w-5 shrink-0 text-[#a8792c]" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Class</span>
                <Select value={resultClass || undefined} onValueChange={setResultClass}>
                  <SelectTrigger className="rounded-xl bg-white dark:bg-transparent"><SelectValue placeholder="Choose a class" /></SelectTrigger>
                  <SelectContent>{classes.map(item => <SelectItem key={item.id} value={String(item.id)}>{classLabel(item)} · {item.learners} learners</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Term</span>
                <Select value={resultTerm || undefined} onValueChange={setResultTerm}>
                  <SelectTrigger className="rounded-xl bg-white dark:bg-transparent"><SelectValue placeholder="Choose a term" /></SelectTrigger>
                  <SelectContent>{yearTerms.map(term => <SelectItem key={term.id} value={String(term.id)}>{term.name} · {activeYear?.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {resultSheet.isLoading ? (
              <Skeleton className="h-40 rounded-2xl" />
            ) : resultSheet.error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-950 dark:bg-rose-950/30 dark:text-rose-200">{resultSheet.error.message}</div>
            ) : resultSheet.data ? (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { label: "Learners", value: String(resultSheet.data.summary.learners) },
                    { label: "Graded", value: String(resultSheet.data.summary.graded) },
                    { label: "Class mean", value: resultSheet.data.summary.classMean === null ? "—" : `${resultSheet.data.summary.classMean}%` },
                    { label: "Top average", value: resultSheet.data.summary.highest ? `${resultSheet.data.summary.highest.average}%` : "—" },
                  ].map(item => (
                    <div key={item.label} className="rounded-xl bg-[#f2f7f4] p-3 dark:bg-white/5">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">{item.label}</p>
                      <p className="mt-1 text-lg font-semibold text-[#0d4437] dark:text-emerald-300">{item.value}</p>
                    </div>
                  ))}
                </div>
                <div className="max-h-72 overflow-auto rounded-2xl border border-emerald-950/8 dark:border-white/8">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="sticky top-0 bg-[#f2f7f4] text-[10px] uppercase tracking-[0.1em] text-slate-500 dark:bg-[#16221e] dark:text-slate-400">
                      <tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Learner</th><th className="px-3 py-2 text-right">Avg</th><th className="px-3 py-2 text-right">Grade</th></tr>
                    </thead>
                    <tbody>
                      {resultSheet.data.rows.map(row => (
                        <tr key={row.studentId} className="border-t border-emerald-950/6 dark:border-white/6">
                          <td className="px-3 py-2 text-slate-400">{row.position ?? "—"}</td>
                          <td className="px-3 py-2"><p className="font-medium text-[#133b30] dark:text-emerald-50">{row.fullName}</p><p className="text-xs text-slate-500 dark:text-slate-400">{row.admissionNo}</p></td>
                          <td className="px-3 py-2 text-right">{row.average === null ? "—" : `${row.average}%`}</td>
                          <td className="px-3 py-2 text-right">{row.overallGrade ? <Badge className="border-0 bg-[#fbf1d8] text-[#94651f] dark:bg-amber-950/50 dark:text-amber-300">{row.overallGrade}</Badge> : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!resultSheet.data.summary.graded ? <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">No term marks have been saved for this class yet. Enter marks from Academics → class sheet, then print the result sheet.</p> : null}
              </>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">Add a class and term in Academics to build result sheets.</p>
            )}
            <Button className="w-full rounded-xl bg-[#0d4437] text-white hover:bg-[#092f26]" disabled={!resultSheet.data || recordExport.isPending} onClick={printResults}>
              {recordExport.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}Print result sheet
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {canFees ? (
        <Card className="border-emerald-950/8 bg-white/85 dark:border-white/8 dark:bg-[#172420]">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base text-[#143b31] dark:text-emerald-50">Class fee statements</CardTitle>
                <CardDescription>Itemised statement per learner — charges, receipts and balance — ready to hand to a guardian.</CardDescription>
              </div>
              <FileSpreadsheet className="h-5 w-5 shrink-0 text-[#a8792c]" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Class</span>
                <Select value={feeClass || undefined} onValueChange={setFeeClass}>
                  <SelectTrigger className="rounded-xl bg-white dark:bg-transparent"><SelectValue placeholder="Choose a class" /></SelectTrigger>
                  <SelectContent>{classes.map(item => <SelectItem key={item.id} value={String(item.id)}>{classLabel(item)} · {item.learners} learners</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Period</span>
                <Select value={feeTerm} onValueChange={setFeeTerm}>
                  <SelectTrigger className="rounded-xl bg-white dark:bg-transparent"><SelectValue placeholder="All terms" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All terms</SelectItem>
                    {terms.map(term => <SelectItem key={term.id} value={String(term.id)}>{term.name} · {years.find(year => year.id === term.academicYearId)?.name ?? ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {feeSheet.isLoading ? (
              <Skeleton className="h-40 rounded-2xl" />
            ) : feeSheet.error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-950 dark:bg-rose-950/30 dark:text-rose-200">{feeSheet.error.message}</div>
            ) : feeSheet.data ? (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { label: "Billed", value: formatMoney(feeSheet.data.totals.billed) },
                    { label: "Collected", value: formatMoney(feeSheet.data.totals.paid) },
                    { label: "Balance", value: formatMoney(feeSheet.data.totals.balance) },
                    { label: "Outstanding", value: `${feeSheet.data.totals.outstanding} learners` },
                  ].map(item => (
                    <div key={item.label} className="rounded-xl bg-[#f2f7f4] p-3 dark:bg-white/5">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">{item.label}</p>
                      <p className="mt-1 text-sm font-semibold text-[#0d4437] dark:text-emerald-300">{item.value}</p>
                    </div>
                  ))}
                </div>
                <div className="max-h-72 overflow-auto rounded-2xl border border-emerald-950/8 dark:border-white/8">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="sticky top-0 bg-[#f2f7f4] text-[10px] uppercase tracking-[0.1em] text-slate-500 dark:bg-[#16221e] dark:text-slate-400">
                      <tr><th className="px-3 py-2">Learner</th><th className="px-3 py-2 text-right">Billed</th><th className="px-3 py-2 text-right">Paid</th><th className="px-3 py-2 text-right">Balance</th></tr>
                    </thead>
                    <tbody>
                      {feeSheet.data.rows.map(row => (
                        <tr key={row.studentId} className="border-t border-emerald-950/6 dark:border-white/6">
                          <td className="px-3 py-2"><p className="font-medium text-[#133b30] dark:text-emerald-50">{row.fullName}</p><p className="text-xs text-slate-500 dark:text-slate-400">{row.admissionNo}</p></td>
                          <td className="px-3 py-2 text-right">{formatMoney(row.billed)}</td>
                          <td className="px-3 py-2 text-right">{formatMoney(row.paid)}</td>
                          <td className={`px-3 py-2 text-right font-medium ${row.balance > 0 ? "text-rose-600 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300"}`}>{formatMoney(row.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!feeSheet.data.rows.length ? <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">No active learners are in this class yet.</p> : null}
              </>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">Add a class in Academics to build fee statements.</p>
            )}
            <Button className="w-full rounded-xl bg-[#0d4437] text-white hover:bg-[#092f26]" disabled={!feeSheet.data || recordExport.isPending} onClick={printStatements}>
              {recordExport.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}Print fee statements
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
