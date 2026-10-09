import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Loader2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function ClassTeacherAssignmentEntry() {
  const config = trpc.school.academics.config.useQuery();
  const teachers = trpc.school.teachers.list.useQuery();
  const utils = trpc.useUtils();
  const [classId, setClassId] = useState("");
  const [teacherId, setTeacherId] = useState("unassigned");
  const classes = config.data?.classes ?? [];
  const activeTeachers = (teachers.data ?? []).filter(teacher => teacher.status === "active");
  const selectedClass = classes.find(item => String(item.id) === classId);
  const update = trpc.school.academics.updateClass.useMutation({
    onSuccess: () => {
      toast.success("Class teacher assignment saved.");
      utils.school.academics.config.invalidate();
      utils.school.dashboard.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  return <Card className="border-emerald-950/8 bg-white/85 dark:border-white/8 dark:bg-[#172420]">
    <CardHeader>
      <CardTitle className="text-base">Class teacher assignment</CardTitle>
      <CardDescription>Set or clear the lead teacher for a class. Class capacity stays under Academics.</CardDescription>
    </CardHeader>
    <CardContent className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <div>
        <p className="mb-2 text-sm font-medium">Class</p>
        <Select value={classId} onValueChange={value => {
          const item = classes.find(row => String(row.id) === value);
          setClassId(value);
          setTeacherId(item?.classTeacherId ? String(item.classTeacherId) : "unassigned");
        }}>
          <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select class" /></SelectTrigger>
          <SelectContent>{classes.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.form} · {item.stream}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Teacher</p>
        <Select value={teacherId} onValueChange={setTeacherId}>
          <SelectTrigger className="rounded-xl"><SelectValue placeholder="Assign a teacher" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {activeTeachers.map(teacher => <SelectItem key={teacher.id} value={String(teacher.id)}>{teacher.firstName} {teacher.lastName}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Button type="button" className="rounded-xl bg-[#0d4437] text-white hover:bg-[#092f26]" disabled={!selectedClass || update.isPending} onClick={() => {
        if (!selectedClass) return;
        update.mutate({
          classId: selectedClass.id,
          capacity: selectedClass.capacity,
          classTeacherId: teacherId === "unassigned" ? null : Number(teacherId),
        });
      }}>
        {update.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
        Save assignment
      </Button>
    </CardContent>
  </Card>;
}
