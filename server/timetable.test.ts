import { describe, expect, it } from "vitest";
import { hasTimetableConflict } from "./timetable";

const existing = { teacherId: 4, classId: 9, room: "Lab 1", startsAt: "08:00", endsAt: "08:40" };

describe("timetable conflict validation", () => {
  it("detects an overlapping allocation for the same teacher", () => {
    expect(hasTimetableConflict({ ...existing, classId: 10, room: "Room 8", startsAt: "08:15", endsAt: "08:55" }, existing)).toBe(true);
  });

  it("detects a room clash irrespective of room-name case", () => {
    expect(hasTimetableConflict({ teacherId: 5, classId: 10, room: "lab 1", startsAt: "08:15", endsAt: "08:55" }, existing)).toBe(true);
  });

  it("allows non-overlapping periods for different resources", () => {
    expect(hasTimetableConflict({ teacherId: 5, classId: 10, room: "Room 8", startsAt: "08:40", endsAt: "09:20" }, existing)).toBe(false);
  });
});
