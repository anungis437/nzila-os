/**
 * Field Notes List Page
 * 
 * Organizer CRM - View and create field notes about member interactions
 * 
 * Phase 4: Communications & Organizing - Organizer Workflows UI
 */

'use client';


export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  PlusCircle,
  Search,
  Calendar,
  FileText,
  AlertCircle,
  CheckCircle,
  Smile,
  Meh,
  Frown,
} from 'lucide-react';
import { format } from 'date-fns';
import { logger } from '@/lib/logger';

interface FieldNote {
  id: string;
  memberId: string;
  authorId: string;
  noteType: 'contact' | 'grievance' | 'organizing' | 'meeting' | 'personal' | 'workplace' | 'follow_up';
  subject: string | null;
  content: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'concerned' | 'engaged' | 'disengaged' | null;
  engagementLevel: number | null;
  followUpDate: string | null;
  followUpCompleted: boolean;
  interactionDate: string;
  tags: string[];
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}

const noteTypeLabels: Record<string, string> = {
  contact: 'Contact',
  grievance: 'Grievance',
  organizing: 'Organizing',
  meeting: 'Meeting',
  personal: 'Personal',
  workplace: 'Workplace',
  follow_up: 'Follow-up',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sentimentIcons: Record<string, any> = {
  positive: <Smile className="h-4 w-4 text-green-600" />,
  neutral: <Meh className="h-4 w-4 text-gray-600" />,
  negative: <Frown className="h-4 w-4 text-red-600" />,
  concerned: <AlertCircle className="h-4 w-4 text-orange-600" />,
  engaged: <Smile className="h-4 w-4 text-blue-600" />,
  disengaged: <Meh className="h-4 w-4 text-gray-400" />,
};

export default function FieldNotesPage() {
  const router = useRouter();
  const [notes, setNotes] = useState<FieldNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [search, setSearch] = useState('');
  const [noteTypeFilter, setNoteTypeFilter] = useState<string>('all');
  const [sentimentFilter, setSentimentFilter] = useState<string>('all');
  const [showFollowUps, setShowFollowUps] = useState(false);

  useEffect(() => {
    fetchNotes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteTypeFilter, sentimentFilter, showFollowUps]);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query parameters
      const params = new URLSearchParams();
      if (noteTypeFilter !== 'all') params.append('noteType', noteTypeFilter);
      if (sentimentFilter !== 'all') params.append('sentiment', sentimentFilter);
      if (showFollowUps) params.append('followUpPending', 'true');
      if (search) params.append('search', search);

      const response = await fetch(`/api/organizing/notes?${params}`, {
        headers: {
          'x-organization-id': localStorage.getItem('organizationId') || '',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch field notes');
      }

      const data = await response.json();
      setNotes(data.notes);
    } catch (err) {
      logger.error('Error fetching notes:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch notes');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchNotes();
  };

  const getNoteTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      contact: 'bg-blue-100 text-blue-700',
      grievance: 'bg-red-100 text-red-700',
      organizing: 'bg-purple-100 text-purple-700',
      meeting: 'bg-green-100 text-green-700',
      personal: 'bg-orange-100 text-orange-700',
      workplace: 'bg-yellow-100 text-yellow-700',
      follow_up: 'bg-gray-100 text-gray-700',
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Field Notes</h1>
          <p className="text-gray-600 mt-1">Track member interactions and relationships</p>
        </div>
        <Button onClick={() => router.push('/dashboard/organizing/notes/new')}>
          <PlusCircle className="mr-2 h-4 w-4" />
          New Note
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="flex space-x-2">
              <Input
                placeholder="Search notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button variant="outline" onClick={handleSearch}>
                <Search className="h-4 w-4" />
              </Button>
            </div>

            {/* Note Type Filter */}
            <Select value={noteTypeFilter} onValueChange={setNoteTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Note Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="contact">Contact</SelectItem>
                <SelectItem value="grievance">Grievance</SelectItem>
                <SelectItem value="organizing">Organizing</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="personal">Personal</SelectItem>
                <SelectItem value="workplace">Workplace</SelectItem>
                <SelectItem value="follow_up">Follow-up</SelectItem>
              </SelectContent>
            </Select>

            {/* Sentiment Filter */}
            <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Sentiment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sentiments</SelectItem>
                <SelectItem value="positive">Positive</SelectItem>
                <SelectItem value="neutral">Neutral</SelectItem>
                <SelectItem value="negative">Negative</SelectItem>
                <SelectItem value="concerned">Concerned</SelectItem>
                <SelectItem value="engaged">Engaged</SelectItem>
                <SelectItem value="disengaged">Disengaged</SelectItem>
              </SelectContent>
            </Select>

            {/* Follow-ups Toggle */}
            <Button
              variant={showFollowUps ? 'default' : 'outline'}
              onClick={() => setShowFollowUps(!showFollowUps)}
            >
              <AlertCircle className="mr-2 h-4 w-4" />
              {showFollowUps ? 'Showing' : 'Show'} Follow-ups
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Notes List */}
      {loading ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-gray-500">Loading notes...</p>
          </CardContent>
        </Card>
      ) : notes.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No notes found</h3>
            <p className="text-gray-600 mb-4">
              Start tracking member interactions by creating your first field note.
            </p>
            <Button onClick={() => router.push('/dashboard/organizing/notes/new')}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Create First Note
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => (
            <Card 
              key={note.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => router.push(`/dashboard/organizing/notes/${note.id}`)}
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <Badge className={getNoteTypeColor(note.noteType)}>
                        {noteTypeLabels[note.noteType]}
                      </Badge>
                      {note.sentiment && sentimentIcons[note.sentiment]}
                      {note.isPrivate && (
                        <Badge variant="outline" className="text-xs">
                          Private
                        </Badge>
                      )}
                      {note.followUpDate && !note.followUpCompleted && (
                        <Badge variant="destructive" className="text-xs">
                          Follow-up Due
                        </Badge>
                      )}
                      {note.followUpCompleted && (
                        <Badge variant="outline" className="text-xs">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Followed Up
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-lg">
                      {note.subject || 'Untitled Note'}
                    </CardTitle>
                    <CardDescription className="mt-2 line-clamp-2">
                      {note.content}
                    </CardDescription>
                  </div>
                  {note.engagementLevel && (
                    <div className="ml-4 text-right">
                      <p className="text-sm text-gray-600">Engagement</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {note.engagementLevel}/5
                      </p>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                      <Calendar className="mr-1 h-4 w-4" />
                      {format(new Date(note.interactionDate), 'MMM d, yyyy')}
                    </div>
                    {note.followUpDate && !note.followUpCompleted && (
                      <div className="flex items-center text-red-600">
                        <AlertCircle className="mr-1 h-4 w-4" />
                        Follow-up: {format(new Date(note.followUpDate), 'MMM d, yyyy')}
                      </div>
                    )}
                  </div>
                  {note.tags && note.tags.length > 0 && (
                    <div className="flex space-x-1">
                      {note.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {note.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{note.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
