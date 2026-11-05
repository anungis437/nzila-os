'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, ApiRequestError } from '@/lib/api/index';
import { electionCopy } from './election-copy';
import { electionPaths } from './election-records';

interface CandidateDraft {
  name: string;
  union: string;
  platform: string;
}

const emptyCandidate = (): CandidateDraft => ({ name: '', union: '', platform: '' });

/**
 * Creates a council election record through POST /api/elections. The record starts with no winners, zero votes and an
 * uncontested result (the route's defaults); this form does not open voting and says so.
 */
export function ElectionRecordForm() {
  const router = useRouter();
  const locale = useLocale();
  const allCopy = electionCopy(locale);
  const copy = allCopy.form;
  const paths = electionPaths(locale);
  const currentYear = new Date().getFullYear();

  const [year, setYear] = useState(String(currentYear));
  const [date, setDate] = useState('');
  const [positions, setPositions] = useState('2');
  const [candidates, setCandidates] = useState<CandidateDraft[]>([emptyCandidate()]);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const updateCandidate = (index: number, field: keyof CandidateDraft, value: string) =>
    setCandidates((current) => current.map((candidate, i) => (i === index ? { ...candidate, [field]: value } : candidate)));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const electionYear = Number(year);
    const positionsAvailable = Number(positions);
    if (
      year.trim() === '' ||
      positions.trim() === '' ||
      !Number.isInteger(electionYear) ||
      !Number.isInteger(positionsAvailable) ||
      positionsAvailable < 1 ||
      date === ''
    ) {
      setFailure(copy.invalid);
      return;
    }

    setSubmitting(true);
    setFailure(null);
    try {
      await api.elections.create({
        electionYear,
        electionDate: date,
        positionsAvailable,
        candidates: candidates
          .map((candidate) => ({
            name: candidate.name.trim(),
            union: candidate.union.trim(),
            platform: candidate.platform.trim(),
          }))
          .filter((candidate) => candidate.name !== ''),
      });
      router.push(paths.list);
    } catch (error) {
      setFailure(error instanceof ApiRequestError && error.status === 403 ? copy.forbidden : copy.createFailed);
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href={paths.list} aria-label={allCopy.detail.back}>
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{copy.title}</h1>
          <p className="text-muted-foreground">{copy.subtitle}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">{copy.details}</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="electionYear">{copy.year}</Label>
              <Input
                id="electionYear"
                type="number"
                min={currentYear}
                max={currentYear + 5}
                value={year}
                onChange={(event) => setYear(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="positionsAvailable">{copy.positions}</Label>
              <Input
                id="positionsAvailable"
                type="number"
                min={1}
                max={5}
                value={positions}
                onChange={(event) => setPositions(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="electionDate">{copy.date}</Label>
            <Input
              id="electionDate"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">{copy.candidates}</h2>
            <Button type="button" variant="outline" size="sm" onClick={() => setCandidates((current) => [...current, emptyCandidate()])}>
              <Plus aria-hidden="true" className="h-4 w-4 mr-1" />
              {copy.add}
            </Button>
          </div>

          {candidates.map((candidate, index) => (
            <div key={index} className="border rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">
                  {copy.candidate} {index + 1}
                </span>
                {candidates.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`${copy.remove} ${index + 1}`}
                    onClick={() => setCandidates((current) => current.filter((_, i) => i !== index))}
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4 text-red-500" />
                  </Button>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor={`candidate-${index}-name`}>{copy.name}</Label>
                  <Input
                    id={`candidate-${index}-name`}
                    value={candidate.name}
                    onChange={(event) => updateCandidate(index, 'name', event.target.value)}
                    placeholder={copy.namePlaceholder}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`candidate-${index}-union`}>{copy.union}</Label>
                  <Input
                    id={`candidate-${index}-union`}
                    value={candidate.union}
                    onChange={(event) => updateCandidate(index, 'union', event.target.value)}
                    placeholder={copy.unionPlaceholder}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor={`candidate-${index}-platform`}>{copy.platform}</Label>
                <Input
                  id={`candidate-${index}-platform`}
                  value={candidate.platform}
                  onChange={(event) => updateCandidate(index, 'platform', event.target.value)}
                  placeholder={copy.platformPlaceholder}
                />
              </div>
            </div>
          ))}
        </Card>

        {failure ? (
          <Alert variant="destructive">
            <AlertDescription>{failure}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex gap-3 justify-end">
          <Button asChild variant="outline">
            <Link href={paths.list}>{copy.cancel}</Link>
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? copy.submitting : copy.submit}
          </Button>
        </div>
      </form>
    </div>
  );
}
