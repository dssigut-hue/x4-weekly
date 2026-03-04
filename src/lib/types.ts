// ─── Domain Types ────────────────────────────────────────────────────────────

export interface Weekly {
  id: string;
  year: number;
  cw: number;
  status: "open" | "closed";
  createdAt: string;
}

export interface WeeklyPoint {
  id: string;
  weeklyId: string;
  authorUserId: string;
  area: string;
  text: string;
  checked: boolean;
  order: number;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assignees: string[];
  createdFromWeek: string; // "YYYY-CWww"
  dueWeek: string; // "YYYY-CWww"
  status: "open" | "done" | "blocked";
  relatedPointId?: string;
  createdAt: string;
}

export type MeetingState = "idle" | "running" | "paused";

export interface MeetingTimer {
  weeklyId: string;
  currentSpeakerUserId: string | null;
  state: MeetingState;
  controlledByUserId: string | null;
  startedAt: string | null;
  version: number;
}

export interface SpeakerTimer {
  weeklyId: string;
  userId: string;
  allocatedSeconds: number;
  spentSeconds: number;
}

export interface TeamMember {
  id: string;
  name: string;
  avatar: string; // initials
  color: string;
}

// ─── API Payloads ─────────────────────────────────────────────────────────────

export interface CreateWeeklyPayload {
  year: number;
  cw: number;
}

export interface CreatePointPayload {
  authorUserId: string;
  area: string;
  text: string;
  order?: number;
}

export interface PatchPointPayload {
  area?: string;
  text?: string;
  checked?: boolean;
  order?: number;
}

export interface CreateTaskPayload {
  title: string;
  description: string;
  assignees: string[];
  createdFromWeek: string;
  dueWeek: string;
  relatedPointId?: string;
}

export interface PatchTaskPayload {
  title?: string;
  description?: string;
  assignees?: string[];
  dueWeek?: string;
  status?: "open" | "done" | "blocked";
}

export interface TimerStartPayload {
  speakerUserId: string;
  controlledByUserId: string;
  expectedVersion: number;
  force?: boolean;
}

export interface TimerPausePayload {
  controlledByUserId: string;
  expectedVersion: number;
}

export interface TimerStopPayload {
  controlledByUserId: string;
  expectedVersion: number;
}

export interface TimerNextPayload {
  nextSpeakerUserId: string;
  controlledByUserId: string;
  expectedVersion: number;
}

export interface TimerTickPayload {
  deltaSeconds: number;
  expectedVersion: number;
}
