import { NextResponse } from "next/server";
import { upsertWeekly, updateMeetingTimer, getMeetingTimer, addSpeakerSpentSeconds } from "@/lib/store";
import type { TimerStartPayload, MeetingTimer } from "@/lib/types";

type Params = { params: { year: string; cw: string } };

export async function POST(req: Request, { params }: Params) {
  const year = parseInt(params.year, 10);
  const cw = parseInt(params.cw, 10);
  const weekly = upsertWeekly(year, cw);
  const body = (await req.json()) as TimerStartPayload;

  const current = getMeetingTimer(weekly.id);
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // If someone else is running and force is not set, reject
  if (
    current.state === "running" &&
    current.currentSpeakerUserId !== body.speakerUserId &&
    !body.force
  ) {
    return NextResponse.json(
      { error: "Timer running for another speaker. Use force=true to take over." },
      { status: 409 }
    );
  }

  const result = updateMeetingTimer(
    weekly.id,
    body.expectedVersion,
    (t): Omit<MeetingTimer, "version"> => {
      // If taking over from a running speaker, we stop their time (tick will have handled delta)
      return {
        weeklyId: t.weeklyId,
        currentSpeakerUserId: body.speakerUserId,
        state: "running",
        controlledByUserId: body.controlledByUserId,
        startedAt: new Date().toISOString(),
      };
    }
  );

  if (result === "CONFLICT") return NextResponse.json({ error: "Version conflict" }, { status: 409 });
  if (result === "NOT_FOUND") return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(result);
}
