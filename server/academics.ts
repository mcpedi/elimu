import type { GradeBand } from "../drizzle/schema";

export const DEFAULT_KENYAN_GRADING_SCALE: GradeBand[] = [
  { min: 80, max: 100, grade: "A", points: 12, remark: "Excellent" },
  { min: 75, max: 79.99, grade: "A-", points: 11, remark: "Very good" },
  { min: 70, max: 74.99, grade: "B+", points: 10, remark: "Good" },
  { min: 65, max: 69.99, grade: "B", points: 9, remark: "Good" },
  { min: 60, max: 64.99, grade: "B-", points: 8, remark: "Credit" },
  { min: 55, max: 59.99, grade: "C+", points: 7, remark: "Credit" },
  { min: 50, max: 54.99, grade: "C", points: 6, remark: "Credit" },
  { min: 45, max: 49.99, grade: "C-", points: 5, remark: "Pass" },
  { min: 40, max: 44.99, grade: "D+", points: 4, remark: "Pass" },
  { min: 35, max: 39.99, grade: "D", points: 3, remark: "Below average" },
  { min: 30, max: 34.99, grade: "D-", points: 2, remark: "Below average" },
  { min: 0, max: 29.99, grade: "E", points: 1, remark: "Needs support" },
];

export function calculateGrade(score: number, maxMarks: number, scale = DEFAULT_KENYAN_GRADING_SCALE) {
  if (!Number.isFinite(score) || !Number.isFinite(maxMarks) || maxMarks <= 0) {
    throw new Error("Score and maximum marks must be valid positive values.");
  }
  const percentage = (score / maxMarks) * 100;
  const band = scale.find(item => percentage >= item.min && percentage <= item.max) ?? scale[scale.length - 1];
  return { percentage: Number(percentage.toFixed(2)), grade: band.grade, points: band.points, remark: band.remark };
}

export function summarizeMarks(markList: Array<{ score: number; maxMarks: number; points: number }>) {
  if (markList.length === 0) return { total: 0, average: 0, meanPoints: 0 };
  const total = markList.reduce((sum, mark) => sum + mark.score, 0);
  const percentageTotal = markList.reduce((sum, mark) => sum + (mark.score / mark.maxMarks) * 100, 0);
  const points = markList.reduce((sum, mark) => sum + mark.points, 0);
  return {
    total: Number(total.toFixed(2)),
    average: Number((percentageTotal / markList.length).toFixed(2)),
    meanPoints: Number((points / markList.length).toFixed(2)),
  };
}

export function summarizePerformanceEntries(markList: Array<{ score: number | string; maxMarks: number | string; points: number }>) {
  if (markList.length === 0) return { entries: 0, averagePercentage: 0, meanPoints: 0 };
  const normalized = markList.map(mark => ({ score: Number(mark.score), maxMarks: Number(mark.maxMarks), points: mark.points }));
  const summary = summarizeMarks(normalized);
  return { entries: normalized.length, averagePercentage: summary.average, meanPoints: summary.meanPoints };
}

export function buildTermPerformanceTrend<T extends { id: number; name: string }>(terms: T[], markList: Array<{ termId: number; score: number | string; maxMarks: number | string; points: number }>) {
  return terms.map(term => ({ termId: term.id, term: term.name, ...summarizePerformanceEntries(markList.filter(mark => mark.termId === term.id)) }));
}
