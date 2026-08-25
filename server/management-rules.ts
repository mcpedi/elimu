export function assertRecordRemovable(recordLabel: string, dependencies: Record<string, boolean>) {
  const linked = Object.entries(dependencies).filter(([, isLinked]) => isLinked).map(([label]) => label);
  if (linked.length) throw new Error(`This ${recordLabel} is linked to ${linked.join(", ")}. Mark it inactive instead of removing it.`);
}

export function validateClassCapacity(capacity: number) {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 120) {
    throw new Error("Class capacity must be a whole number between 1 and 120.");
  }
}

export function validateNamedRecordUpdate(recordLabel: string, fields: Record<string, string>) {
  const emptyFields = Object.entries(fields).filter(([, value]) => !value.trim()).map(([field]) => field);
  if (emptyFields.length) throw new Error(`${recordLabel} requires: ${emptyFields.join(", ")}.`);
}

export function assertEligibleClassTeacher(isEligible: boolean) {
  if (!isEligible) throw new Error("Class teacher must be an active teacher in this school.");
}
