import { NextResponse } from "next/server";
import { listWeeklies, upsertWeekly } from "@/lib/store";
import type { CreateWeeklyPayload } from "@/lib/types";

export async function GET() {
  return NextResponse.json(await listWeeklies());
}

export async function POST(req: Request) {
  const body = (await req.json()) as CreateWeeklyPayload;
  if (!body.year || !body.cw) {
    return NextResponse.json({ error: "year and cw required" }, { status: 400 });
  }
  const weekly = await upsertWeekly(body.year, body.cw);
  return NextResponse.json(weekly, { status: 201 });
}
