'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { isRecord, ApiShapeError } from '@/lib/client/api-envelope';
import { Button } from '@/components/ui/button';

interface Profile { id: string; userId: string; specialization: string | null; maxCaseload: number; openCases: number; active: boolean }
interface Person { userId: string; label: string }
function readProfile(value: unknown): Profile {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.userId !== 'string' ||
    !(value.specialization === null || typeof value.specialization === 'string') || typeof value.maxCaseload !== 'number' ||
    typeof value.openCases !== 'number' || !Number.isInteger(value.maxCaseload) || !Number.isInteger(value.openCases) || value.openCases < 0 || typeof value.active !== 'boolean') throw new ApiShapeError('matching profile');
  return { id: value.id, userId: value.userId, specialization: value.specialization, maxCaseload: value.maxCaseload, openCases: value.openCases, active: value.active };
}
function readRepresentative(value: unknown): Person {
  if (!isRecord(value) || typeof value.userId !== 'string' || typeof value.label !== 'string') throw new ApiShapeError('representative');
  return { userId: value.userId, label: value.label };
}
const labels: Record<string, [string, string]> = {
  general: ['General practice', 'Pratique générale'], safety: ['Workplace safety', 'Santé et sécurité'],
  discipline: ['Discipline', 'Discipline'], scheduling: ['Scheduling', 'Horaires'], pay: ['Pay', 'Rémunération'],
  benefits: ['Benefits', 'Avantages sociaux'], leave: ['Leave', 'Congés'], harassment: ['Harassment', 'Harcèlement'],
  discrimination: ['Discrimination', 'Discrimination'], contract: ['Contract', 'Convention'], termination: ['Termination', 'Congédiement'],
  retaliation: ['Retaliation', 'Représailles'], seniority: ['Seniority', 'Ancienneté'], policy: ['Policy', 'Politique'], other: ['Other', 'Autre'],
};

export default function RepresentativeMatchingProfiles() {
  const fr = useLocale().startsWith('fr');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [userId, setUserId] = useState('');
  const [specialization, setSpecialization] = useState('general');
  const [maxCaseload, setMaxCaseload] = useState(10);
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [problem, setProblem] = useState(false);
  const [saved, setSaved] = useState(false);
  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/assignment-profiles');
      const data: unknown = await response.json();
      if (!response.ok || !isRecord(data) || !Array.isArray(data.profiles) || !Array.isArray(data.representatives) || !Array.isArray(data.specializations)) throw new ApiShapeError('matching profile lists');
      const rows = data.profiles.map(readProfile);
      const representatives = data.representatives.map(readRepresentative);
      const expertise = data.specializations.map((value: unknown) => { if (typeof value !== 'string') throw new ApiShapeError('expertise'); return value; });
      setProfiles(rows); setPeople(representatives); setSpecializations(expertise); setProblem(false); setLoaded(true);
    } catch { setProblem(true); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const choose = (value: string) => {
    setUserId(value); setSaved(false);
    const profile = profiles.find(item => item.userId === value);
    setSpecialization(profile?.specialization ?? 'general'); setMaxCaseload(profile?.maxCaseload ?? 10); setActive(profile?.active ?? true);
  };
  const save = async () => {
    setBusy(true); setSaved(false); setProblem(false);
    try {
      const response = await fetch('/api/assignment-profiles', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, specialization, maxCaseload, active }) });
      if (!response.ok) throw new Error();
      const result = readProfile(await response.json());
      if (result.userId !== userId || result.specialization !== specialization || result.maxCaseload !== maxCaseload || result.active !== active) throw new ApiShapeError('saved matching profile');
      setSaved(true); await load();
    } catch { setProblem(true); } finally { setBusy(false); }
  };
  return <section className="mx-auto max-w-4xl space-y-4 border-t p-4 sm:p-6">
    <h2 className="text-xl font-semibold">{fr ? 'Profils d’attribution' : 'Assignment matching profiles'}</h2>
    <p>{fr ? 'Définissez l’expertise et le nombre maximal de dossiers ouverts pour guider l’attribution. La charge affichée provient des dossiers ouverts effectivement attribués.' : 'Set expertise and maximum open cases to guide assignment. Displayed workload comes from actual open case assignments.'}</p>
    {problem && <p role="alert" className="text-destructive">{fr ? 'Impossible de lire ou d’enregistrer les profils. Actualisez, puis vérifiez la capacité et le rôle du représentant.' : 'Profiles could not be loaded or saved. Refresh, then check capacity and the representative’s role.'}</p>}
    {saved && !problem && <p role="status">{fr ? 'Profil enregistré.' : 'Profile saved.'}</p>}
    <Button variant="outline" disabled={busy} onClick={() => void load()}>{fr ? 'Actualiser les profils' : 'Refresh profiles'}</Button>
    {loaded && <form className="flex flex-wrap items-end gap-4" onSubmit={event => { event.preventDefault(); void save(); }}>
      <label>{fr ? 'Représentant' : 'Representative'}<select className="block min-h-10 max-w-full rounded border p-2" required value={userId} onChange={event => choose(event.target.value)}>
        <option value="">{fr ? 'Choisir' : 'Choose'}</option>
        {people.map(person => <option key={person.userId} value={person.userId}>{person.label}</option>)}
        {userId && !people.some(person => person.userId === userId) && <option value={userId}>{fr ? 'Représentant indisponible' : 'Unavailable representative'}</option>}
      </select></label>
      <label>{fr ? 'Expertise' : 'Expertise'}<select className="block min-h-10 rounded border p-2" value={specialization} onChange={event => setSpecialization(event.target.value)}>
        {specializations.map(value => <option key={value} value={value}>{labels[value]?.[fr ? 1 : 0] ?? value}</option>)}
        {!specializations.includes(specialization) && <option value={specialization} disabled>{specialization}</option>}
      </select></label>
      <label>{fr ? 'Maximum de dossiers ouverts' : 'Maximum open cases'}<input className="block min-h-10 w-28 rounded border p-2" type="number" min={1} max={1000} required value={maxCaseload} onChange={event => setMaxCaseload(Number(event.target.value))} /></label>
      <label className="flex gap-2"><input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)} />{fr ? 'Disponible' : 'Available'}</label>
      <Button type="submit" disabled={busy || !userId || !specializations.includes(specialization)}>{fr ? 'Enregistrer le profil' : 'Save profile'}</Button>
    </form>}
    <ul className="space-y-2">{profiles.map(profile => <li key={profile.id} className="flex flex-wrap items-center justify-between gap-3 rounded border p-3">
      <div className="min-w-0 break-words"><p>{people.find(person => person.userId === profile.userId)?.label ?? (fr ? 'Représentant indisponible' : 'Unavailable representative')}</p>
        <p>{labels[profile.specialization ?? '']?.[fr ? 1 : 0] ?? profile.specialization ?? (fr ? 'Expertise non renseignée' : 'Expertise not recorded')} · {profile.openCases}/{profile.maxCaseload} · {profile.active ? (fr ? 'Disponible' : 'Available') : (fr ? 'Indisponible' : 'Unavailable')}</p></div>
      <Button variant="outline" disabled={busy} onClick={() => choose(profile.userId)}>{fr ? 'Modifier' : 'Edit'}</Button>
    </li>)}</ul>
  </section>;
}
