/** "Primary 2 A" + arm "A" -> "Primary 2 A" (no doubled arm); "JSS 1" + "B" -> "JSS 1 B". */
export function classDisplayName(cls?: { name?: string | null; arm?: string | null } | null): string {
  const name = (cls?.name ?? "").trim();
  const arm = (cls?.arm ?? "").trim();
  if (!arm) return name;
  if (!name) return arm;
  const lastWord = name.split(/\s+/).pop() ?? "";
  if (lastWord.toLowerCase() === arm.toLowerCase()) return name;
  return `${name} ${arm}`;
}
