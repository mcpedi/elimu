export type AttendanceEntry = { studentId: number; status: "present" | "absent" | "late" };

export function summarizeAttendance(entries: AttendanceEntry[]) {
  const present = entries.filter(entry => entry.status === "present" || entry.status === "late").length;
  const absences = entries.filter(entry => entry.status === "absent").length;
  const absentCounts = entries.filter(entry => entry.status === "absent").reduce<Record<number, number>>((counts, entry) => ({ ...counts, [entry.studentId]: (counts[entry.studentId] ?? 0) + 1 }), {});
  return {
    rate: entries.length ? Number(((present / entries.length) * 100).toFixed(2)) : 0,
    absences,
    repeatedAbsenceStudentIds: Object.entries(absentCounts).filter(([, count]) => count >= 3).map(([studentId]) => Number(studentId)),
  };
}
