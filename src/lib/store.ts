/**
 * In-memory store — swap this module for a SharePoint/Graph adapter later.
 * All mutations return the updated entity.
 */

import { nanoid } from "./nanoid";
import type {
  Weekly,
  WeeklyPoint,
  Task,
  MeetingTimer,
  SpeakerTimer,
  CreateWeeklyPayload,
  CreatePointPayload,
  PatchPointPayload,
  CreateTaskPayload,
  PatchTaskPayload,
} from "./types";
import { TEAM, SPEAKER_ALLOCATED_SECONDS } from "./team";
import { formatWeekKey } from "./isoWeek";

// ─── State ────────────────────────────────────────────────────────────────────

const weeklies = new Map<string, Weekly>();
const points = new Map<string, WeeklyPoint>();
const tasks = new Map<string, Task>();
const meetingTimers = new Map<string, MeetingTimer>();
const speakerTimers = new Map<string, SpeakerTimer>(); // key: `${weeklyId}:${userId}`

// ─── Helpers ──────────────────────────────────────────────────────────────────

function weeklyKey(year: number, cw: number): string {
  return formatWeekKey(year, cw);
}

// ─── Weeklies ─────────────────────────────────────────────────────────────────

export function getWeekly(year: number, cw: number): Weekly | null {
  return weeklies.get(weeklyKey(year, cw)) ?? null;
}

export function listWeeklies(): Weekly[] {
  return [...weeklies.values()].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.cw - a.cw;
  });
}

export function upsertWeekly(year: number, cw: number): Weekly {
  const key = weeklyKey(year, cw);
  if (weeklies.has(key)) return weeklies.get(key)!;
  const w: Weekly = {
    id: key,
    year,
    cw,
    status: "open",
    createdAt: new Date().toISOString(),
  };
  weeklies.set(key, w);
  // Initialise meeting timer & speaker timers
  _initMeetingTimer(key);
  return w;
}

export function patchWeekly(
  year: number,
  cw: number,
  patch: Partial<Pick<Weekly, "status">>
): Weekly | null {
  const key = weeklyKey(year, cw);
  const w = weeklies.get(key);
  if (!w) return null;
  const updated = { ...w, ...patch };
  weeklies.set(key, updated);
  return updated;
}

// ─── Points ───────────────────────────────────────────────────────────────────

export function listPoints(weeklyId: string): WeeklyPoint[] {
  return [...points.values()]
    .filter((p) => p.weeklyId === weeklyId)
    .sort((a, b) => a.order - b.order);
}

export function createPoint(weeklyId: string, data: CreatePointPayload): WeeklyPoint {
  const existing = listPoints(weeklyId);
  const maxOrder = existing.reduce((m, p) => Math.max(m, p.order), -1);
  const p: WeeklyPoint = {
    id: nanoid(),
    weeklyId,
    authorUserId: data.authorUserId,
    area: data.area,
    text: data.text,
    checked: false,
    order: data.order ?? maxOrder + 1,
    createdAt: new Date().toISOString(),
  };
  points.set(p.id, p);
  return p;
}

export function getPoint(id: string): WeeklyPoint | null {
  return points.get(id) ?? null;
}

export function patchPoint(id: string, patch: PatchPointPayload): WeeklyPoint | null {
  const p = points.get(id);
  if (!p) return null;
  const updated = { ...p, ...patch };
  points.set(id, updated);
  return updated;
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export function listTasks(): Task[] {
  return [...tasks.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function createTask(data: CreateTaskPayload): Task {
  const t: Task = {
    id: nanoid(),
    ...data,
    status: "open",
    createdAt: new Date().toISOString(),
  };
  tasks.set(t.id, t);
  return t;
}

export function getTask(id: string): Task | null {
  return tasks.get(id) ?? null;
}

export function patchTask(id: string, patch: PatchTaskPayload): Task | null {
  const t = tasks.get(id);
  if (!t) return null;
  const updated = { ...t, ...patch };
  tasks.set(id, updated);
  return updated;
}

// ─── Meeting Timer ─────────────────────────────────────────────────────────────

function _initMeetingTimer(weeklyId: string): void {
  if (!meetingTimers.has(weeklyId)) {
    meetingTimers.set(weeklyId, {
      weeklyId,
      currentSpeakerUserId: null,
      state: "idle",
      controlledByUserId: null,
      startedAt: null,
      version: 0,
    });
  }
  // init speaker timers for all team members
  for (const m of TEAM) {
    const key = `${weeklyId}:${m.id}`;
    if (!speakerTimers.has(key)) {
      speakerTimers.set(key, {
        weeklyId,
        userId: m.id,
        allocatedSeconds: SPEAKER_ALLOCATED_SECONDS,
        spentSeconds: 0,
      });
    }
  }
}

export function getMeetingTimer(weeklyId: string): MeetingTimer | null {
  return meetingTimers.get(weeklyId) ?? null;
}

export function getSpeakerTimers(weeklyId: string): SpeakerTimer[] {
  return [...speakerTimers.values()].filter((s) => s.weeklyId === weeklyId);
}

export function getSpeakerTimer(weeklyId: string, userId: string): SpeakerTimer | null {
  return speakerTimers.get(`${weeklyId}:${userId}`) ?? null;
}

/** Generic update with version check. Returns 409 string on mismatch, else updated timer. */
export function updateMeetingTimer(
  weeklyId: string,
  expectedVersion: number,
  updater: (t: MeetingTimer) => Omit<MeetingTimer, "version">
): MeetingTimer | "CONFLICT" | "NOT_FOUND" {
  // ensure weekly exists
  if (!weeklies.has(weeklyId)) {
    // auto-create
    const [yearStr, cwStr] = weeklyId.split("-CW");
    upsertWeekly(parseInt(yearStr), parseInt(cwStr));
  }
  const t = meetingTimers.get(weeklyId);
  if (!t) return "NOT_FOUND";
  if (t.version !== expectedVersion) return "CONFLICT";
  const updated: MeetingTimer = { ...updater(t), version: t.version + 1 };
  meetingTimers.set(weeklyId, updated);
  return updated;
}

export function addSpeakerSpentSeconds(
  weeklyId: string,
  userId: string,
  delta: number
): SpeakerTimer | null {
  const key = `${weeklyId}:${userId}`;
  const s = speakerTimers.get(key);
  if (!s) return null;
  const updated = { ...s, spentSeconds: s.spentSeconds + delta };
  speakerTimers.set(key, updated);
  return updated;
}

export function resetSpeakerTimer(weeklyId: string, userId: string): SpeakerTimer | null {
  const key = `${weeklyId}:${userId}`;
  const s = speakerTimers.get(key);
  if (!s) return null;
  const updated = { ...s, spentSeconds: 0 };
  speakerTimers.set(key, updated);
  return updated;
}
