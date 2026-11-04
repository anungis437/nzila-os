/**
 * Calendar Sync Manager
 *
 * Lists the external (Google, Outlook) calendar connections the signed-in user already has, and lets them disconnect one.
 *
 * Synchronizing is not available in this release (UE-ACTION-CALENDAR-SYNC): the OAuth callbacks create a connection with no calendar mapping, no
 * route lists a provider's calendars or stores a mapping, and the scheduled job answers "No calendar mappings configured" for every connection, so
 * "Sync now" had nothing to send. The dialog therefore offers no way to connect another account, to sync, or to set sync options, and says so; it
 * keeps disconnecting, which deletes the access stored here and asks the provider to revoke it.
 *
 * @module components/calendar/CalendarSyncManager
 */

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { Cloud, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CapabilityUnavailable } from '@/components/system/capability-unavailable';
import { logger } from '@/lib/logger';
import { ApiShapeError, envelopeData, readApiError } from '@/lib/client/api-envelope';
import { asRecord, optionalString, requiredString } from '@/lib/client/row-fields';

const COPY = {
  en: {
    title: 'Calendar Sync',
    description: 'External calendars you connected earlier.',
    reason:
      'Connecting a Google or Outlook calendar is turned off in this release: no calendar can be chosen to synchronize, so nothing would be synchronized. You can still disconnect a calendar you connected earlier, which removes the access stored here.',
    loading: 'Loading connected calendars…',
    loadFailed: 'Connected calendars could not be loaded.',
    retry: 'Try again',
    none: 'No external calendars are connected.',
    connectedOn: 'Connected on {date}',
    disconnect: 'Disconnect',
    disconnectConfirm: 'Disconnect {account}? The access stored here is removed.',
    cancel: 'Cancel',
    disconnectFailed: 'The calendar could not be disconnected.',
    calendarOf: { google: 'Google Calendar', microsoft: 'Outlook Calendar' },
    providerName: { google: 'Google', microsoft: 'Microsoft' },
    revoked: 'Disconnected. Access was revoked at {provider}.',
    notSupported: 'Disconnected here. {provider} cannot be asked to revoke access from this app; remove this app in your {provider} account settings to finish.',
    unconfirmed: 'Disconnected here, but {provider} did not confirm that access was revoked. Check the permissions in your {provider} account.',
  },
  fr: {
    title: 'Synchronisation du calendrier',
    description: 'Calendriers externes que vous avez connectés auparavant.',
    reason:
      'La connexion d’un calendrier Google ou Outlook est désactivée dans cette version : aucun calendrier ne peut être choisi pour la synchronisation, donc rien ne serait synchronisé. Vous pouvez toujours déconnecter un calendrier connecté auparavant, ce qui supprime l’accès enregistré ici.',
    loading: 'Chargement des calendriers connectés…',
    loadFailed: 'Les calendriers connectés n’ont pas pu être chargés.',
    retry: 'Réessayer',
    none: 'Aucun calendrier externe n’est connecté.',
    connectedOn: 'Connecté le {date}',
    disconnect: 'Déconnecter',
    disconnectConfirm: 'Déconnecter {account} ? L’accès enregistré ici est supprimé.',
    cancel: 'Annuler',
    disconnectFailed: 'Le calendrier n’a pas pu être déconnecté.',
    calendarOf: { google: 'Calendrier Google', microsoft: 'Calendrier Outlook' },
    providerName: { google: 'Google', microsoft: 'Microsoft' },
    revoked: 'Déconnecté. L’accès a été révoqué chez {provider}.',
    notSupported: 'Déconnecté ici. {provider} ne peut pas être invité à révoquer l’accès depuis cette application ; retirez cette application dans les paramètres de votre compte {provider} pour terminer.',
    unconfirmed: 'Déconnecté ici, mais {provider} n’a pas confirmé la révocation de l’accès. Vérifiez les autorisations dans votre compte {provider}.',
  },
} as const;

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);

/** A connection of GET /api/calendar-sync/connections: the stored account, never a credential. */
interface Connection {
  id: string;
  provider: string;
  account: string;
  connectedAt: string;
}

type Loaded = { status: 'loading' } | { status: 'ready'; connections: Connection[] } | { status: 'error'; message: string | null };
type Outcome = { tone: 'ok' | 'warn' | 'error'; text: string };

function connectionFrom(value: unknown): Connection {
  const row = asRecord(value, 'connection');
  const connectedAt = requiredString(row, 'createdAt');
  if (Number.isNaN(new Date(connectedAt).getTime())) throw new ApiShapeError('createdAt is not a date');
  return {
    id: requiredString(row, 'id'),
    provider: requiredString(row, 'provider'),
    account: optionalString(row, 'providerEmail') ?? requiredString(row, 'providerAccountId'),
    connectedAt,
  };
}

async function readConnections(): Promise<Connection[]> {
  const response = await fetch('/api/calendar-sync/connections');
  if (!response.ok) throw new Error(await readApiError(response, ''));
  const connections = envelopeData(await response.json()).connections;
  if (!Array.isArray(connections)) throw new ApiShapeError('no connections');
  return connections.map(connectionFrom);
}

/** The server's own message when it gave one, else null (the caller words the failure in the reader's language). */
const serverMessage = (err: unknown) => (err instanceof Error && !(err instanceof ApiShapeError) && err.message ? err.message : null);

interface CalendarSyncManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CalendarSyncManager({ open, onOpenChange }: CalendarSyncManagerProps) {
  const locale = useLocale();
  const copy = locale.toLowerCase().startsWith('fr') ? COPY.fr : COPY.en;
  const [state, setState] = useState<Loaded>({ status: 'loading' });
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useEffect(() => {
    if (!open) return;
    let current = true;
    readConnections().then(
      (connections) => {
        if (current) setState({ status: 'ready', connections });
      },
      (err: unknown) => {
        logger.error('Failed to read the calendar connections', err);
        if (current) setState({ status: 'error', message: serverMessage(err) });
      },
    );
    return () => {
      current = false;
    };
  }, [open]);

  const reload = useCallback(async () => {
    try {
      setState({ status: 'ready', connections: await readConnections() });
    } catch (err) {
      logger.error('Failed to read the calendar connections', err);
      setState({ status: 'error', message: serverMessage(err) });
    }
  }, []);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setState({ status: 'loading' });
      setConfirming(null);
      setOutcome(null);
    }
    onOpenChange(next);
  };

  const revocationOutcome = (connection: Connection, revocation: unknown): Outcome => {
    const provider = connection.provider === 'google' || connection.provider === 'microsoft' ? copy.providerName[connection.provider] : connection.provider;
    if (revocation === 'revoked') return { tone: 'ok', text: fill(copy.revoked, { provider }) };
    if (revocation === 'not_supported') return { tone: 'warn', text: fill(copy.notSupported, { provider }) };
    return { tone: 'warn', text: fill(copy.unconfirmed, { provider }) };
  };

  const disconnect = async (connection: Connection) => {
    setBusy(true);
    setOutcome(null);
    try {
      const response = await fetch(`/api/calendar-sync/connections/${connection.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await readApiError(response, ''));
      // The connection is gone once the route says so; an answer that cannot be read only leaves the provider's revocation unconfirmed.
      let revocation: unknown = null;
      try {
        revocation = envelopeData(await response.json()).providerRevocation;
      } catch (err) {
        logger.error('The disconnect answer could not be read', err);
      }
      setConfirming(null);
      setOutcome(revocationOutcome(connection, revocation));
      await reload();
    } catch (err) {
      setOutcome({ tone: 'error', text: serverMessage(err) ?? copy.disconnectFailed });
    } finally {
      setBusy(false);
    }
  };

  const calendarName = (provider: string) => (provider === 'google' || provider === 'microsoft' ? copy.calendarOf[provider] : provider);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <CapabilityUnavailable locale={locale} capability="UE-ACTION-CALENDAR-SYNC" />
          <p className="text-sm text-muted-foreground">{copy.reason}</p>

          {outcome && (
            <p
              role={outcome.tone === 'error' ? 'alert' : 'status'}
              className={`rounded-md border p-3 text-sm ${outcome.tone === 'error' ? 'border-destructive/40 text-destructive' : ''}`}
            >
              {outcome.text}
            </p>
          )}

          {state.status === 'loading' && <p role="status" className="py-6 text-center text-muted-foreground">{copy.loading}</p>}

          {state.status === 'error' && (
            <div role="alert" className="rounded-md border border-destructive/40 p-3 text-sm">
              <p>{state.message ?? copy.loadFailed}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setState({ status: 'loading' });
                  void reload();
                }}
              >
                {copy.retry}
              </Button>
            </div>
          )}

          {state.status === 'ready' && state.connections.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">
              <Cloud className="mx-auto mb-3 h-10 w-10 opacity-50" aria-hidden />
              <p>{copy.none}</p>
            </div>
          )}

          {state.status === 'ready' && state.connections.length > 0 && (
            <ul className="space-y-3">
              {state.connections.map((connection) => (
                <li key={connection.id} className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{calendarName(connection.provider)}</p>
                      <p className="truncate text-xs text-muted-foreground">{connection.account}</p>
                      <p className="text-xs text-muted-foreground">
                        {fill(copy.connectedOn, { date: new Date(connection.connectedAt).toLocaleDateString(locale, { dateStyle: 'medium' }) })}
                      </p>
                    </div>
                    {confirming !== connection.id && (
                      <Button variant="outline" size="sm" disabled={busy} onClick={() => setConfirming(connection.id)}>
                        <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                        {copy.disconnect}
                      </Button>
                    )}
                  </div>
                  {confirming === connection.id && (
                    <div role="group" aria-label={copy.disconnect} className="space-y-2 rounded-md border border-destructive/40 p-3 text-sm">
                      <p>{fill(copy.disconnectConfirm, { account: connection.account })}</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="destructive" disabled={busy} onClick={() => void disconnect(connection)}>
                          {copy.disconnect}
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirming(null)}>
                          {copy.cancel}
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
