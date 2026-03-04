import { NextResponse } from "next/server";
import { patchPoint } from "@/lib/store";
import type { PatchPointPayload } from "@/lib/types";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = (await req.json()) as PatchPointPayload;
  const updated = await patchPoint(params.id, body);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}
