'use client';

import { useEffect, useMemo, useState } from 'react';
import { TEAM } from '@/lib/team';

type WeeklyPoint = {
  id: string;
  authorUserId: string;
  area: string;
  text: string;
  checked: boolean;
  order: number;
};

export default function WeeklyPage({ params }: { params: { year: string; cw: string } }) {
  const year = Number(params.year);
  const cw = Number(params.cw);
  const [points, setPoints] = useState<WeeklyPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTextByUser, setNewTextByUser] = useState<Record<string, string>>({});
  const [areaByUser, setAreaByUser] = useState<Record<string, string>>({});

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
    const area = (areaByUser[userId] ?? 'General').trim();
    const userPoints = pointsByUser[userId] ?? [];
    const nextOrder = userPoints.length ? Math.max(...userPoints.map((p) => p.order)) + 1 : 1;
    setNewTextByUser((prev) => ({ ...prev, [userId]: '' }));
    await fetch(`/api/weeklies/${year}/${cw}/points`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authorUserId: userId, text, area, order: nextOrder }),
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
      <h1 className='text-2xl font-semibold'>X4 Weekly (CW {cw}/{year})</h1>
      {loading && <div className='text-slate-500'>Nacitam...</div>}
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 gap-4'>
        {TEAM.map((m) => {
          const list = pointsByUser[m.id] ?? [];
          return (
            <div key={m.id} className='border rounded-xl p-4 bg-white'>
              <h2 className='font-semibold mb-2'>{m.name}</h2>
              <div className='flex gap-2 mb-3'>
                <input
                  className='border rounded px-2 py-1 text-xs w-24'
                  placeholder='Area'
                  value={areaByUser[m.id] ?? ''}
                  onChange={(e) => setAreaByUser((prev) => ({ ...prev, [m.id]: e.target.value }))}
                />
                <input
                  className='border rounded px-2 py-1 text-sm flex-1'
                  placeholder='Novy bod... (Enter)'
                  value={newTextByUser[m.id] ?? ''}
                  onChange={(e) => setNewTextByUser((prev) => ({ ...prev, [m.id]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && addPointForUser(m.id)}
                />
              </div>
              <div className='space-y-2'>
                {list.map((p) => (
                  <label key={p.id} className={`flex gap-2 ${p.checked ? 'opacity-60' : ''}`}>
                    <input type='checkbox' checked={p.checked} onChange={() => toggleChecked(p)} />
                    <span className={p.checked ? 'line-through' : ''}>{p.text}</span>
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
