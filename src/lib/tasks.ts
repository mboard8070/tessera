import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";
import type { TaskRow } from "@/lib/types";

export function createTask(type: string, targetId: number): string {
  const db = getDb();
  const id = randomUUID();
  db.prepare(
    "INSERT INTO tasks (id, type, status, target_id) VALUES (?, ?, 'pending', ?)"
  ).run(id, type, targetId);
  return id;
}

export function updateTask(
  id: string,
  updates: { status?: string; result?: string; error?: string }
) {
  const db = getDb();
  const fields: string[] = ["updated_at = datetime('now')"];
  const values: unknown[] = [];

  if (updates.status) {
    fields.push("status = ?");
    values.push(updates.status);
  }
  if (updates.result !== undefined) {
    fields.push("result = ?");
    values.push(updates.result);
  }
  if (updates.error !== undefined) {
    fields.push("error = ?");
    values.push(updates.error);
  }

  values.push(id);
  db.prepare(`UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`).run(...values);
}

export function getTask(id: string): TaskRow | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as TaskRow | undefined;
}

// Fire-and-forget async task runner
export function runAsync(
  taskId: string,
  fn: () => Promise<string>
) {
  updateTask(taskId, { status: "running" });

  fn()
    .then((result) => {
      updateTask(taskId, { status: "completed", result });
    })
    .catch((err) => {
      updateTask(taskId, { status: "failed", error: String(err) });
    });
}
