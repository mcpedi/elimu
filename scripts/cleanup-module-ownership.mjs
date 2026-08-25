import fs from "node:fs";

const path = "/home/ubuntu/kenyan-school-management/client/src/pages/Home.tsx";
let source = fs.readFileSync(path, "utf8");

const replace = (pattern, replacement, label) => {
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`${label} boundary not found`);
  source = next;
};

replace(/(function AcademicsPanel\(\) \{[\s\S]*?return <><SectionHeading[\s\S]*?<\/SectionHeading>)(<div className="grid gap-5 xl:grid-cols-2">)/, "$1<AcademicWorkflowEntry />$2<DepartmentEntry />", "Academics workflow insertion");
replace(/academics: <><AcademicsPanel \/><DepartmentEntry \/><\/>,/, "academics: <AcademicsPanel /> ,", "Academics content map cleanup");

const cleanAnnouncements = `function AnnouncementsPanel() {
  const { user } = useAuth();
  const canPublish = ["super_admin", "principal", "deputy_principal"].includes(user?.role ?? "");
  const feed = trpc.school.communication.announcements.useQuery();
  return <><SectionHeading eyebrow="School communication" title="Announcements & notices" description="Publish targeted notices for the whole school, a class, form, parents, students, or staff." />{canPublish ? <AnnouncementTargetingEntry /> : null}<div className="grid gap-4 md:grid-cols-2">{feed.data?.length ? feed.data.map(item => <Card key={item.id} className="border-emerald-950/8 bg-white/85 transition-shadow hover:shadow-[0_14px_36px_-26px_rgba(10,65,48,0.28)] dark:border-white/8 dark:bg-[#172420]"><CardContent className="p-5"><div className="flex items-start justify-between gap-4"><div className="grid h-9 w-9 place-items-center rounded-xl bg-[#e8f1ec] text-[#0d4437] dark:bg-emerald-950/60 dark:text-emerald-300"><Megaphone className="h-4 w-4" /></div><StatusPill value={item.targetScope} /></div><h3 className="mt-5 font-semibold text-[#143b31] dark:text-emerald-50">{item.title}</h3><p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.body}</p><p className="mt-4 text-[11px] font-medium text-slate-400">Published {formatDate(item.publishedAt)}</p></CardContent></Card>) : <div className="md:col-span-2"><EmptyText label="No announcements have been published for your role yet." /></div>}</div></>;
}
`;
replace(/function AnnouncementsPanel\(\) \{[\s\S]*?\n\}\n\nfunction ReportsPanel/, `${cleanAnnouncements}\nfunction ReportsPanel`, "Announcements panel cleanup");

replace('  const config = trpc.school.academics.config.useQuery(); const teachers = trpc.school.teachers.list.useQuery(); const accounts = trpc.school.finance.mine.useQuery(); const utils = trpc.useUtils();', '  const config = trpc.school.academics.config.useQuery(); const teachers = trpc.school.teachers.list.useQuery(); const utils = trpc.useUtils();');
replace(' const [subjectForm, setSubjectForm] = useState({ id: "", code: "", name: "", category: "compulsory" as "compulsory" | "optional", isActive: true }); const [teacherForm, setTeacherForm] = useState({ id: "", employeeNo: "", firstName: "", lastName: "", phone: "", email: "", employmentStatus: "active" as "active" | "on_leave" | "inactive" }); const [classForm, setClassForm] = useState({ id: "", capacity: "45", classTeacherId: "" }); const [feeForm, setFeeForm] = useState({ accountId: "", amountDue: "", reason: "" });', ' const [subjectForm, setSubjectForm] = useState({ id: "", code: "", name: "", category: "compulsory" as "compulsory" | "optional", isActive: true }); const [teacherForm, setTeacherForm] = useState({ id: "", employeeNo: "", firstName: "", lastName: "", phone: "", email: "", employmentStatus: "active" as "active" | "on_leave" | "inactive" }); const [classForm, setClassForm] = useState({ id: "", capacity: "45", classTeacherId: "" });');
replace('  const refresh = () => { utils.school.academics.config.invalidate(); utils.school.teachers.list.invalidate(); utils.school.finance.mine.invalidate(); utils.school.dashboard.invalidate(); };', '  const refresh = () => { utils.school.academics.config.invalidate(); utils.school.teachers.list.invalidate(); utils.school.dashboard.invalidate(); };');
replace(/; const adjustAccount = trpc\.school\.finance\.adjustAccount\.useMutation\(\{[\s\S]*?\}\);\n  const subjectRows/, ';\n  const subjectRows', "stale finance mutation cleanup");
replace(' const subjectRows = config.data?.subjects ?? []; const classRows = config.data?.classes ?? []; const teacherRows = teachers.data ?? []; const accountRows = accounts.data ?? [];', ' const subjectRows = config.data?.subjects ?? []; const classRows = config.data?.classes ?? []; const teacherRows = teachers.data ?? [];');

fs.writeFileSync(path, source);
console.log("Academics, announcements, and record-maintenance ownership cleaned up.");
