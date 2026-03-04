"use client";

import { useState } from "react";
import type { Weekly, Task } from "@/lib/types";
import { TEAM } from "@/lib/team";
import { isOverdue, formatWeekKey } from "@/lib/isoWeek";

interface Props {
  weekly: Weekly;
  tasks: Task[];
  currentWeekKey: string;
  onUpdate: () => void;
}

export default function TasksPanel({ weekly, tasks, currentWeekKey, onUpdate }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<"all" | "open" | "done" | "blocked">("all");

  const filtered = filter === "all" ? tasks : tasks.filter((t) => t.status === filter);
  const grouped = {
    open: filtered.filter((t) => t.status === "open"),
    blocked: filtered.filter((t) => t.status === "blocked"),
    done: filtered.filter((t) => t.status === "done"),
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          {(["all", "open", "blocked", "done"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className="font-mono text-xs px-3 py-1 rounded capitalize transition-all"
              style={{
                background: filter === s ? "var(--ink)" : "transparent",
                color: filter === s ? "var(--paper)" : "var(--muted)",
                border: `1px solid ${filter === s ? "var(--ink)" : "var(--border)"}`,
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="font-mono text-sm px-4 py-1.5 rounded transition-all"
          style={{ background: "var(--ink)", color: "var(--paper)" }}
        >
          + New Task
        </button>
      </div>

      {showForm && (
        <TaskForm
          weekly={weekly}
          currentWeekKey={currentWeekKey}
          onSave={() => { setShowForm(false); onUpdate(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {(["open", "blocked", "done"] as const).map((status) => {
        const group = grouped[status];
        if (group.length === 0) return null;
        return (
          <div key={status} className="mb-6">
            <h3
              className="font-mono text-xs uppercase tracking-widest mb-2 px-1"
              style={{ color: "var(--muted)" }}
            >
              {status} ({group.length})
            </h3>
            <div className="space-y-1">
              {group.map((task) => (
                <TaskRow key={task.id} task={task} onUpdate={onUpdate} />
              ))}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <p className="font-mono text-sm py-8 text-center" style={{ color: "var(--muted)" }}>
          No tasks yet.
        </p>
      )}
    </div>
  );
}

function TaskRow({ task, onUpdate }: { task: Task; onUpdate: () => void }) {
  const overdue = task.status !== "done" && isOverdue(task.dueWeek);
  const [expanded, setExpanded] = useState(false);

  const setStatus = async (status: Task["status"]) => {
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    onUpdate();
  };

  return (
    <div
      className="border rounded p-3 transition-all"
      style={{ borderColor: overdue ? "var(--accent)" : "var(--border)", background: "white" }}
    >
      <div className="flex items-start gap-3">
        <StatusDot status={task.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="font-sans text-sm font-medium cursor-pointer"
              style={{ textDecoration: task.status === "done" ? "line-through" : "none", color: task.status === "done" ? "var(--muted)" : "var(--ink)" }}
              onClick={() => setExpanded(!expanded)}
            >
              {task.title}
            </span>
            {overdue && (
              <span className="font-mono text-xs px-1 rounded" style={{ background: "#fee2e2", color: "#dc2626" }}>overdue</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="font-mono text-xs" style={{ color: "var(--muted)" }}>due {task.dueWeek}</span>
            <div className="flex gap-1">
              {task.assignees.map((uid) => {
                const m = TEAM.find((t) => t.id === uid);
                return m ? (
                  <span
                    key={uid}
                    className="font-mono text-xs px-1.5 py-0.5 rounded-full text-white"
                    style={{ background: m.color, fontSize: "9px" }}
                  >
                    {m.avatar}
                  </span>
                ) : null;
              })}
            </div>
          </div>
          {expanded && task.description && (
            <p className="font-sans text-xs mt-2" style={{ color: "var(--muted)" }}>{task.description}</p>
          )}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          {task.status !== "done" && (
            <button
              onClick={() => setStatus("done")}
              className="font-mono text-xs px-2 py-0.5 rounded transition-all hover:opacity-70"
              style={{ background: "#dcfce7", color: "#15803d" }}
            >
              Done
            </button>
          )}
          {task.status === "open" && (
            <button
              onClick={() => setStatus("blocked")}
              className="font-mono text-xs px-2 py-0.5 rounded transition-all hover:opacity-70"
              style={{ background: "#fee2e2", color: "#dc2626" }}
            >
              Block
            </button>
          )}
          {task.status !== "open" && (
            <button
              onClick={() => setStatus("open")}
              className="font-mono text-xs px-2 py-0.5 rounded transition-all hover:opacity-70"
              style={{ background: "var(--border)", color: "var(--ink)" }}
            >
              Reopen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open: "#2563eb",
    done: "#16a34a",
    blocked: "#dc2626",
  };
  return (
    <div
      className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
      style={{ background: colors[status] ?? "var(--muted)" }}
    />
  );
}

function TaskForm({
  weekly,
  currentWeekKey,
  onSave,
  onCancel,
}: {
  weekly: Weekly;
  currentWeekKey: string;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [dueWeek, setDueWeek] = useState(weekly.id);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim() || assignees.length === 0) return;
    setSaving(true);
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim(),
        assignees,
        dueWeek,
        createdFromWeek: weekly.id,
      }),
    });
    setSaving(false);
    onSave();
  };

  return (
    <div
      className="border rounded p-4 mb-4"
      style={{ borderColor: "var(--border)", background: "white" }}
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title *"
        className="w-full font-sans text-sm mb-2 px-2 py-1.5 border rounded bg-transparent focus:outline-none"
        style={{ borderColor: "var(--border)" }}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        rows={2}
        className="w-full font-sans text-sm mb-2 px-2 py-1.5 border rounded bg-transparent focus:outline-none resize-none"
        style={{ borderColor: "var(--border)" }}
      />
      <div className="flex gap-2 mb-3 flex-wrap">
        {TEAM.map((m) => (
          <button
            key={m.id}
            onClick={() =>
              setAssignees((prev) =>
                prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id]
              )
            }
            className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-mono transition-all"
            style={{
              background: assignees.includes(m.id) ? m.color : "transparent",
              color: assignees.includes(m.id) ? "white" : "var(--ink)",
              border: `1px solid ${assignees.includes(m.id) ? m.color : "var(--border)"}`,
            }}
          >
            {m.name.split(" ")[0]}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 mb-3">
        <label className="font-mono text-xs" style={{ color: "var(--muted)" }}>Due week:</label>
        <input
          type="text"
          value={dueWeek}
          onChange={(e) => setDueWeek(e.target.value)}
          className="font-mono text-xs px-2 py-1 border rounded bg-transparent focus:outline-none"
          style={{ borderColor: "var(--border)" }}
          placeholder="YYYY-CWww"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving || !title.trim() || assignees.length === 0}
          className="font-mono text-sm px-4 py-1.5 rounded transition-all disabled:opacity-40"
          style={{ background: "var(--ink)", color: "var(--paper)" }}
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={onCancel}
          className="font-mono text-sm px-4 py-1.5 rounded transition-all"
          style={{ border: "1px solid var(--border)" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
