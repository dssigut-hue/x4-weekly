'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TEAM } from '@/lib/team';

const TIMER_SECONDS = 7 * 60; // 7 minut

type WeeklyPoint = {
  id: string;
  authorUserId: string;
  area: string;
  text: string;
  checked: boolean;
  order: number;
};

function getAdjacentWeek(year: number, cw: number, delta: number): { year: number; cw: number } {
  // Vypočítá datum pondělí daného týdne
  const jan4 = new Date(year, 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const monday = new Date(startOfWeek1);
  monday.setDate(startOfWeek1.getDate() + (cw - 1) * 7 + delta * 7);
  const newYear = monday.getFullYear();
  const jan4New = new Date(newYear, 0, 4);
  const startNew = new Date(jan4New);
  startNew.setDate(jan4New.getDate() - ((jan4New.getDay() + 6) % 7));
  const newCw = Math.round((monday.getTime() - startNew.getTime()) / (7 * 24 * 3600 * 1000)) + 1;
  return { year: newYear, cw: newCw };
}

export default function WeeklyPage({ params }: { params: { year: string; cw: string } }) {
  const router = useRouter();
  const year = Number(params.year);
  const cw = Number(params.cw);

  const [points, setPoints] = useState<WeeklyPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTextByUser, setNewTextByUser] = useState<Record<string, string>>({});

  // Časovač
  const [activeTimer, setActiveTimer] = useState<string | null>(null); // userId
  const [timeLeft, setTimeLeft] = useState<Record<string, number>>({}); // userId -> seconds
  const [timerDone, setTimerDone] = useState<string | null>(null); // userId který právě dobil
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Navigace týdnů
  function navigateWeek(delta: number) {
    const next = getAdjacentWeek(year, cw, delta);
    router.push(`/weekly/${next.year}/${next.cw}`);
  }

  async function loadPoints() {
    setLoading(true);
    const res = await fetch(`/api/weeklies/${year}/${cw}/points`, { cache: 'no-store' });
    const data = await res.json();
    setPoints(Array.isArray(data) ? data : data.points ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadPoints();
    const t = setInterval(loadPoints, 2000);
    return () => clearInterval(t);
  }, [year, cw]);

  // Časovač logika
  useEffect(() => {
    if (activeTimer === null) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        const current = prev[activeTimer] ?? TIMER_SECONDS;
        if (current <= 1) {
          clearInterval(intervalRef.current!);
          setActiveTimer(null);
          setTimerDone(activeTimer);
          playAlarm();
          setTimeout(() => setTimerDone(null), 4000);
          return { ...prev, [activeTimer]: 0 };
        }
        return { ...prev, [activeTimer]: current - 1 };
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [activeTimer]);

  function playAlarm() {
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.5, ctx.currentTime + i * 0.4);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.4 + 0.3);
        osc.start(ctx.currentTime + i * 0.4);
        osc.stop(ctx.currentTime + i * 0.4 + 0.3);
      }
    } catch (e) {
      // Prohlížeč blokuje audio
    }
  }

  function startTimer(userId: string) {
    setTimeLeft((prev) => ({ ...prev, [userId]: TIMER_SECONDS }));
    setActiveTimer(userId);
  }

  function stopTimer() {
    setActiveTimer(null);
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  const pointsByUser = useMemo(() => {
    const map: Record<string, WeeklyPoint[]> = {};
    for (const m of TEAM) map[m.id] = [];
    for (const p of points) {
      (map[p.authorUserId] ??= []).push(p);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => a.order - b.order);
    }
    return map;
  }, [points]);

  async function addPointForUser(userId: string) {
    const text = (newTextByUser[userId] ?? '').trim();
    if (!text) return;
    const userPoints = pointsByUser[userId] ?? [];
    const nextOrder = userPoints.length ? Math.max(...userPoints.map((p) => p.order)) + 1 : 1;
    setNewTextByUser((prev) => ({ ...prev, [userId]: '' }));
    await fetch(`/api/weeklies/${year}/${cw}/points`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authorUserId: userId, text, area: 'General', order: nextOrder }),
    });
    loadPoints();
  }

  async function toggleChecked(p: WeeklyPoint) {
    setPoints((prev) => prev.map((x) => x.id === p.id ? { ...x, checked: !x.checked } : x));
    await fetch(`/api/points/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checked: !p.checked }),
    });
    loadPoints();
  }

  return (
    <div className='min-h-screen p-6 space-y-4'>
      {/* Hlavička s navigací */}
      <div className='flex items-center gap-4'>
        <button
          onClick={() => navigateWeek(-1)}
          className='text-xl px-3 py-1 rounded border hover:bg-gray-100 transition'
          title='Předchozí týden'
        >
          ←
        </button>
        <h1 className='text-2xl font-semibold'>X4 Weekly (CW {cw}/{year})</h1>
        <button
          onClick={() => navigateWeek(1)}
          className='text-xl px-3 py-1 rounded border hover:bg-gray-100 transition'
          title='Následující týden'
        >
          →
        </button>
      </div>

      {loading && <div className='text-slate-500'>Načítám...</div>}

      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 gap-4'>
        {TEAM.map((m) => {
          const list = pointsByUser[m.id] ?? [];
          const isActive = activeTimer === m.id;
          const isDone = timerDone === m.id;
          const seconds = timeLeft[m.id] ?? TIMER_SECONDS;
          const timerStarted = timeLeft[m.id] !== undefined;
          const pct = timerStarted ? seconds / TIMER_SECONDS : 1;
          const timerColor = pct > 0.4 ? m.color : pct > 0.15 ? '#f59e0b' : '#ef4444';

          return (
            <div
              key={m.id}
              className={`border rounded-xl p-4 bg-white transition-all ${isDone ? 'ring-4 ring-red-400' : ''}`}
            >
              {/* Jméno + timer tlačítko */}
              <div className='flex items-center justify-between mb-2'>
                <h2 className='font-semibold' style={{ color: m.color }}>{m.name}</h2>
                <button
                  onClick={() => isActive ? stopTimer() : startTimer(m.id)}
                  className='text-xs px-2 py-1 rounded border transition hover:opacity-80'
                  style={{
                    background: isActive ? m.color : 'white',
                    color: isActive ? 'white' : m.color,
                    borderColor: m.color,
                  }}
                >
                  {isActive ? '⏹ Stop' : '▶ Start'}
                </button>
              </div>

              {/* Časovač */}
              {timerStarted && (
                <div className='mb-3'>
                  <div className='flex items-center justify-between text-xs mb-1'>
                    <span
                      className='font-mono font-bold text-sm'
                      style={{ color: timerColor }}
                    >
                      {formatTime(seconds)}
                    </span>
                    {isDone && <span className='text-red-500 font-bold animate-pulse'>ČAS!</span>}
                  </div>
                  <div className='w-full bg-gray-200 rounded-full h-1.5'>
                    <div
                      className='h-1.5 rounded-full transition-all'
                      style={{ width: `${pct * 100}%`, background: timerColor }}
                    />
                  </div>
                </div>
              )}

              {/* Input */}
              <div className='flex gap-2 mb-3'>
                <input
                  className='border rounded px-2 py-1 text-sm flex-1'
                  placeholder='Nový bod... (Enter)'
                  value={newTextByUser[m.id] ?? ''}
                  onChange={(e) => setNewTextByUser((prev) => ({ ...prev, [m.id]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && addPointForUser(m.id)}
                />
              </div>

              {/* Body */}
              <div className='space-y-2'>
                {list.map((p) => (
                  <label key={p.id} className={`flex gap-2 ${p.checked ? 'opacity-60' : ''}`}>
                    <input type='checkbox' checked={p.checked} onChange={() => toggleChecked(p)} />
                    <span className={p.checked ? 'line-through text-sm' : 'text-sm'}>{p.text}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
