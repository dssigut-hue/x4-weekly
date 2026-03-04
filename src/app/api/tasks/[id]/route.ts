import { NextResponse } from "next/server";
import { patchTask } from "@/lib/store";
import type { PatchTaskPayload } from "@/lib/types";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = (await req.json()) as PatchTaskPayload;
  const updated = await patchTask(params.id, body);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}
