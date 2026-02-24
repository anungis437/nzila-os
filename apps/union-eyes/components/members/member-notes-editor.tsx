/**
 * Member Notes Editor Component
 * 
 * Note-taking interface for member records with:
 * - Rich text editing
 * - Note categories/tags
 * - Privacy levels
 * - Version history
 * - Search and filter
 * - Attachments
 * 
 * @module components/members/member-notes-editor
 */

"use client";

import * as React from "react";
import {
  Plus,
  Search,
  Tag,
  Lock,
  Globe,
  Users,
  Edit,
  Trash,
  Clock,
  Paperclip,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
 
import { format } from "date-fns";

export interface MemberNote {
  id: string;
  title: string;
  content: string;
  category: "general" | "grievance" | "disciplinary" | "medical" | "meeting" | "other";
  privacy: "private" | "stewards" | "public";
  tags: string[];
  attachments?: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemberNotesEditorProps {
  memberId: string;
  memberName: string;
  notes: MemberNote[];
  onAddNote: (note: Omit<MemberNote, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  onUpdateNote: (id: string, note: Partial<MemberNote>) => Promise<void>;
  onDeleteNote: (id: string) => Promise<void>;
}

const categories = [
  { value: "general", label: "General", color: "gray" },
  { value: "grievance", label: "Grievance", color: "red" },
  { value: "disciplinary", label: "Disciplinary", color: "orange" },
  { value: "medical", label: "Medical", color: "blue" },
  { value: "meeting", label: "Meeting", color: "purple" },
  { value: "other", label: "Other", color: "gray" },
];

const privacyLevels = [
  { value: "private", label: "Private", icon: Lock, description: "Only you can see this" },
  { value: "stewards", label: "Stewards", icon: Users, description: "Visible to stewards" },
  { value: "public", label: "Public", icon: Globe, description: "Visible to all" },
];

export function MemberNotesEditor({
  memberId: _memberId,
  memberName,
  notes,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
}: MemberNotesEditorProps) {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingNote, setEditingNote] = React.useState<MemberNote | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [filterCategory, setFilterCategory] = React.useState<string>("all");

  // Form state
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [category, setCategory] = React.useState<MemberNote["category"]>("general");
  const [privacy, setPrivacy] = React.useState<MemberNote["privacy"]>("private");
  const [tags, setTags] = React.useState<string[]>([]);

  // Filter notes
  const filteredNotes = React.useMemo(() => {
    return notes.filter((note) => {
      const matchesSearch =
        !searchQuery ||
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory = filterCategory === "all" || note.category === filterCategory;

      return matchesSearch && matchesCategory;
    });
  }, [notes, searchQuery, filterCategory]);

  const handleOpenDialog = (note?: MemberNote) => {
    if (note) {
      setEditingNote(note);
      setTitle(note.title);
      setContent(note.content);
      setCategory(note.category);
      setPrivacy(note.privacy);
      setTags(note.tags);
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingNote(null);
    setTitle("");
    setContent("");
    setCategory("general");
    setPrivacy("private");
    setTags([]);
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      toast({
        title: "Validation error",
        description: "Title and content are required",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingNote) {
        await onUpdateNote(editingNote.id, {
          title,
          content,
          category,
          privacy,
          tags,
        });
        toast({ title: "Note updated successfully" });
      } else {
        await onAddNote({
          title,
          content,
          category,
          privacy,
          tags,
          createdBy: "Current User", // This would come from auth context
        });
        toast({ title: "Note added successfully" });
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      toast({
        title: "Failed to save note",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this note?")) return;

    try {
      await onDeleteNote(id);
      toast({ title: "Note deleted successfully" });
    } catch (error) {
      toast({
        title: "Failed to delete note",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Member Notes</h2>
          <p className="text-gray-600">{memberName}</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          New Note
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Notes List */}
      <div className="space-y-4">
        {filteredNotes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              <p>No notes found</p>
            </CardContent>
          </Card>
        ) : (
          filteredNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onEdit={() => handleOpenDialog(note)}
              onDelete={() => handleDelete(note.id)}
            />
          ))
        )}
      </div>

      {/* Note Editor Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingNote ? "Edit Note" : "New Note"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Note title..."
              />
            </div>

            {/* Category and Privacy */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Select value={category} onValueChange={(value: any) => setCategory(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="privacy">Privacy *</Label>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Select value={privacy} onValueChange={(value: any) => setPrivacy(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {privacyLevels.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        <div className="flex items-center gap-2">
                          <level.icon className="h-3 w-3" />
                          {level.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Content */}
            <div className="space-y-2">
              <Label htmlFor="content">Content *</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Note content..."
                rows={8}
              />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label htmlFor="tags">Tags (optional)</Label>
              <Input
                id="tags"
                placeholder="Enter tags separated by commas..."
                value={tags.join(", ")}
                onChange={(e) => setTags(e.target.value.split(",").map((t) => t.trim()).filter(Boolean))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingNote ? "Update" : "Create"} Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NoteCard({
  note,
  onEdit,
  onDelete,
}: {
  note: MemberNote;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const categoryConfig = categories.find((c) => c.value === note.category);
  const privacyConfig = privacyLevels.find((p) => p.value === note.privacy);
  const PrivacyIcon = privacyConfig?.icon || Lock;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className="text-lg">{note.title}</CardTitle>
              <Badge variant="outline">{categoryConfig?.label}</Badge>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <PrivacyIcon className="h-3 w-3" />
                {privacyConfig?.label}
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span>{note.createdBy}</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(note.createdAt, "PPp")}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="icon" variant="ghost" onClick={onEdit}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={onDelete}>
              <Trash className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-3">
          {note.content}
        </p>
        {note.tags.length > 0 && (
          <div className="flex items-center gap-2 mt-3">
            <Tag className="h-3 w-3 text-gray-400" />
            <div className="flex flex-wrap gap-1">
              {note.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {note.attachments && note.attachments.length > 0 && (
          <div className="flex items-center gap-2 mt-3 text-sm text-gray-600">
            <Paperclip className="h-3 w-3" />
            {note.attachments.length} attachment(s)
          </div>
        )}
      </CardContent>
    </Card>
  );
}

