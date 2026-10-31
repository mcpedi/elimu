import { describe, expect, it } from "vitest";
import { buildClassResultSheet, buildFeeStatementSheet } from "./report-sheets";

const mark = (subjectId: number, subject: string, subjectCode: string, score: number, grade: string, gradePoints: number) => ({ subjectId, subject, subjectCode, score, maxMarks: 100, grade, gradePoints });

describe("class result sheet", () => {
  const learners = [
    { studentId: 11, firstName: "Amina", lastName: "Otieno", admissionNo: "ADM-0042", results: [mark(51, "Mathematics", "MAT", 82, "A", 12), mark(52, "English", "ENG", 76, "A-", 11)] },
    { studentId: 12, firstName: "Brian", lastName: "Kamau", admissionNo: "ADM-0043", results: [mark(51, "Mathematics", "MAT", 80, "A", 12), mark(52, "English", "ENG", 64, "B-", 8)] },
    { studentId: 13, firstName: "Cynthia", lastName: "Wanjiru", admissionNo: "ADM-0044", results: [mark(51, "Mathematics", "MAT", 82, "A", 12), mark(52, "English", "ENG", 76, "A-", 11)] },
    { studentId: 14, firstName: "Dennis", lastName: "Mwangi", admissionNo: "ADM-0045", results: [] },
  ];

  it("ranks learners by average and shares a position on ties", () => {
    const sheet = buildClassResultSheet(learners);
    expect(sheet.rows.map(row => [row.fullName, row.average, row.position])).toEqual([
      ["Amina Otieno", 79, 1],
      ["Brian Kamau", 72, 3],
      ["Cynthia Wanjiru", 79, 1],
      ["Dennis Mwangi", null, null],
    ]);
    expect(sheet.summary).toMatchObject({ learners: 4, graded: 3, classMean: 76.67 });
    expect(sheet.summary.highest).toEqual({ fullName: "Amina Otieno", average: 79 });
    expect(sheet.summary.lowest).toEqual({ fullName: "Brian Kamau", average: 72 });
  });

  it("aligns marks to the class subject columns and leaves gaps empty", () => {
    const sheet = buildClassResultSheet(learners);
    expect(sheet.subjects.map(subject => subject.code)).toEqual(["ENG", "MAT"]);
    const amina = sheet.rows.find(row => row.studentId === 11)!;
    expect(amina.marks).toEqual([
      { subjectId: 52, score: 76, maxMarks: 100, grade: "A-", gradePoints: 11 },
      { subjectId: 51, score: 82, maxMarks: 100, grade: "A", gradePoints: 12 },
    ]);
    expect(sheet.rows.find(row => row.studentId === 14)!.marks).toEqual([
      { subjectId: 52, score: null, maxMarks: null, grade: null, gradePoints: null },
      { subjectId: 51, score: null, maxMarks: null, grade: null, gradePoints: null },
    ]);
    expect(amina.overallGrade).toBe("A-");
  });

  it("summarises subject means and grade distribution without counting ungraded learners", () => {
    const sheet = buildClassResultSheet(learners);
    expect(sheet.summary.subjectMeans).toEqual([
      { subjectId: 52, subject: "English", entries: 3, mean: 72 },
      { subjectId: 51, subject: "Mathematics", entries: 3, mean: 81.33 },
    ]);
    expect(sheet.summary.gradeDistribution).toEqual([
      { grade: "A-", count: 2 },
      { grade: "B+", count: 1 },
    ]);
  });

  it("handles an empty class without throwing", () => {
    const sheet = buildClassResultSheet([]);
    expect(sheet.rows).toEqual([]);
    expect(sheet.subjects).toEqual([]);
    expect(sheet.summary).toMatchObject({ learners: 0, graded: 0, classMean: null, highest: null, lowest: null });
  });
});

describe("class fee statement sheet", () => {
  const learners = [
    {
      studentId: 11,
      firstName: "Amina",
      lastName: "Otieno",
      admissionNo: "ADM-0042",
      charges: [
        { feeName: "Tuition", termId: 31, due: 20000, paid: 20000, status: "paid", dueDate: "2026-02-05" },
        { feeName: "Transport", termId: 32, due: 5000, paid: 2000, status: "partial", dueDate: null },
      ],
      payments: [{ receiptNo: "RCPT-1", amount: 20000, method: "mpesa", paymentDate: "2026-02-01" }],
    },
    {
      studentId: 12,
      firstName: "Brian",
      lastName: "Kamau",
      admissionNo: "ADM-0043",
      charges: [{ feeName: "Tuition", termId: 31, due: 22000, paid: 0, status: "unpaid", dueDate: "2026-02-05" }],
      payments: [],
    },
    { studentId: 13, firstName: "Cynthia", lastName: "Wanjiru", admissionNo: "ADM-0044", charges: [], payments: [] },
  ];

  it("totals charges, receipts, and outstanding learners across all terms", () => {
    const sheet = buildFeeStatementSheet(learners);
    expect(sheet.totals).toEqual({ learners: 3, billed: 47000, paid: 22000, balance: 25000, cleared: 0, outstanding: 2 });
    expect(sheet.rows.map(row => row.status)).toEqual(["partial", "unpaid", "no_charge"]);
    expect(sheet.rows[1]).toMatchObject({ billed: 22000, paid: 0, balance: 22000 });
  });

  it("limits a term statement to that term's charges", () => {
    const sheet = buildFeeStatementSheet(learners, { termId: 31 });
    expect(sheet.rows[0]).toMatchObject({ billed: 20000, paid: 20000, balance: 0, status: "cleared" });
    expect(sheet.rows[0].charges.map(charge => charge.feeName)).toEqual(["Tuition"]);
    expect(sheet.totals).toEqual({ learners: 3, billed: 42000, paid: 20000, balance: 22000, cleared: 1, outstanding: 1 });
  });

  it("marks a partly settled learner as partial", () => {
    const sheet = buildFeeStatementSheet(learners, { termId: 32 });
    expect(sheet.rows[0]).toMatchObject({ billed: 5000, paid: 2000, balance: 3000, status: "partial" });
    expect(sheet.rows[1].status).toBe("no_charge");
  });

  it("sorts payments newest first so statements read chronologically", () => {
    const sheet = buildFeeStatementSheet([
      {
        studentId: 11,
        firstName: "Amina",
        lastName: "Otieno",
        admissionNo: "ADM-0042",
        charges: [],
        payments: [
          { receiptNo: "RCPT-OLD", amount: 1000, method: "cash", paymentDate: "2026-01-05" },
          { receiptNo: "RCPT-NEW", amount: 2000, method: "bank", paymentDate: "2026-03-05" },
        ],
      },
    ]);
    expect(sheet.rows[0].payments.map(payment => payment.receiptNo)).toEqual(["RCPT-NEW", "RCPT-OLD"]);
  });
});
