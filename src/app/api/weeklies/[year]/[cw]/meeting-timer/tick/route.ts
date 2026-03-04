import { NextResponse } from "next/server";
import { upsertWeekly, updateMeetingTimer, addSpeakerSpentSeconds, getMeetingTimer } from "@/lib/store";
import type { TimerTickPayload, MeetingTimer } from "@/lib/types";

type Params = { params: { year: string; cw: string } };

export async function POST(req: Request, { params }: Params) {
  const year = parseInt(params.year, 10);
  const cw = parseInt(params.cw, 10);
  const weekly = upsertWeekly(year, cw);
  const body = (await req.json()) as TimerTickPayload;

  const current = getMeetingTimer(weekly.id);
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (current.state !== "running") {
    return NextResponse.json({ error: "Timer not running" }, { status: 400 });
  }

  const speakerId = current.currentSpeakerUserId;
  if (speakerId) {
    addSpeakerSpentSeconds(weekly.id, speakerId, body.deltaSeconds);
  }

  const result = updateMeetingTimer(
    weekly.id,
    body.expectedVersion,
    (t): Omit<MeetingTimer, "version"> => ({ ...t })
  );

  if (result === "CONFLICT") return NextResponse.json({ error: "Version conflict" }, { status: 409 });
  if (result === "NOT_FOUND") return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(result);
}
