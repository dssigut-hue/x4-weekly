import { NextResponse } from "next/server";
import { upsertWeekly, listPoints, createPoint } from "@/lib/store";
import { formatWeekKey } from "@/lib/isoWeek";
import type { CreatePointPayload } from "@/lib/types";

type Params = { params: { year: string; cw: string } };

export async function GET(_req: Request, { params }: Params) {
  const year = parseInt(params.year, 10);
  const cw = parseInt(params.cw, 10);
  const weekly = await upsertWeekly(year, cw);
  return NextResponse.json(await listPoints(weekly.id));
}

export async function POST(req: Request, { params }: Params) {
  const year = parseInt(params.year, 10);
  const cw = parseInt(params.cw, 10);
  const weekly = await upsertWeekly(year, cw);
  const body = (await req.json()) as CreatePointPayload;
  if (!body.authorUserId || !body.text) {
    return NextResponse.json({ error: "authorUserId and text required" }, { status: 400 });
  }
  const point = await createPoint(weekly.id, { ...body, area: body.area ?? "General" });
  return NextResponse.json(point, { status: 201 });
}
