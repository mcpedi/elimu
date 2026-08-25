export type TimetableWindow = {
  teacherId: number;
  classId: number;
  room: string;
  startsAt: string;
  endsAt: string;
};

export function hasTimetableConflict(candidate: TimetableWindow, existing: TimetableWindow) {
  const overlaps = candidate.startsAt < existing.endsAt && candidate.endsAt > existing.startsAt;
  if (!overlaps) return false;
  return candidate.teacherId === existing.teacherId
    || candidate.classId === existing.classId
    || candidate.room.trim().toLowerCase() === existing.room.trim().toLowerCase();
}
