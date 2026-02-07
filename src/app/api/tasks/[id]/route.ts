import { NextRequest, NextResponse } from "next/server";
import { getTask } from "@/lib/tasks";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const task = getTask(id);

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: task.id,
    type: task.type,
    status: task.status,
    targetId: task.target_id,
    result: task.result,
    error: task.error,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
  });
}
