/**
 * Case Detail Page
 * 
 * Comprehensive case view with timeline, evidence, and actions
 */

'use client';


export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { logger } from '@/lib/logger';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api/index';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  FileText,
  User,
  Calendar,
  AlertCircle,
  Upload,
  Download,
  Edit,
  MessageSquare,
  CheckCircle,
} from 'lucide-react';

interface CaseDetail {
  id: string;
  caseNumber: string;
  memberName: string;
  memberId: string;
  type: string;
  status: string;
  priority: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  deadline: string | null;
  assignedTo: string;
  assignedToId: string;
}

interface TimelineEvent {
  id: string;
  timestamp: string;
  type: string;
  description: string;
  actor: string;
}

interface Evidence {
  id: string;
  fileName: string;
  fileType: string;
  uploadedAt: string;
  uploadedBy: string;
  size: number;
}

export default function CaseDetailPage({ params }: { params: { id: string } }) {
  const _router = useRouter();
  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCaseDetail();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const fetchCaseDetail = async () => {
    try {
      const [caseData, timelineData, evidenceData] = await Promise.all([
        api.cases.get(params.id),
        api.cases.timeline(params.id),
        api.cases.evidence.list(params.id),
      ]);
      
      setCaseDetail(caseData as CaseDetail);
      setTimeline(timelineData as TimelineEvent[]);
      setEvidence(evidenceData as Evidence[]);
    } catch (error) {
      logger.error('Error fetching case', error);
    } finally {
      setLoading(false);
    }
  };

  const addNote = async () => {
    if (!note.trim()) return;

    try {
      await api.cases.notes.create(params.id, note);
      setNote('');
      // Refresh timeline to show new note
      const timelineData = await api.cases.timeline(params.id);
      setTimeline(timelineData as TimelineEvent[]);
    } catch (error) {
      logger.error('Error adding note', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'investigation':
        return 'bg-blue-100 text-blue-800';
      case 'mediation':
        return 'bg-yellow-100 text-yellow-800';
      case 'arbitration':
        return 'bg-purple-100 text-purple-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading || !caseDetail) {
    return <div className="container mx-auto py-6">Loading...</div>;
  }

  const isOverdue = caseDetail.deadline && new Date(caseDetail.deadline) < new Date();

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <span>Cases</span>
          <span>/</span>
          <span>{caseDetail.caseNumber}</span>
        </div>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">{caseDetail.caseNumber}</h1>
            <p className="text-muted-foreground mt-1">
              {caseDetail.type.replace('_', ' ')} • Opened {new Date(caseDetail.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* Key Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Member</span>
          </div>
          <p className="font-medium">{caseDetail.memberName}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Status</span>
          </div>
          <Badge className={getStatusColor(caseDetail.status)}>
            {caseDetail.status}
          </Badge>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Priority</span>
          </div>
          <Badge className={getPriorityColor(caseDetail.priority)}>
            {caseDetail.priority}
          </Badge>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Deadline</span>
          </div>
          <p className={`font-medium ${isOverdue ? 'text-red-600' : ''}`}>
            {caseDetail.deadline ? new Date(caseDetail.deadline).toLocaleDateString() : 'None'}
            {isOverdue && ' (Overdue)'}
          </p>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-2">Description</h3>
            <p className="text-muted-foreground">{caseDetail.description}</p>
          </Card>

          <Tabs defaultValue="timeline" className="space-y-4">
            <TabsList>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="evidence">Evidence</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="timeline">
              <Card className="p-6">
                <h3 className="font-semibold mb-4">Case Timeline</h3>
                <div className="space-y-4">
                  {timeline.map((event) => (
                    <div key={event.id} className="flex gap-4 relative">
                      <div className="flex flex-col items-center">
                        <div className="h-3 w-3 rounded-full bg-primary" />
                        {event.id !== timeline[timeline.length - 1].id && (
                          <div className="h-full w-px bg-border mt-1" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{event.description}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(event.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">by {event.actor}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="evidence">
              <Card>
                <div className="p-6 border-b">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold">Evidence Locker</h3>
                    <Button size="sm">
                      <Upload className="mr-2 h-4 w-4" />
                      Upload
                    </Button>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {evidence.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">{doc.fileName}</TableCell>
                        <TableCell>{doc.fileType.split('/')[1].toUpperCase()}</TableCell>
                        <TableCell>{(doc.size / 1024).toFixed(0)} KB</TableCell>
                        <TableCell>
                          {new Date(doc.uploadedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            <Download className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="notes">
              <Card className="p-6">
                <h3 className="font-semibold mb-4">Case Notes</h3>
                <div className="space-y-4">
                  <div>
                    <Textarea
                      placeholder="Add a note to this case..."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={4}
                    />
                    <Button className="mt-2" onClick={addNote}>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Add Note
                    </Button>
                  </div>
                  <div className="text-muted-foreground text-center py-8">
                    No notes yet
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Assigned To</h3>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">{caseDetail.assignedTo}</p>
                <p className="text-sm text-muted-foreground">Case Manager</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                <Calendar className="mr-2 h-4 w-4" />
                Schedule Meeting
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <FileText className="mr-2 h-4 w-4" />
                Generate Report
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <CheckCircle className="mr-2 h-4 w-4" />
                Update Status
              </Button>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-3">Case Statistics</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Days Open:</dt>
                <dd className="font-medium">
                  {Math.floor((Date.now() - new Date(caseDetail.createdAt).getTime()) / (1000 * 60 * 60 * 24))}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Evidence Items:</dt>
                <dd className="font-medium">{evidence.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Timeline Events:</dt>
                <dd className="font-medium">{timeline.length}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
