import { NextResponse } from "next/server";
import { listTasks, createTask } from "@/lib/store";
import type { CreateTaskPayload } from "@/lib/types";

export async function GET() {
  return NextResponse.json(listTasks());
}

export async function POST(req: Request) {
  const body = (await req.json()) as CreateTaskPayload;
  if (!body.title || !body.assignees?.length || !body.dueWeek || !body.createdFromWeek) {
    return NextResponse.json(
      { error: "title, assignees, dueWeek, createdFromWeek required" },
      { status: 400 }
    );
  }
  const task = createTask(body);
  return NextResponse.json(task, { status: 201 });
}
