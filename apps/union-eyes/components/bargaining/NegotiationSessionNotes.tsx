/**
 * Negotiation Session Notes Integration
 * 
 * Integrates with existing bargaining-notes API to display session notes.
 */

"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";
import { Plus, FileText, Calendar, Users } from "lucide-react";
import { format } from "date-fns";
 
import Link from "next/link";

interface BargainingNote {
  id: string;
  title: string;
  content: string;
  sessionType: string;
  sessionDate: string;
  attendees?: Array<{ name: string; role: string }>;
  tags?: string[];
  confidentialityLevel: string;
  createdAt: string;
}

interface NegotiationSessionNotesProps {
  negotiationId: string;
  cbaId?: string;
}

export function NegotiationSessionNotes({ negotiationId: _negotiationId, cbaId }: NegotiationSessionNotesProps) {
  const [notes, setNotes] = useState<BargainingNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (cbaId) {
      fetchNotes();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cbaId]);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/bargaining-notes?cbaId=${cbaId}&limit=20`);
      const data = await response.json();
      setNotes(data.notes || []);
    } catch (error) {
      logger.error("Failed to fetch notes", error);
    } finally {
      setLoading(false);
    }
  };

  const sessionTypeColors: Record<string, string> = {
    negotiation: "bg-blue-500",
    ratification: "bg-green-500",
    strategy: "bg-purple-500",
    grievance_meeting: "bg-orange-500",
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Session Notes</CardTitle>
            <CardDescription>
              Detailed notes from bargaining sessions
            </CardDescription>
          </div>
          <Button size="sm" asChild>
            <Link href="/dashboard/bargaining/notes/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Note
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center py-8 text-muted-foreground">Loading notes...</p>
        ) : notes.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="mx-auto h-12 w-12 mb-4" />
            <p>No session notes yet</p>
            <p className="text-sm">Add notes from bargaining sessions to track discussions</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div key={note.id} className="border rounded-lg p-4 hover:bg-accent transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{note.title}</h4>
                      <Badge className={sessionTypeColors[note.sessionType] || "bg-gray-500"}>
                        {note.sessionType}
                      </Badge>
                      {note.confidentialityLevel !== "internal" && (
                        <Badge variant="outline">{note.confidentialityLevel}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {note.content}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(note.sessionDate), "MMM d, yyyy")}
                      </span>
                      {note.attendees && note.attendees.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {note.attendees.length} attendees
                        </span>
                      )}
                    </div>
                    {note.tags && note.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {note.tags.map((tag, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button variant="ghost" size="sm">
                    View
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
