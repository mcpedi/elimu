import fs from "node:fs";

const path = "/home/ubuntu/kenyan-school-management/client/src/pages/Home.tsx";
let source = fs.readFileSync(path, "utf8");

function replaceInFunction(name, find, replacement) {
  const start = source.indexOf(`function ${name}`);
  if (start < 0) throw new Error(`${name} not found`);
  const nextFunction = source.indexOf("\nfunction ", start + 10);
  const end = nextFunction < 0 ? source.length : nextFunction;
  const body = source.slice(start, end);
  if (!body.includes(find)) throw new Error(`${name} target not found`);
  source = source.slice(0, start) + body.replace(find, replacement) + source.slice(end);
}

replaceInFunction("StudentsPanel", 'const canManage = ["super_admin", "principal", "deputy_principal"].includes(user?.role ?? "");', 'const canManage = workspaceWorkflowVisibility(user?.role).students;');
replaceInFunction("DepartmentEntry", 'const canManage = ["super_admin", "principal", "deputy_principal"].includes(user?.role ?? "");', 'const canManage = workspaceWorkflowVisibility(user?.role).manage;');
replaceInFunction("TeachersPanel", 'const canManage = ["super_admin", "principal", "deputy_principal"].includes(user?.role ?? "");', 'const canManage = workspaceWorkflowVisibility(user?.role).teachers;');
replaceInFunction("AcademicsPanel", 'const staff = ["super_admin", "principal", "deputy_principal", "teacher", "class_teacher"].includes(user?.role ?? "");', 'const staff = workspaceWorkflowVisibility(user?.role).academics;');
replaceInFunction("AttendancePanel", 'const staff = ["super_admin", "principal", "deputy_principal", "teacher", "class_teacher"].includes(user?.role ?? "");', 'const staff = workspaceWorkflowVisibility(user?.role).attendance;');
replaceInFunction("FeesPanel", 'const staff = ["super_admin", "principal", "bursar"].includes(user?.role ?? "");', 'const staff = workspaceWorkflowVisibility(user?.role).fees;');
replaceInFunction("AnnouncementsPanel", 'const canPublish = ["super_admin", "principal", "deputy_principal"].includes(user?.role ?? "");', 'const canPublish = workspaceWorkflowVisibility(user?.role).announcements;');
replaceInFunction("TimetablePanel", 'const isAdministrator = ["super_admin", "principal", "deputy_principal"].includes(user?.role ?? "");', 'const isAdministrator = workspaceWorkflowVisibility(user?.role).timetable;');
fs.writeFileSync(path, source);
console.log("Panel role gates now use workspaceWorkflowVisibility.");
