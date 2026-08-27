import { describe, expect, it } from "vitest";
import { learnerSummaryPrintable, printableDocument, schoolLogoPreview } from "./Home";

describe("school branding", () => {
  it("accepts the registered Elimubora360 logo asset for app branding", () => {
    expect(schoolLogoPreview({ name: "Elimubora360", logoUrl: "/manus-storage/elimubora360-mark_cd600d23.png" })).toEqual({
      src: "/manus-storage/elimubora360-mark_cd600d23.png",
      alt: "Elimubora360 logo",
    });
  });
  it("returns an accessible preview for a saved school logo", () => {
    expect(schoolLogoPreview({ name: "Onyalo Secondary School", logoUrl: "/manus-storage/schools/1/branding/logo.png" })).toEqual({
      src: "/manus-storage/schools/1/branding/logo.png",
      alt: "Onyalo Secondary School logo",
    });
    expect(schoolLogoPreview({ name: "Onyalo Secondary School", logoUrl: null })).toEqual({
      src: "/manus-storage/elimubora360-mark_cd600d23.png",
      alt: "Onyalo Secondary School logo",
    });
  });

  it("includes the saved logo in printable statement and receipt headers", () => {
    const html = printableDocument(
      "Account statement",
      { name: "Onyalo Secondary School", code: "ONY", logoUrl: "/manus-storage/schools/1/branding/logo.png" },
      "<p>Outstanding balance</p>",
    );
    expect(html).toContain('<img src="/manus-storage/schools/1/branding/logo.png" alt="School logo">');
    expect(html).toContain(".brand img");
    expect(html).toContain("Outstanding balance");
  });

  it("creates a branded learner summary with only the selected learner’s authorised records", () => {
    const html = learnerSummaryPrintable({
      student: { firstName: "Akinyi", lastName: "Otieno", admissionNo: "ONY-001", form: "Form 2", stream: "East", status: "active" },
      guardians: [{ firstName: "Mary", lastName: "Otieno", relationship: "Mother", phone: "+254700000001" }],
      subjects: [{ code: "MAT", name: "Mathematics" }],
      attendance: [{ status: "present" }, { status: "absent" }],
      feeAccounts: [{ name: "Tuition", amountDue: "12000", amountPaid: "5000", status: "partial" }],
      marks: [{ subject: "Mathematics", assessment: "Term 2 Exam", score: "76", grade: "B+" }],
    }, { name: "Onyalo Secondary School", logoUrl: "/manus-storage/schools/1/branding/logo.png" });
    expect(html).toContain("Learner summary");
    expect(html).toContain("Akinyi Otieno");
    expect(html).toContain("ONY-001");
    expect(html).toContain("Term 2 Exam");
    expect(html).toContain("Outstanding fee balance");
    expect(html).toContain("schools/1/branding/logo.png");
  });
});
