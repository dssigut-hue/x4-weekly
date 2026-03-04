/**
 * Redis store using Upstash — data persists across server restarts.
 */

import { Redis } from "@upstash/redis";
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

const redis = Redis.fromEnv();

// ─── Keys ─────────────────────────────────────────────────────────────────────

const K = {
  weekly: (id: string) => `weekly:${id}`,
  weekliesList: () => `weeklies`,
  point: (id: string) => `point:${id}`,
  weeklyPoints: (weeklyId: string) => `weekly:${weeklyId}:points`,
  task: (id: string) => `task:${id}`,
  tasksList: () => `tasks`,
  meetingTimer: (weeklyId: string) => `mt:${weeklyId}`,
  speakerTimer: (weeklyId: string, userId: string) => `st:${weeklyId}:${userId}`,
  speakerTimersList: (weeklyId: string) => `st:${weeklyId}:list`,
};

function weeklyKey(year: number, cw: number): string {
  return formatWeekKey(year, cw);
}

// ─── Weeklies ─────────────────────────────────────────────────────────────────

export async function getWeekly(year: number, cw: number): Promise<Weekly | null> {
  const key = weeklyKey(year, cw);
  return await redis.get<Weekly>(K.weekly(key));
}

export async function listWeeklies(): Promise<Weekly[]> {
  const ids = await redis.smembers(K.weekliesList());
  if (!ids.length) return [];
  const all = await Promise.all(ids.map((id) => redis.get<Weekly>(K.weekly(id))));
  return (all.filter(Boolean) as Weekly[]).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.cw - a.cw;
  });
}

export async function upsertWeekly(year: number, cw: number): Promise<Weekly> {
  const key = weeklyKey(year, cw);
  const existing = await redis.get<Weekly>(K.weekly(key));
  if (existing) return existing;
  const w: Weekly = {
    id: key,
    year,
    cw,
    status: "open",
    createdAt: new Date().toISOString(),
  };
  await redis.set(K.weekly(key), w);
  await redis.sadd(K.weekliesList(), key);
  await _initMeetingTimer(key);
  return w;
}

export async function patchWeekly(
  year: number,
  cw: number,
  patch: Partial<Pick<Weekly, "status">>
): Promise<Weekly | null> {
  const key = weeklyKey(year, cw);
  const w = await redis.get<Weekly>(K.weekly(key));
  if (!w) return null;
  const updated = { ...w, ...patch };
  await redis.set(K.weekly(key), updated);
  return updated;
}

// ─── Points ───────────────────────────────────────────────────────────────────

export async function listPoints(weeklyId: string): Promise<WeeklyPoint[]> {
  const ids = await redis.smembers(K.weeklyPoints(weeklyId));
  if (!ids.length) return [];
  const all = await Promise.all(ids.map((id) => redis.get<WeeklyPoint>(K.point(id))));
  return (all.filter(Boolean) as WeeklyPoint[]).sort((a, b) => a.order - b.order);
}

export async function createPoint(weeklyId: string, data: CreatePointPayload): Promise<WeeklyPoint> {
  const existing = await listPoints(weeklyId);
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
  await redis.set(K.point(p.id), p);
  await redis.sadd(K.weeklyPoints(weeklyId), p.id);
  return p;
}

export async function getPoint(id: string): Promise<WeeklyPoint | null> {
  return await redis.get<WeeklyPoint>(K.point(id));
}

export async function patchPoint(id: string, patch: PatchPointPayload): Promise<WeeklyPoint | null> {
  const p = await redis.get<WeeklyPoint>(K.point(id));
  if (!p) return null;
  const updated = { ...p, ...patch };
  await redis.set(K.point(id), updated);
  return updated;
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export async function listTasks(): Promise<Task[]> {
  const ids = await redis.smembers(K.tasksList());
  if (!ids.length) return [];
  const all = await Promise.all(ids.map((id) => redis.get<Task>(K.task(id))));
  return (all.filter(Boolean) as Task[]).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function createTask(data: CreateTaskPayload): Promise<Task> {
  const t: Task = {
    id: nanoid(),
    ...data,
    status: "open",
    createdAt: new Date().toISOString(),
  };
  await redis.set(K.task(t.id), t);
  await redis.sadd(K.tasksList(), t.id);
  return t;
}

export async function getTask(id: string): Promise<Task | null> {
  return await redis.get<Task>(K.task(id));
}

export async function patchTask(id: string, patch: PatchTaskPayload): Promise<Task | null> {
  const t = await redis.get<Task>(K.task(id));
  if (!t) return null;
  const updated = { ...t, ...patch };
  await redis.set(K.task(id), updated);
  return updated;
}

// ─── Meeting Timer ─────────────────────────────────────────────────────────────

async function _initMeetingTimer(weeklyId: string): Promise<void> {
  const existing = await redis.get(K.meetingTimer(weeklyId));
  if (!existing) {
    await redis.set(K.meetingTimer(weeklyId), {
      weeklyId,
      currentSpeakerUserId: null,
      state: "idle",
      controlledByUserId: null,
      startedAt: null,
      version: 0,
    });
  }
  for (const m of TEAM) {
    const stKey = K.speakerTimer(weeklyId, m.id);
    const existing = await redis.get(stKey);
    if (!existing) {
      await redis.set(stKey, {
        weeklyId,
        userId: m.id,
        allocatedSeconds: SPEAKER_ALLOCATED_SECONDS,
        spentSeconds: 0,
      });
      await redis.sadd(K.speakerTimersList(weeklyId), m.id);
    }
  }
}

export async function getMeetingTimer(weeklyId: string): Promise<MeetingTimer | null> {
  return await redis.get<MeetingTimer>(K.meetingTimer(weeklyId));
}

export async function getSpeakerTimers(weeklyId: string): Promise<SpeakerTimer[]> {
  const ids = await redis.smembers(K.speakerTimersList(weeklyId));
  if (!ids.length) return [];
  const all = await Promise.all(ids.map((id) => redis.get<SpeakerTimer>(K.speakerTimer(weeklyId, id))));
  return all.filter(Boolean) as SpeakerTimer[];
}

export async function getSpeakerTimer(weeklyId: string, userId: string): Promise<SpeakerTimer | null> {
  return await redis.get<SpeakerTimer>(K.speakerTimer(weeklyId, userId));
}

export async function updateMeetingTimer(
  weeklyId: string,
  expectedVersion: number,
  updater: (t: MeetingTimer) => Omit<MeetingTimer, "version">
): Promise<MeetingTimer | "CONFLICT" | "NOT_FOUND"> {
  const existing = await redis.get<Weekly>(K.weekly(weeklyId));
  if (!existing) {
    const [yearStr, cwStr] = weeklyId.split("-CW");
    await upsertWeekly(parseInt(yearStr), parseInt(cwStr));
  }
  const t = await redis.get<MeetingTimer>(K.meetingTimer(weeklyId));
  if (!t) return "NOT_FOUND";
  if (t.version !== expectedVersion) return "CONFLICT";
  const updated: MeetingTimer = { ...updater(t), version: t.version + 1 };
  await redis.set(K.meetingTimer(weeklyId), updated);
  return updated;
}

export async function addSpeakerSpentSeconds(
  weeklyId: string,
  userId: string,
  delta: number
): Promise<SpeakerTimer | null> {
  const s = await redis.get<SpeakerTimer>(K.speakerTimer(weeklyId, userId));
  if (!s) return null;
  const updated = { ...s, spentSeconds: s.spentSeconds + delta };
  await redis.set(K.speakerTimer(weeklyId, userId), updated);
  return updated;
}

export async function resetSpeakerTimer(weeklyId: string, userId: string): Promise<SpeakerTimer | null> {
  const s = await redis.get<SpeakerTimer>(K.speakerTimer(weeklyId, userId));
  if (!s) return null;
  const updated = { ...s, spentSeconds: 0 };
  await redis.set(K.speakerTimer(weeklyId, userId), updated);
  return updated;
}
