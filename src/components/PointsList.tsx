"use client";

import { useState } from "react";
import type { Weekly, WeeklyPoint } from "@/lib/types";
import { TEAM } from "@/lib/team";

interface Props {
  weekly: Weekly;
  points: WeeklyPoint[];
  selectedUserId: string;
  onUpdate: () => void;
}

const AREAS = ["General", "Progress", "Blockers", "Plans", "Other"];

export default function PointsList({ weekly, points, selectedUserId, onUpdate }: Props) {
  const [newText, setNewText] = useState("");
  const [newArea, setNewArea] = useState("General");
  const [adding, setAdding] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const myPoints = points.filter((p) => p.authorUserId === selectedUserId);
  const otherPoints = points.filter((p) => p.authorUserId !== selectedUserId);
  const displayPoints = showAll ? points : myPoints;

  const addPoint = async () => {
    if (!newText.trim()) return;
    setAdding(true);
    await fetch(`/api/weeklies/${weekly.year}/${weekly.cw}/points`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authorUserId: selectedUserId,
        area: newArea,
        text: newText.trim(),
      }),
    });
    setNewText("");
    setAdding(false);
    onUpdate();
  };

  const toggleCheck = async (point: WeeklyPoint) => {
    await fetch(`/api/points/${point.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checked: !point.checked }),
    });
    onUpdate();
  };

  return (
    <div>
      {/* View toggle */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-mono text-xs uppercase tracking-widest" style={{ color: "var(--muted)" }}>
          {showAll ? `All points (${points.length})` : `${TEAM.find(m => m.id === selectedUserId)?.name.split(" ")[0]}'s points (${myPoints.length})`}
        </h2>
        {otherPoints.length > 0 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="font-mono text-xs hover:opacity-70 transition-opacity"
            style={{ color: "var(--muted)" }}
          >
            {showAll ? "Show mine" : `Show all (${points.length})`}
          </button>
        )}
      </div>

      {/* Points list */}
      <div className="space-y-1 mb-6">
        {displayPoints.length === 0 && (
          <p className="font-mono text-sm py-8 text-center" style={{ color: "var(--muted)" }}>
            No points yet — add your first one below.
          </p>
        )}
        {displayPoints.map((point) => {
          const author = TEAM.find((m) => m.id === point.authorUserId);
          return (
            <PointRow
              key={point.id}
              point={point}
              author={author}
              showAuthor={showAll}
              onToggle={() => toggleCheck(point)}
              onUpdate={onUpdate}
            />
          );
        })}
      </div>

      {/* Add point form */}
      <div className="border-t pt-4" style={{ borderColor: "var(--border)" }}>
        <div className="flex gap-2 mb-2">
          <select
            value={newArea}
            onChange={(e) => setNewArea(e.target.value)}
            className="font-mono text-xs px-2 py-1.5 rounded border bg-transparent"
            style={{ borderColor: "var(--border)" }}
          >
            {AREAS.map((a) => <option key={a}>{a}</option>)}
          </select>
          <input
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addPoint()}
            placeholder="Add a point... (Enter to save)"
            className="flex-1 font-mono text-sm px-3 py-1.5 rounded border bg-transparent focus:outline-none"
            style={{ borderColor: "var(--border)" }}
          />
          <button
            onClick={addPoint}
            disabled={adding || !newText.trim()}
            className="font-mono text-sm px-4 py-1.5 rounded transition-all disabled:opacity-40"
            style={{ background: "var(--ink)", color: "var(--paper)" }}
          >
            {adding ? "..." : "+ Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PointRow({
  point,
  author,
  showAuthor,
  onToggle,
  onUpdate,
}: {
  point: WeeklyPoint;
  author: ReturnType<typeof TEAM.find>;
  showAuthor: boolean;
  onToggle: () => void;
  onUpdate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(point.text);

  const saveEdit = async () => {
    if (editText.trim() === point.text) { setEditing(false); return; }
    await fetch(`/api/points/${point.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: editText.trim() }),
    });
    setEditing(false);
    onUpdate();
  };

  return (
    <div
      className="flex items-start gap-3 px-3 py-2 rounded group transition-colors"
      style={{ background: point.checked ? "transparent" : undefined }}
    >
      <button
        onClick={onToggle}
        className="mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all"
        style={{
          borderColor: point.checked ? "var(--accent)" : "var(--border)",
          background: point.checked ? "var(--accent)" : "transparent",
        }}
      >
        {point.checked && <span className="text-white text-xs">✓</span>}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className="font-mono text-xs px-1.5 py-0.5 rounded"
            style={{ background: "var(--border)", fontSize: "10px" }}
          >
            {point.area}
          </span>
          {showAuthor && author && (
            <span
              className="font-mono text-xs px-1.5 py-0.5 rounded-full text-white"
              style={{ background: author.color, fontSize: "9px" }}
            >
              {author.avatar}
            </span>
          )}
        </div>
        {editing ? (
          <input
            autoFocus
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditing(false); }}
            className="w-full font-sans text-sm bg-transparent border-b focus:outline-none"
            style={{ borderColor: "var(--accent)", textDecoration: point.checked ? "line-through" : "none", color: point.checked ? "var(--muted)" : "var(--ink)" }}
          />
        ) : (
          <span
            className="font-sans text-sm cursor-text"
            style={{ textDecoration: point.checked ? "line-through" : "none", color: point.checked ? "var(--muted)" : "var(--ink)" }}
            onDoubleClick={() => setEditing(true)}
          >
            {point.text}
          </span>
        )}
      </div>
    </div>
  );
}
