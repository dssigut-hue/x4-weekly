"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import type { MeetingTimer, SpeakerTimer, WeeklyPoint } from "@/lib/types";
import { TEAM, getMemberById, SPEAKER_ALLOCATED_SECONDS } from "@/lib/team";

interface Props {
  weeklyId: string;
  year: number;
  cw: number;
  label: string;
}

const TICK_INTERVAL = 2000; // 2 seconds
const CONTROLLER_ID = "alice"; // In production, this would come from auth; hardcode for MVP

export default function MeetingMode({ weeklyId, year, cw, label }: Props) {
  const [timer, setTimer] = useState<MeetingTimer | null>(null);
  const [speakers, setSpeakers] = useState<SpeakerTimer[]>([]);
  const [points, setPoints] = useState<WeeklyPoint[]>([]);
  const [myUserId] = useState(CONTROLLER_ID);
  const [error, setError] = useState<string | null>(null);
  const [localElapsed, setLocalElapsed] = useState(0);
  const tickRef = useRef<NodeJS.Timeout | null>(null);
  const localTickRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch timer state
  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`/api/weeklies/${year}/${cw}/meeting-timer`);
      const data = await res.json();
      setTimer(data.timer);
      setSpeakers(data.speakers);
    } catch (e) {
      console.error("Failed to fetch timer state", e);
    }
  }, [year, cw]);

  // Fetch points for current speaker
  const fetchPoints = useCallback(async () => {
    const res = await fetch(`/api/weeklies/${year}/${cw}/points`);
    const data: WeeklyPoint[] = await res.json();
    setPoints(data);
  }, [year, cw]);

  // Initial load + polling every 2s
  useEffect(() => {
    fetchState();
    fetchPoints();
    const id = setInterval(() => { fetchState(); }, TICK_INTERVAL);
    return () => clearInterval(id);
  }, [fetchState, fetchPoints]);

  // Local clock that ticks every second for smooth display
  useEffect(() => {
    if (timer?.state === "running") {
      localTickRef.current = setInterval(() => {
        setLocalElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      if (localTickRef.current) clearInterval(localTickRef.current);
      setLocalElapsed(0);
    }
    return () => { if (localTickRef.current) clearInterval(localTickRef.current); };
  }, [timer?.state, timer?.currentSpeakerUserId]);

  // Tick handler (controller sends delta to server every 2s)
  useEffect(() => {
    if (timer?.state !== "running" || timer.controlledByUserId !== myUserId) {
      if (tickRef.current) clearInterval(tickRef.current);
      return;
    }
    tickRef.current = setInterval(async () => {
      if (!timer) return;
      try {
        await fetch(`/api/weeklies/${year}/${cw}/meeting-timer/tick`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deltaSeconds: 2, expectedVersion: timer.version }),
        });
        await fetchState();
      } catch (e) {
        console.error("Tick failed", e);
      }
    }, TICK_INTERVAL);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [timer?.state, timer?.version, timer?.controlledByUserId, myUserId, year, cw, fetchState]);

  const timerAction = async (
    path: string,
    body: Record<string, unknown>
  ) => {
    setError(null);
    const res = await fetch(`/api/weeklies/${year}/${cw}/meeting-timer/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, expectedVersion: timer?.version ?? 0 }),
    });
    if (!res.ok) {
      const err = await res.json();
      if (res.status === 409 && err.error?.includes("another speaker")) {
        // Offer takeover
        const force = window.confirm("Another speaker's timer is running. Take over?");
        if (force) {
          await fetch(`/api/weeklies/${year}/${cw}/meeting-timer/start`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...body, force: true, expectedVersion: timer?.version ?? 0 }),
          });
        }
      } else {
        setError(err.error ?? "Error");
      }
    }
    await fetchState();
  };

  const startSpeaker = (userId: string) =>
    timerAction("start", { speakerUserId: userId, controlledByUserId: myUserId });

  const pauseTimer = () =>
    timerAction("pause", { controlledByUserId: myUserId });

  const stopTimer = () =>
    timerAction("stop", { controlledByUserId: myUserId });

  const speakerPoints = timer?.currentSpeakerUserId
    ? points.filter((p) => p.authorUserId === timer.currentSpeakerUserId)
    : [];

  const currentSpeaker = timer?.currentSpeakerUserId
    ? getMemberById(timer.currentSpeakerUserId)
    : null;

  const currentSpeakerTimer = timer?.currentSpeakerUserId
    ? speakers.find((s) => s.userId === timer.currentSpeakerUserId)
    : null;

  const controller = timer?.controlledByUserId ? getMemberById(timer.controlledByUserId) : null;

  return (
    <div className="min-h-screen" style={{ background: "var(--ink)", color: "var(--paper)" }}>
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/weekly/${year}/${cw}`}
              className="font-mono text-xs tracking-widest uppercase opacity-40 hover:opacity-100 transition-opacity"
            >
              ← back
            </Link>
            <span className="opacity-20">·</span>
            <div>
              <div className="font-mono text-sm opacity-60">{label}</div>
              <div className="font-mono text-xs opacity-30">meeting mode</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {controller && (
              <div className="font-mono text-xs opacity-40">
                controlled by{" "}
                <span style={{ color: controller.color }}>{controller.name.split(" ")[0]}</span>
              </div>
            )}
            <UserSelector myUserId={myUserId} />
          </div>
        </div>
      </header>

      {error && (
        <div className="bg-red-900/30 border border-red-500/30 text-red-300 font-mono text-sm px-6 py-2">
          {error}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Speakers list */}
        <div className="lg:col-span-1">
          <h2 className="font-mono text-xs uppercase tracking-widest mb-4 opacity-40">Speakers</h2>
          <div className="space-y-2">
            {TEAM.map((member) => {
              const speakerTimer = speakers.find((s) => s.userId === member.id);
              const isActive = timer?.currentSpeakerUserId === member.id;
              const spent = (speakerTimer?.spentSeconds ?? 0) + (isActive && timer?.state === "running" ? localElapsed : 0);
              const remaining = SPEAKER_ALLOCATED_SECONDS - spent;
              const pct = Math.min(100, (spent / SPEAKER_ALLOCATED_SECONDS) * 100);
              const isOverTime = remaining < 0;

              return (
                <div
                  key={member.id}
                  className="rounded p-3 transition-all cursor-pointer"
                  style={{
                    background: isActive ? member.color + "22" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${isActive ? member.color + "44" : "rgba(255,255,255,0.1)"}`,
                  }}
                  onClick={() => {
                    if (!isActive) startSpeaker(member.id);
                  }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                      style={{ background: member.color }}
                    >
                      {member.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm font-medium truncate">{member.name}</div>
                      <div className="font-mono text-xs" style={{ color: isOverTime ? "#f87171" : "rgba(255,255,255,0.4)" }}>
                        {isOverTime ? "+" : ""}{formatTime(Math.abs(remaining))} {isOverTime ? "over" : "left"}
                      </div>
                    </div>
                    {isActive && (
                      <div className="flex items-center gap-1">
                        {timer?.state === "running" ? (
                          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: member.color }} />
                        ) : (
                          <span className="font-mono text-xs opacity-40">paused</span>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Progress bar */}
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{
                        width: `${pct}%`,
                        background: isOverTime ? "#f87171" : member.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Active speaker view */}
        <div className="lg:col-span-2">
          {timer?.state === "idle" || !currentSpeaker ? (
            <div className="flex flex-col items-center justify-center py-24 opacity-20">
              <div className="font-mono text-6xl mb-4">▶</div>
              <div className="font-mono text-sm">Select a speaker to begin</div>
            </div>
          ) : (
            <div>
              {/* Big timer display */}
              <div className="text-center mb-8">
                <div
                  className="inline-flex items-center gap-3 px-4 py-2 rounded-full mb-4"
                  style={{ background: currentSpeaker.color + "22", border: `1px solid ${currentSpeaker.color}44` }}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ background: currentSpeaker.color, fontSize: "10px" }}
                  >
                    {currentSpeaker.avatar}
                  </div>
                  <span className="font-mono text-sm" style={{ color: currentSpeaker.color }}>
                    {currentSpeaker.name}
                  </span>
                  {timer?.state === "running" && (
                    <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: currentSpeaker.color }} />
                  )}
                </div>

                <BigTimer
                  spent={(currentSpeakerTimer?.spentSeconds ?? 0) + (timer?.state === "running" ? localElapsed : 0)}
                  allocated={SPEAKER_ALLOCATED_SECONDS}
                  color={currentSpeaker.color}
                  state={timer?.state ?? "idle"}
                />
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-3 mb-8">
                {timer?.state === "running" ? (
                  <button
                    onClick={pauseTimer}
                    className="font-mono text-sm px-6 py-2.5 rounded transition-all hover:opacity-80"
                    style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}
                  >
                    ⏸ Pause
                  </button>
                ) : (
                  <button
                    onClick={() => startSpeaker(timer.currentSpeakerUserId!)}
                    className="font-mono text-sm px-6 py-2.5 rounded transition-all hover:opacity-80"
                    style={{ background: currentSpeaker.color, color: "white" }}
                  >
                    ▶ Resume
                  </button>
                )}
                <button
                  onClick={stopTimer}
                  className="font-mono text-sm px-6 py-2.5 rounded transition-all hover:opacity-80"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  ■ Stop
                </button>
              </div>

              {/* Speaker's points */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-mono text-xs uppercase tracking-widest opacity-40">
                    {currentSpeaker.name.split(" ")[0]}'s points ({speakerPoints.length})
                  </h3>
                </div>
                <SpeakerPointsView
                  points={speakerPoints}
                  speakerId={currentSpeaker.id}
                  year={year}
                  cw={cw}
                  onUpdate={fetchPoints}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BigTimer({ spent, allocated, color, state }: {
  spent: number;
  allocated: number;
  color: string;
  state: string;
}) {
  const remaining = allocated - spent;
  const isOver = remaining < 0;
  const display = formatTime(Math.abs(remaining));
  const pct = Math.min(100, (spent / allocated) * 100);

  return (
    <div>
      <div
        className="font-mono text-7xl font-bold tracking-tighter mb-4 transition-colors"
        style={{ color: isOver ? "#f87171" : color }}
      >
        {isOver ? "−" : ""}{display}
      </div>
      <div className="w-full max-w-sm mx-auto h-2 rounded-full overflow-hidden mb-2" style={{ background: "rgba(255,255,255,0.1)" }}>
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${pct}%`, background: isOver ? "#f87171" : color }}
        />
      </div>
      <div className="font-mono text-xs opacity-30">
        {state === "paused" ? "PAUSED · " : ""}{formatTime(spent)} used / {formatTime(allocated)} total
      </div>
    </div>
  );
}

function SpeakerPointsView({
  points,
  speakerId,
  year,
  cw,
  onUpdate,
}: {
  points: WeeklyPoint[];
  speakerId: string;
  year: number;
  cw: number;
  onUpdate: () => void;
}) {
  const [newText, setNewText] = useState("");
  const [adding, setAdding] = useState(false);

  const toggleCheck = async (point: WeeklyPoint) => {
    await fetch(`/api/points/${point.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checked: !point.checked }),
    });
    onUpdate();
  };

  const addPoint = async () => {
    if (!newText.trim()) return;
    setAdding(true);
    await fetch(`/api/weeklies/${year}/${cw}/points`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorUserId: speakerId, area: "General", text: newText.trim() }),
    });
    setNewText("");
    setAdding(false);
    onUpdate();
  };

  return (
    <div
      className="rounded border p-4"
      style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}
    >
      {points.length === 0 && (
        <p className="font-mono text-xs opacity-30 mb-3">No points for this speaker yet.</p>
      )}
      <div className="space-y-2 mb-4">
        {points.map((p) => (
          <div key={p.id} className="flex items-start gap-3">
            <button
              onClick={() => toggleCheck(p)}
              className="mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all"
              style={{
                borderColor: p.checked ? "var(--accent)" : "rgba(255,255,255,0.3)",
                background: p.checked ? "var(--accent)" : "transparent",
              }}
            >
              {p.checked && <span className="text-white text-xs">✓</span>}
            </button>
            <div>
              <span
                className="font-mono text-xs px-1 rounded mr-2"
                style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}
              >
                {p.area}
              </span>
              <span
                className="font-sans text-sm"
                style={{
                  textDecoration: p.checked ? "line-through" : "none",
                  opacity: p.checked ? 0.4 : 1,
                }}
              >
                {p.text}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addPoint()}
          placeholder="Quick add point..."
          className="flex-1 font-mono text-xs px-3 py-1.5 rounded bg-transparent focus:outline-none"
          style={{ border: "1px solid rgba(255,255,255,0.15)", color: "var(--paper)" }}
        />
        <button
          onClick={addPoint}
          disabled={adding || !newText.trim()}
          className="font-mono text-xs px-3 py-1.5 rounded transition-all disabled:opacity-30"
          style={{ background: "rgba(255,255,255,0.1)" }}
        >
          +
        </button>
      </div>
    </div>
  );
}

function UserSelector({ myUserId }: { myUserId: string }) {
  const me = getMemberById(myUserId);
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded font-mono text-xs"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      <span
        className="w-5 h-5 rounded-full flex items-center justify-center text-white"
        style={{ background: me?.color, fontSize: "9px", fontWeight: 700 }}
      >
        {me?.avatar}
      </span>
      <span className="opacity-60">You: {me?.name.split(" ")[0]}</span>
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
