import { BRAND_LOGO_URL } from "@/const";

export type PrintableSchool = {
  name: string;
  code: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  logoUrl?: string | null;
};

export function escapePrintable(value: unknown) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export function printableDocument(title: string, school: PrintableSchool, body: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapePrintable(title)}</title><style>body{font-family:Arial,sans-serif;color:#16382f;margin:0;padding:36px;background:#f3f6f4}main{max-width:860px;margin:auto;background:#fff;padding:42px;box-shadow:0 8px 30px rgba(13,68,55,.12)}header{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #e4bd69;padding-bottom:22px;margin-bottom:28px}.brand{display:flex;align-items:center;gap:14px}.brand img{width:58px;height:58px;object-fit:contain}h1{font-size:26px;margin:0 0 6px}h2{font-size:18px;margin:26px 0 10px}.muted{color:#64756d;font-size:12px;line-height:1.6}.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:18px 0 26px}.meta div{background:#f3f6f4;padding:10px 12px}.meta strong{display:block;font-size:11px;color:#64756d;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;border-bottom:1px solid #dfe8e2;padding:10px 8px}th{font-size:11px;text-transform:uppercase;color:#64756d}td.num,th.num{text-align:right}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:18px 0 26px}.summary div{background:#e8f1ec;padding:12px}.summary strong{display:block;font-size:11px;color:#64756d;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px}.summary span{font-size:18px;font-weight:700}.comment{margin-top:24px;padding:14px;background:#f3f6f4;line-height:1.6;font-size:13px}.learner{margin:0 0 26px;padding:0 0 20px;border-bottom:1px solid #dfe8e2}.learner:last-child{border-bottom:0}.learner h2{margin-top:0}.learner-head{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}.tag{display:inline-block;padding:3px 9px;border-radius:999px;background:#fbf1d8;color:#94651f;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em}.tag.cleared{background:#e4f3e9;color:#14663c}.tag.unpaid{background:#fde8e8;color:#a12a2a}@media print{body{background:#fff;padding:0}main{box-shadow:none;max-width:none;padding:0}.learner{break-inside:avoid;page-break-inside:avoid}}@media(max-width:640px){body{padding:12px}main{padding:20px}header{display:block}.summary{grid-template-columns:1fr 1fr}table{font-size:11px}th,td{padding:7px 4px}}</style></head><body><main><header><div class="brand"><img src="${escapePrintable(school.logoUrl || BRAND_LOGO_URL)}" alt="School logo"><div><h1>${escapePrintable(school.name)}</h1><p class="muted">${escapePrintable(school.code)} · ${escapePrintable(school.address)}<br>${escapePrintable(school.phone)} · ${escapePrintable(school.email)}</p></div></div><div><h1>${escapePrintable(title)}</h1><p class="muted">Generated ${escapePrintable(new Date().toLocaleString("en-KE"))}</p></div></header>${body}</main></body></html>`;
}

export function openPrintableDocument(title: string, html: string) {
  const popup = window.open("", "_blank", "width=980,height=900");
  if (!popup) return false;
  popup.document.write(html);
  popup.document.close();
  popup.document.title = title;
  popup.focus();
  popup.print();
  return true;
}
