/**
 * Create New Election Page
 *
 * Schedule a new council election with candidate nominations.
 */

'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { logger } from '@/lib/logger';
import { api } from '@/lib/api/index';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface Candidate {
  name: string;
  union: string;
  platform: string;
}

export default function CreateElectionPage() {
  const router = useRouter();
  const t = useTranslations('elections');
  const [submitting, setSubmitting] = useState(false);

  const currentYear = new Date().getFullYear();
  const [form, setForm] = useState({
    electionYear: currentYear,
    electionDate: '',
    positionsAvailable: 2,
  });
  const [candidates, setCandidates] = useState<Candidate[]>([
    { name: '', union: '', platform: '' },
  ]);

  const addCandidate = () =>
    setCandidates(prev => [...prev, { name: '', union: '', platform: '' }]);

  const removeCandidate = (idx: number) =>
    setCandidates(prev => prev.filter((_, i) => i !== idx));

  const updateCandidate = (idx: number, field: keyof Candidate, value: string) =>
    setCandidates(prev =>
      prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)),
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.electionDate) return;

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        candidates: candidates.filter(c => c.name.trim()),
        winners: [],
        totalVotes: 0,
        contestedResults: false,
      };
      await api.elections.create(payload);
      router.push('/elections');
    } catch (error) {
      logger.error('Error creating election', error);
      alert(t('createError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{t('createElection')}</h1>
          <p className="text-muted-foreground">{t('createElectionSubtitle')}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Election Details */}
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">{t('electionDetails')}</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="electionYear">{t('electionYear')}</Label>
              <Input
                id="electionYear"
                type="number"
                min={currentYear}
                max={currentYear + 5}
                value={form.electionYear}
                onChange={e =>
                  setForm(prev => ({ ...prev, electionYear: parseInt(e.target.value, 10) }))
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="positionsAvailable">{t('positionsAvailable')}</Label>
              <Input
                id="positionsAvailable"
                type="number"
                min={1}
                max={5}
                value={form.positionsAvailable}
                onChange={e =>
                  setForm(prev => ({
                    ...prev,
                    positionsAvailable: parseInt(e.target.value, 10),
                  }))
                }
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="electionDate">{t('electionDate')}</Label>
            <Input
              id="electionDate"
              type="date"
              value={form.electionDate}
              onChange={e =>
                setForm(prev => ({ ...prev, electionDate: e.target.value }))
              }
              required
            />
          </div>
        </Card>

        {/* Candidates */}
        <Card className="p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">{t('candidates')}</h2>
            <Button type="button" variant="outline" size="sm" onClick={addCandidate}>
              <Plus className="h-4 w-4 mr-1" />
              {t('addCandidate')}
            </Button>
          </div>

          {candidates.map((candidate, idx) => (
            <div key={idx} className="border rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">
                  {t('candidate')} {idx + 1}
                </span>
                {candidates.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCandidate(idx)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>{t('candidateName')}</Label>
                  <Input
                    value={candidate.name}
                    onChange={e => updateCandidate(idx, 'name', e.target.value)}
                    placeholder={t('candidateNamePlaceholder')}
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t('candidateUnion')}</Label>
                  <Input
                    value={candidate.union}
                    onChange={e => updateCandidate(idx, 'union', e.target.value)}
                    placeholder={t('candidateUnionPlaceholder')}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>{t('platform')}</Label>
                <Input
                  value={candidate.platform}
                  onChange={e => updateCandidate(idx, 'platform', e.target.value)}
                  placeholder={t('platformPlaceholder')}
                />
              </div>
            </div>
          ))}
        </Card>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            {t('cancel')}
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? t('creating') : t('createElection')}
          </Button>
        </div>
      </form>
    </div>
  );
}
