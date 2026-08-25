import fs from "node:fs";

const homePath = "/home/ubuntu/kenyan-school-management/client/src/pages/Home.tsx";
let home = fs.readFileSync(homePath, "utf8");
const moduleImport = 'import { AcademicWorkflowEntry, AnnouncementTargetingEntry, AttendanceExceptionEntry, DailyTasksSummary, FeesCollectionReport, InsightsReportEntry, StudentLifecycleEntry, StudentSubjectEntry, TeacherWorkflowEntry, TimetableEntry } from "./ModuleWorkflows";\n';
if (!home.includes('from "./ModuleWorkflows"')) home = home.replace('import { trpc } from "@/lib/trpc";\n', 'import { trpc } from "@/lib/trpc";\n' + moduleImport);

const replaceOnce = (pattern, replacement, label) => {
  const next = home.replace(pattern, replacement);
  if (next === home) throw new Error(`${label} boundary not found`);
  home = next;
};

replaceOnce(/(function StudentsPanel\(\) \{[\s\S]*?return <><SectionHeading[\s\S]*?<\/SectionHeading>)(<Card)/, "$1<StudentLifecycleEntry />$2", "Students module");
replaceOnce(/(function TeachersPanel\(\) \{[\s\S]*?return <><SectionHeading[\s\S]*?\/>)(\{canManage \?)/, "$1{canManage ? <TeacherWorkflowEntry /> : null}$2", "Teachers module");
replaceOnce(/(function AcademicsPanel\(\) \{[\s\S]*?return <><SectionHeading[\s\S]*?\/>)(<div className=\"grid gap-5 xl:grid-cols-2\">)/, "$1<AcademicWorkflowEntry />$2", "Academics module");
replaceOnce(/(function AttendancePanel\(\) \{[\s\S]*?return <><SectionHeading[\s\S]*?\/>)(<Card)/, "$1<AttendanceExceptionEntry />$2", "Attendance module");
replaceOnce(/(function FeesPanel\(\) \{[\s\S]*?title=\"Fees · one workspace\"[\s\S]*?<\/SectionHeading>)(<div className=\"mb-6 grid gap-5 xl:grid-cols-2\">)/, "$1<FeesCollectionReport />$2", "Fees module");
replaceOnce(/(function TimetablePanel\(\) \{[\s\S]*?title=\"Timetable\"[\s\S]*?\/>)(<Card)/, "$1{isAdministrator ? <TimetableEntry /> : null}$2", "Timetable module");
replaceOnce(/(function AnnouncementsPanel\(\) \{[\s\S]*?<\/SectionHeading>)(<div className=\"grid gap-4 md:grid-cols-2\">)/, "$1{canPublish ? <AnnouncementTargetingEntry /> : null}$2", "Announcements module");

const dailyTasks = `function OperationsPanel() {\n  return <><SectionHeading eyebrow="Daily tasks" title="Daily tasks" description="Actions now open in the module that owns the record, so the workflow, permissions, and audit history stay together." /><DailyTasksSummary /></>;\n}\n`;
const nextDaily = home.replace(/function OperationsPanel\(\) \{[\s\S]*?\n\}\n\nfunction WorkflowCard/, `${dailyTasks}\nfunction WorkflowCard`);
if (nextDaily === home) throw new Error("Daily tasks panel boundary not found");
home = nextDaily;

const insights = `function AdvancedControlPanel() {\n  return <><SectionHeading eyebrow="Insights & alerts" title="Insights & alerts" description="Review cross-module trends and exception signals. Record-changing actions remain in their primary workspaces." /><InsightsReportEntry /></>;\n}\n`;
const nextInsights = home.replace(/function AdvancedControlPanel\(\) \{[\s\S]*?\n\}\nfunction ManagementPanel/, `${insights}\nfunction ManagementPanel`);
if (nextInsights === home) throw new Error("Insights panel boundary not found");
home = nextInsights;

home = home.replace('title="Manage school records"', 'title="Record maintenance"');
fs.writeFileSync(homePath, home);

const modulePath = "/home/ubuntu/kenyan-school-management/client/src/pages/ModuleWorkflows.tsx";
let modules = fs.readFileSync(modulePath, "utf8");
const insightReplacement = `export function InsightsReportEntry() {\n  const config = trpc.school.academics.config.useQuery();\n  const [classId, setClassId] = useState("");\n  const performance = trpc.school.academics.performance.useQuery({ classId: Number(classId || 0) }, { enabled: Boolean(classId) });\n  const attendance = trpc.school.attendance.classSummary.useQuery({ classId: Number(classId || 0) }, { enabled: Boolean(classId) });\n  const classes = config.data?.classes ?? [];\n  return <WorkflowCard title="Class performance & attendance flags" copy="Review normalized subject performance, attendance rates, and repeated-absence signals. Fees, attendance capture, and academic entry remain in their primary workspaces."><ClassSelect classes={classes} value={classId} onChange={setClassId} />{classId && performance.data?.length ? <div className="mt-4 grid gap-2 sm:grid-cols-2">{performance.data.map(item => <div key={item.subjectId} className="rounded-xl bg-[#f4f7f5] p-3 dark:bg-white/5"><p className="text-sm font-semibold">{item.subject}</p><p className="mt-1 text-lg font-semibold text-[#0d4437] dark:text-emerald-300">{item.average}%</p><p className="text-xs text-slate-500">{item.learnersMarked} entries · mean points {item.meanPoints}</p></div>)}</div> : <p className="mt-4 rounded-xl border border-dashed border-emerald-950/12 p-4 text-sm text-slate-500 dark:border-white/12 dark:text-slate-400">Select a class and enter marks to view subject performance.</p>}{classId && attendance.data ? <div className="mt-3 grid gap-2 sm:grid-cols-3"><Metric label="Attendance rate" value={attendance.data.rate + "%"} /><Metric label="Absences" value={String(attendance.data.absences)} /><Metric label="Repeated flags" value={String(attendance.data.repeatedAbsenceStudentIds.length)} /></div> : null}</WorkflowCard>;
}\n`;
const nextModules = modules.replace(/export function InsightsReportEntry\(\) \{[\s\S]*?\n\}\n\nfunction Metric/, `${insightReplacement}\nfunction Metric`);
if (nextModules === modules) throw new Error("Insights report boundary not found");
fs.writeFileSync(modulePath, nextModules);
console.log("Primary modules now own their workflows; daily tasks and insights are summary-only.");
