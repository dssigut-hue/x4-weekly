import { NextResponse } from "next/server";
import { upsertWeekly, getMeetingTimer, getSpeakerTimers } from "@/lib/store";

type Params = { params: { year: string; cw: string } };

export async function GET(_req: Request, { params }: Params) {
  const year = parseInt(params.year, 10);
  const cw = parseInt(params.cw, 10);
  const weekly = upsertWeekly(year, cw);
  const timer = getMeetingTimer(weekly.id);
  const speakers = getSpeakerTimers(weekly.id);
  return NextResponse.json({ timer, speakers });
}
