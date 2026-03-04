import type { TeamMember } from './types';

export const TEAM: TeamMember[] = [
  { id: 'monika', name: 'Monika', avatar: 'MO', color: '#e11d48' },
  { id: 'david', name: 'David', avatar: 'DA', color: '#2563eb' },
  { id: 'ondra', name: 'Ondra', avatar: 'ON', color: '#16a34a' },
  { id: 'patrik', name: 'Patrik', avatar: 'PA', color: '#9333ea' },
  { id: 'robin', name: 'Robin', avatar: 'RO', color: '#ea580c' },
  { id: 'matej', name: 'Matej', avatar: 'MA', color: '#0891b2' },
  { id: 'honza', name: 'Honza', avatar: 'HO', color: '#65a30d' },
];

export const SPEAKER_ALLOCATED_SECONDS = 420;

export function getMemberById(id: string): TeamMember | undefined {
  return TEAM.find((m) => m.id === id);
}

export function getMemberName(id: string): string {
  return getMemberById(id)?.name ?? id;
}
