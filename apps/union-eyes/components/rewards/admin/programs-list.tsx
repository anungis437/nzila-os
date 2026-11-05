'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Archive, Edit, Plus, RotateCcw } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { updateRecognitionProgram } from '@/actions/rewards-actions';
import { EditProgramDialog } from './edit-program-dialog';
import { CreateAwardTypeDialog } from './create-award-type-dialog';

export interface ProgramRow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: Date | string;
}

interface ProgramsListProps {
  programs: ProgramRow[];
}

export function ProgramsList({ programs }: ProgramsListProps) {
  const t = useTranslations('rewards.admin.programs');
  const router = useRouter();
  const [editing, setEditing] = useState<ProgramRow | null>(null);
  const [addingAwardType, setAddingAwardType] = useState<ProgramRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ id: string; message: string } | null>(null);

  async function changeStatus(program: ProgramRow, status: 'active' | 'archived') {
    setBusyId(program.id);
    setFailure(null);
    try {
      const result = await updateRecognitionProgram(program.id, { status });
      if (!(result.success && 'data' in result && result.data)) {
        setFailure({ id: program.id, message: ('error' in result && result.error) || t('list.actions.failed') });
        return;
      }
      router.refresh();
    } catch {
      setFailure({ id: program.id, message: t('list.actions.failed') });
    } finally {
      setBusyId(null);
    }
  }

  if (programs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>{t('list.empty')}</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('list.columns.name')}</TableHead>
            <TableHead>{t('list.columns.status')}</TableHead>
            <TableHead>{t('list.columns.created')}</TableHead>
            <TableHead className="text-right">{t('list.columns.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {programs.map((program) => {
            const active = program.status === 'active';
            return (
              <TableRow key={program.id}>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{program.name}</span>
                    {program.description && (
                      <span className="text-sm text-muted-foreground line-clamp-1">{program.description}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={active ? 'default' : 'secondary'}>{program.status}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{new Date(program.createdAt).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2 flex-wrap">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(program)}>
                      <Edit className="mr-2 h-4 w-4" aria-hidden="true" />
                      {t('list.actions.edit')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setAddingAwardType(program)}>
                      <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                      {t('list.actions.addAwardType')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === program.id}
                      onClick={() => changeStatus(program, active ? 'archived' : 'active')}
                    >
                      {active ? <Archive className="mr-2 h-4 w-4" aria-hidden="true" /> : <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />}
                      {active ? t('list.actions.archive') : t('list.actions.activate')}
                    </Button>
                  </div>
                  {failure?.id === program.id && (
                    <p role="alert" className="mt-2 text-sm text-destructive text-right">
                      {failure.message}
                    </p>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {editing && <EditProgramDialog key={editing.id} program={editing} onClose={() => setEditing(null)} />}
      {addingAwardType && (
        <CreateAwardTypeDialog
          key={addingAwardType.id}
          programId={addingAwardType.id}
          programName={addingAwardType.name}
          onClose={() => setAddingAwardType(null)}
        />
      )}
    </div>
  );
}
