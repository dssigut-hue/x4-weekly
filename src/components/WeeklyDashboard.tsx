"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { Weekly, WeeklyPoint, Task } from "@/lib/types";
import { TEAM } from "@/lib/team";
import { isOverdue } from "@/lib/isoWeek";
import PointsList from "./PointsList";
import TasksPanel from "./TasksPanel";

interface Props {
  weekly: Weekly;
  label: string;
  isCurrent: boolean;
  prevHref: string;
  nextHref: string;
  currentWeekKey: string;
}

export default function WeeklyDashboard({ weekly, label, isCurrent, prevHref, nextHref, currentWeekKey }: Props) {
  const [points, setPoints] = useState<WeeklyPoint[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTab, setActiveTab] = useState<"points" | "tasks">("points");
  const [selectedUser, setSelectedUser] = useState(TEAM[0].id);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [pRes, tRes] = await Promise.all([
      fetch(`/api/weeklies/${weekly.year}/${weekly.cw}/points`),
      fetch("/api/tasks"),
    ]);
    const [p, t] = await Promise.all([pRes.json(), tRes.json()]);
    setPoints(p);
    setTasks(t);
    setLoading(false);
  }, [weekly.year, weekly.cw]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const weeklyTasks = tasks.filter(
    (t) => t.dueWeek === weekly.id || t.createdFromWeek === weekly.id
  );

  return (
    <div className="min-h-screen" style={{ background: "var(--paper)" }}>
      {/* Header */}
      <header className="border-b" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/weekly" className="font-mono text-xs tracking-widest uppercase opacity-50 hover:opacity-100 transition-opacity">
              x4
            </Link>
            <span style={{ color: "var(--border)" }}>·</span>
            <div className="flex items-center gap-2">
              <Link href={prevHref} className="w-7 h-7 flex items-center justify-center rounded hover:bg-black/5 transition-colors font-mono">‹</Link>
              <div>
                <div className="font-mono text-sm font-medium">{label}</div>
                {isCurrent && (
                  <div className="font-mono text-xs" style={{ color: "var(--accent)" }}>● CURRENT WEEK</div>
                )}
              </div>
              <Link href={nextHref} className="w-7 h-7 flex items-center justify-center rounded hover:bg-black/5 transition-colors font-mono">›</Link>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={weekly.status} />
            <Link
              href={`/weekly/${weekly.year}/${weekly.cw}/meeting`}
              className="flex items-center gap-2 px-4 py-2 text-sm font-mono font-medium transition-all hover:opacity-80"
              style={{ background: "var(--ink)", color: "var(--paper)", borderRadius: "2px" }}
            >
              <span>▶</span> Meeting
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* User selector */}
        <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
          {TEAM.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedUser(m.id)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-mono transition-all whitespace-nowrap"
              style={{
                background: selectedUser === m.id ? "var(--ink)" : "transparent",
                color: selectedUser === m.id ? "var(--paper)" : "var(--ink)",
                border: `1px solid ${selectedUser === m.id ? "var(--ink)" : "var(--border)"}`,
              }}
            >
              <span
                className="w-5 h-5 rounded-full text-xs flex items-center justify-center text-white font-bold"
                style={{ background: m.color, fontSize: "9px" }}
              >
                {m.avatar}
              </span>
              {m.name.split(" ")[0]}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-0 mb-6 border-b" style={{ borderColor: "var(--border)" }}>
          {(["points", "tasks"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-5 py-2 font-mono text-sm capitalize transition-all relative"
              style={{
                color: activeTab === tab ? "var(--ink)" : "var(--muted)",
                borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
                marginBottom: "-1px",
              }}
            >
              {tab}
              {tab === "tasks" && weeklyTasks.length > 0 && (
                <span className="ml-1.5 font-mono text-xs px-1.5 rounded" style={{ background: "var(--border)" }}>
                  {weeklyTasks.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="font-mono text-sm animate-pulse" style={{ color: "var(--muted)" }}>Loading...</div>
        ) : activeTab === "points" ? (
          <PointsList
            weekly={weekly}
            points={points}
            selectedUserId={selectedUser}
            onUpdate={fetchData}
          />
        ) : (
          <TasksPanel
            weekly={weekly}
            tasks={tasks}
            currentWeekKey={currentWeekKey}
            onUpdate={fetchData}
          />
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className="font-mono text-xs px-2 py-1 rounded"
      style={{
        background: status === "open" ? "#dcfce7" : "#fee2e2",
        color: status === "open" ? "#15803d" : "#dc2626",
      }}
    >
      {status}
    </span>
  );
}
