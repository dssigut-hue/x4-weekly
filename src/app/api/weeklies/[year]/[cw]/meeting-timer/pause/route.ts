import { NextResponse } from "next/server";
import { upsertWeekly, updateMeetingTimer } from "@/lib/store";
import type { TimerPausePayload, MeetingTimer } from "@/lib/types";

type Params = { params: { year: string; cw: string } };

export async function POST(req: Request, { params }: Params) {
  const year = parseInt(params.year, 10);
  const cw = parseInt(params.cw, 10);
  const weekly = upsertWeekly(year, cw);
  const body = (await req.json()) as TimerPausePayload;

  const result = updateMeetingTimer(
    weekly.id,
    body.expectedVersion,
    (t): Omit<MeetingTimer, "version"> => ({
      weeklyId: t.weeklyId,
      currentSpeakerUserId: t.currentSpeakerUserId,
      state: "paused",
      controlledByUserId: body.controlledByUserId,
      startedAt: t.startedAt,
    })
  );

  if (result === "CONFLICT") return NextResponse.json({ error: "Version conflict" }, { status: 409 });
  if (result === "NOT_FOUND") return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(result);
}
