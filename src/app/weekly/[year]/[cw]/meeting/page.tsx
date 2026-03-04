import { upsertWeekly } from "@/lib/store";
import { formatWeekLabel } from "@/lib/isoWeek";
import MeetingMode from "@/components/MeetingMode";

type Props = { params: { year: string; cw: string } };

export default function MeetingPage({ params }: Props) {
  const year = parseInt(params.year, 10);
  const cw = parseInt(params.cw, 10);
  const weekly = await upsertWeekly(year, cw);
  const label = formatWeekLabel(year, cw);

  return (
    <MeetingMode
      weeklyId={weekly.id}
      year={year}
      cw={cw}
      label={label}
    />
  );
}
