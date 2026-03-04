/**
 * ISO week utilities (ISO 8601: week starts Monday, week 1 = week of first Thursday)
 */

export function getISOWeek(date: Date): { year: number; cw: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const cw = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), cw };
}

export function getCurrentISOWeek(): { year: number; cw: number } {
  return getISOWeek(new Date());
}

/** "YYYY-CWww" format, e.g. "2024-CW03" */
export function formatWeekKey(year: number, cw: number): string {
  return `${year}-CW${String(cw).padStart(2, "0")}`;
}

export function parseWeekKey(key: string): { year: number; cw: number } | null {
  const m = key.match(/^(\d{4})-CW(\d{2})$/);
  if (!m) return null;
  return { year: parseInt(m[1], 10), cw: parseInt(m[2], 10) };
}

/** Compare two week keys: returns -1 | 0 | 1 */
export function compareWeeks(a: string, b: string): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function isOverdue(dueWeek: string): boolean {
  const { year, cw } = getCurrentISOWeek();
  return compareWeeks(dueWeek, formatWeekKey(year, cw)) < 0;
}

/** Get the Monday date of an ISO week */
export function weekToDate(year: number, cw: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (cw - 1) * 7);
  return monday;
}

export function formatWeekLabel(year: number, cw: number): string {
  const monday = weekToDate(year, cw);
  const friday = new Date(monday);
  friday.setUTCDate(monday.getUTCDate() + 4);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return `CW${String(cw).padStart(2, "0")} · ${fmt(monday)} – ${fmt(friday)}, ${year}`;
}

export function getPrevWeek(year: number, cw: number): { year: number; cw: number } {
  const d = weekToDate(year, cw);
  d.setUTCDate(d.getUTCDate() - 7);
  return getISOWeek(d);
}

export function getNextWeek(year: number, cw: number): { year: number; cw: number } {
  const d = weekToDate(year, cw);
  d.setUTCDate(d.getUTCDate() + 7);
  return getISOWeek(d);
}
