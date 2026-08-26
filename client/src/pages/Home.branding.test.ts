import { describe, expect, it } from "vitest";
import { printableDocument, schoolLogoPreview } from "./Home";

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
});
