import { redirect } from "next/navigation";
import { getCurrentISOWeek } from "@/lib/isoWeek";

export default function WeeklyIndex() {
  const { year, cw } = getCurrentISOWeek();
  redirect(`/weekly/${year}/${cw}`);
}
