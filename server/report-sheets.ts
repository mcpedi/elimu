import type { GradeBand } from "../drizzle/schema";
import { calculateGrade, DEFAULT_KENYAN_GRADING_SCALE, summarizeMarks } from "./academics";

export type SubjectMark = {
  subjectId: number;
  subject: string;
  subjectCode: string;
  score: number;
  maxMarks: number;
  grade: string;
  gradePoints: number;
};

export type ResultSheetLearner = {
  studentId: number;
  firstName: string;
  lastName: string;
  admissionNo: string;
  results: SubjectMark[];
};

export type FeeCharge = {
  feeName: string;
  termId: number | null;
  due: number;
  paid: number;
  status: string;
  dueDate: string | null;
};

export type FeePayment = {
  receiptNo: string;
  amount: number;
  method: string;
  paymentDate: string;
};

export type FeeStatementLearner = {
  studentId: number;
  firstName: string;
  lastName: string;
  admissionNo: string;
  charges: FeeCharge[];
  payments: FeePayment[];
};

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function displayName(learner: { firstName: string; lastName: string }) {
  return `${learner.firstName} ${learner.lastName}`.trim();
}

/**
 * Builds a printable class result sheet: one row per learner with marks aligned to the
 * class subject columns, a competition rank (tied averages share a position), and the
 * class-level statistics a school prints above the table.
 */
export function buildClassResultSheet(learners: ResultSheetLearner[], scale: GradeBand[] = DEFAULT_KENYAN_GRADING_SCALE) {
  const subjectColumns = new Map<number, { id: number; name: string; code: string }>();
  for (const learner of learners) {
    for (const result of learner.results) {
      if (!subjectColumns.has(result.subjectId)) {
        subjectColumns.set(result.subjectId, { id: result.subjectId, name: result.subject, code: result.subjectCode });
      }
    }
  }
  const subjects = Array.from(subjectColumns.values()).sort((a, b) => a.name.localeCompare(b.name));

  const rows = learners.map(learner => {
    const marks = learner.results.map(result => ({ score: Number(result.score), maxMarks: Number(result.maxMarks), points: result.gradePoints }));
    const graded = marks.length > 0;
    const summary = summarizeMarks(marks);
    const bySubject = new Map(learner.results.map(result => [result.subjectId, result]));
    return {
      studentId: learner.studentId,
      firstName: learner.firstName,
      lastName: learner.lastName,
      fullName: displayName(learner),
      admissionNo: learner.admissionNo,
      subjectCount: marks.length,
      total: summary.total,
      average: graded ? summary.average : null,
      meanPoints: graded ? summary.meanPoints : null,
      overallGrade: graded ? calculateGrade(summary.average, 100, scale).grade : null,
      position: null as number | null,
      marks: subjects.map(subject => {
        const mark = bySubject.get(subject.id);
        return {
          subjectId: subject.id,
          score: mark ? Number(mark.score) : null,
          maxMarks: mark ? Number(mark.maxMarks) : null,
          grade: mark?.grade ?? null,
          gradePoints: mark?.gradePoints ?? null,
        };
      }),
    };
  });

  const gradedRows = rows
    .filter(row => row.average !== null)
    .sort((a, b) => (b.average as number) - (a.average as number) || a.fullName.localeCompare(b.fullName));
  let position = 0;
  let previousAverage: number | null = null;
  gradedRows.forEach((row, index) => {
    const average = row.average as number;
    if (previousAverage === null || Math.abs(average - previousAverage) > 0.004) position = index + 1;
    row.position = position;
    previousAverage = average;
  });

  const averages = gradedRows.map(row => row.average as number);
  const classMean = averages.length ? round(averages.reduce((sum, value) => sum + value, 0) / averages.length) : null;
  const gradeDistribution = scale
    .slice()
    .sort((a, b) => b.min - a.min)
    .map(band => ({ grade: band.grade, count: gradedRows.filter(row => row.overallGrade === band.grade).length }))
    .filter(item => item.count > 0);
  const subjectMeans = subjects.map(subject => {
    const percentages = learners
      .map(learner => learner.results.find(result => result.subjectId === subject.id))
      .filter((result): result is SubjectMark => Boolean(result))
      .map(result => (Number(result.score) / Number(result.maxMarks)) * 100)
      .filter(value => Number.isFinite(value));
    return {
      subjectId: subject.id,
      subject: subject.name,
      entries: percentages.length,
      mean: percentages.length ? round(percentages.reduce((sum, value) => sum + value, 0) / percentages.length) : null,
    };
  });

  return {
    subjects,
    rows,
    summary: {
      learners: rows.length,
      graded: gradedRows.length,
      classMean,
      highest: gradedRows.length ? { fullName: gradedRows[0].fullName, average: gradedRows[0].average as number } : null,
      lowest: gradedRows.length ? { fullName: gradedRows[gradedRows.length - 1].fullName, average: gradedRows[gradedRows.length - 1].average as number } : null,
      gradeDistribution,
      subjectMeans,
    },
  };
}

/**
 * Builds the class fee statement batch. A term filter is applied to the charges, so the
 * printed statement covers either the whole year or a single term.
 */
export function buildFeeStatementSheet(learners: FeeStatementLearner[], options: { termId?: number | null } = {}) {
  const termId = options.termId ?? null;
  const rows = learners.map(learner => {
    const charges = learner.charges.filter(charge => termId === null || charge.termId === termId);
    const billed = round(charges.reduce((sum, charge) => sum + charge.due, 0));
    const paid = round(charges.reduce((sum, charge) => sum + charge.paid, 0));
    const balance = round(billed - paid);
    const status: "cleared" | "partial" | "unpaid" | "no_charge" =
      charges.length === 0 ? "no_charge" : balance <= 0 ? "cleared" : paid > 0 ? "partial" : "unpaid";
    return {
      studentId: learner.studentId,
      firstName: learner.firstName,
      lastName: learner.lastName,
      fullName: displayName(learner),
      admissionNo: learner.admissionNo,
      charges: charges.slice().sort((a, b) => a.feeName.localeCompare(b.feeName)),
      payments: learner.payments
        .slice()
        .sort((a, b) => (a.paymentDate < b.paymentDate ? 1 : a.paymentDate > b.paymentDate ? -1 : 0)),
      billed,
      paid,
      balance,
      status,
    };
  });
  const totals = {
    learners: rows.length,
    billed: round(rows.reduce((sum, row) => sum + row.billed, 0)),
    paid: round(rows.reduce((sum, row) => sum + row.paid, 0)),
    balance: round(rows.reduce((sum, row) => sum + row.balance, 0)),
    cleared: rows.filter(row => row.status === "cleared").length,
    outstanding: rows.filter(row => row.balance > 0).length,
  };
  return { rows, totals };
}
