'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AwardTypeSelector } from './award-type-selector';
import { Award, Search, Users } from 'lucide-react';
import { createAward } from '@/actions/rewards-actions';
import type { RecognitionAwardType } from '@/db/schema/recognition-rewards-schema';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface PeerNominationFormProps {
  awardTypes: RecognitionAwardType[];
  organizationMembers: {
    userId: string;
    name: string;
    email: string;
    avatar?: string;
    role: string;
  }[];
  currentUserId: string;
  onSuccess?: () => void;
}

export function PeerNominationForm({
  awardTypes,
  organizationMembers,
  currentUserId,
  onSuccess,
}: PeerNominationFormProps) {
  const t = useTranslations('rewards.peer');
  const router = useRouter();
  const [awardTypeId, setAwardTypeId] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Filter out current user and only show peer-recognition enabled award types
  const eligibleMembers = organizationMembers.filter((m) => m.userId !== currentUserId);
  const peerAwardTypes = awardTypes.filter((t) => t.kind === 'peer');

  const selectedRecipient = eligibleMembers.find((m) => m.userId === recipientId);
  const selectedAwardType = peerAwardTypes.find((t) => t.id === awardTypeId);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!awardTypeId || !recipientId || !message.trim()) {
      setError(t('validation.allFieldsRequired'));
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const result = await createAward({
        award_type_id: awardTypeId,
        recipient_user_id: recipientId,
        message: message.trim(),
        credits_to_award: selectedAwardType?.defaultCreditAmount,
      });

      if (result.success) {
        setSuccess(true);
        setMessage('');
        setRecipientId('');
        setAwardTypeId('');
        
        setTimeout(() => {
          if (onSuccess) {
            onSuccess();
          } else {
            router.push('/dashboard/rewards');
          }
        }, 2000);
      } else {
        setError(result.error || t('error.submit'));
      }
    } catch (err) {
      setError(err.message || t('error.submit'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (peerAwardTypes.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          {t('noPeerAwards')}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" />
          {t('title')}
        </CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Recipient Selection */}
          <div className="space-y-2">
            <Label htmlFor="recipient">
              {t('recipient')}
              <span className="text-red-500 ml-1">*</span>
            </Label>
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                >
                  {selectedRecipient ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={selectedRecipient.avatar} />
                        <AvatarFallback className="text-xs">
                          {getInitials(selectedRecipient.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{selectedRecipient.name}</span>
                    </div>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {t('selectRecipient')}
                    </span>
                  )}
                  <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder={t('searchMembers')} />
                  <CommandEmpty>{t('noMembers')}</CommandEmpty>
                  <CommandGroup className="max-h-64 overflow-auto">
                    {eligibleMembers.map((member) => (
                      <CommandItem
                        key={member.userId}
                        value={member.name}
                        onSelect={() => {
                          setRecipientId(member.userId);
                          setSearchOpen(false);
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={member.avatar} />
                            <AvatarFallback className="text-xs">
                              {getInitials(member.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{member.name}</p>
                            <p className="text-xs text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Award Type Selection */}
          <AwardTypeSelector
            awardTypes={peerAwardTypes}
            value={awardTypeId}
            onChange={setAwardTypeId}
            required
            label={t('awardType')}
          />

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">
              {t('message')}
              <span className="text-red-500 ml-1">*</span>
            </Label>
            <Textarea
              id="message"
              placeholder={t('messagePlaceholder')}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              maxLength={500}
              required
            />
            <p className="text-xs text-muted-foreground text-right">
              {message.length}/500
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success Alert */}
          {success && (
            <Alert>
              <AlertDescription className="text-green-600">
                {t('success')}
              </AlertDescription>
            </Alert>
          )}

          {/* Submit Button */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !awardTypeId || !recipientId || !message.trim()}
            >
              {isSubmitting ? t('submitting') : t('submit')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

