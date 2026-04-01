/**
 * Arrears Management Page
 * 
 * View and manage members with outstanding dues
 */

'use client';


export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api/index';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, DollarSign, FileText, Mail, Phone } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { useTranslations } from 'next-intl';

interface MemberInArrears {
  id: string;
  memberName: string;
  memberId: string;
  email: string;
  phone: string;
  amountOwed: number;
  monthsBehind: number;
  lastPayment: string | null;
  status: string;
  hasPaymentPlan: boolean;
}

export default function ArrearsPage() {
  const router = useRouter();
  const t = useTranslations('dues.arrears');
  const [members, setMembers] = useState<MemberInArrears[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<MemberInArrears | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [notes, setNotes] = useState('');

  const fetchMembersInArrears = useCallback(async () => {
    try {
      const data = await api.dues.arrears.list() as unknown as { members: MemberInArrears[] };
      setMembers(data.members || []);
    } catch (error) {
      logger.error('Error fetching arrears:', error);
      alert(t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchMembersInArrears();
  }, [fetchMembersInArrears]);

  const recordPayment = async () => {
    if (!selectedMember || !paymentAmount) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (api.dues.arrears.recordPayment as any)(selectedMember.id, {
        amount: parseFloat(paymentAmount),
        notes,
      });

      alert(t('paymentSuccess'));
      setPaymentAmount('');
      setNotes('');
      setSelectedMember(null);
      fetchMembersInArrears();
    } catch (error) {
      logger.error('Error recording payment:', error);
      alert(t('paymentError'));
    }
  };

  const setupPaymentPlan = (member: MemberInArrears) => {
    router.push(`/dues/payment-plans/new?memberId=${member.memberId}&amount=${member.amountOwed}`);
  };

  const sendReminder = async (member: MemberInArrears) => {
    try {
      await api.dues.arrears.sendReminder(member.id);
      alert(t('reminderSent', { name: member.memberName }));
    } catch (error) {
      logger.error('Error sending reminder:', error);
      alert(t('reminderError'));
    }
  };

  const totalArrears = members.reduce((sum, m) => sum + m.amountOwed, 0);

  if (loading) {
    return <div className="container mx-auto py-6">{t('loading')}</div>;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t('totalArrears')}</p>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(totalArrears)}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-red-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t('membersInArrears')}</p>
              <p className="text-2xl font-bold">{members.length}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-yellow-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t('paymentPlans')}</p>
              <p className="text-2xl font-bold text-blue-600">
                {members.filter(m => m.hasPaymentPlan).length}
              </p>
            </div>
            <FileText className="h-8 w-8 text-blue-600" />
          </div>
        </Card>
      </div>

      {/* Members Table */}
      <Card>
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">{t('membersInArrears')}</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('member')}</TableHead>
              <TableHead>{t('contact')}</TableHead>
              <TableHead>{t('amountOwed')}</TableHead>
              <TableHead>{t('monthsBehind')}</TableHead>
              <TableHead>{t('lastPayment')}</TableHead>
              <TableHead>{t('status')}</TableHead>
              <TableHead>{t('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{member.memberName}</p>
                    <p className="text-sm text-muted-foreground">{member.memberId}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    <div className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {member.email}
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {member.phone}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-bold text-red-600">
                    {formatCurrency(member.amountOwed)}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="destructive">{t('monthsCount', { count: member.monthsBehind })}</Badge>
                </TableCell>
                <TableCell>
                  {member.lastPayment ? (
                    new Date(member.lastPayment).toLocaleDateString()
                  ) : (
                    <span className="text-muted-foreground">{t('never')}</span>
                  )}
                </TableCell>
                <TableCell>
                  {member.hasPaymentPlan ? (
                    <Badge className="bg-blue-100 text-blue-800">{t('hasPaymentPlan')}</Badge>
                  ) : (
                    <Badge variant="outline">{t('noPlan')}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedMember(member)}
                        >
                          {t('recordPayment')}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{t('recordPaymentTitle')}</DialogTitle>
                          <DialogDescription>
                            {t('recordPaymentDesc', { name: member.memberName })}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>{t('amountOwedLabel')}</Label>
                            <p className="text-2xl font-bold text-red-600">
                              {formatCurrency(member.amountOwed)}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="paymentAmount">{t('paymentAmount')}</Label>
                            <Input
                              id="paymentAmount"
                              type="number"
                              step="0.01"
                              value={paymentAmount}
                              onChange={(e) => setPaymentAmount(e.target.value)}
                              placeholder={t('amountPlaceholder')}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="notes">{t('notes')}</Label>
                            <Textarea
                              id="notes"
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                              placeholder={t('notesPlaceholder')}
                              rows={3}
                            />
                          </div>
                          <Button onClick={recordPayment} className="w-full">
                            {t('recordPayment')}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {!member.hasPaymentPlan && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setupPaymentPlan(member)}
                      >
                        {t('paymentPlan')}
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => sendReminder(member)}
                    >
                      {t('sendReminder')}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
