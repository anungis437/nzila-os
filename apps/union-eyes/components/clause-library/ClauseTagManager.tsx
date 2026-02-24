"use client";

/**
 * Phase 5B: Clause Tag Manager Component
 * Interface for adding and removing tags from clauses
 */

import { useState } from "react";
import { Plus, X, Tag as TagIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ClauseTag {
  id: string;
  tagName: string;
}

interface ClauseTagManagerProps {
  clauseId: string;
  tags: ClauseTag[];
  isOwner: boolean;
  onAddTag: (tagName: string) => Promise<void>;
  onRemoveTag: (tagName: string) => Promise<void>;
}

export function ClauseTagManager({
  clauseId: _clauseId,
  tags,
  isOwner,
  onAddTag,
  onRemoveTag,
}: ClauseTagManagerProps) {
  const [newTagName, setNewTagName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [removingTags, setRemovingTags] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const handleAddTag = async () => {
    const trimmedTag = newTagName.trim();

    // Validation
    if (!trimmedTag) {
      setError("Tag name cannot be empty");
      return;
    }

    if (trimmedTag.length > 100) {
      setError("Tag name must be 100 characters or less");
      return;
    }

    if (tags.some((tag) => tag.tagName.toLowerCase() === trimmedTag.toLowerCase())) {
      setError("This tag already exists");
      return;
    }

    setError(null);
    setIsAdding(true);

    try {
      await onAddTag(trimmedTag);
      setNewTagName("");
    } catch (err) {
      setError(err.message || "Failed to add tag");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveTag = async (tagName: string) => {
    setRemovingTags((prev) => new Set(prev).add(tagName));
    setError(null);

    try {
      await onRemoveTag(tagName);
    } catch (err) {
      setError(err.message || "Failed to remove tag");
    } finally {
      setRemovingTags((prev) => {
        const next = new Set(prev);
        next.delete(tagName);
        return next;
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isAdding) {
      handleAddTag();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TagIcon className="h-5 w-5" />
          Tags
        </CardTitle>
        <CardDescription>
          Add keywords to make this clause easier to find and categorize
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Tag Input */}
        {isOwner && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder="Enter tag name..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isAdding}
                maxLength={100}
              />
              <Button
                onClick={handleAddTag}
                disabled={isAdding || !newTagName.trim()}
                size="icon"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <p className="text-xs text-muted-foreground">
              Tags help organize clauses and improve searchability. Press Enter to add.
            </p>
          </div>
        )}

        {/* Tag List */}
        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge
                key={tag.id}
                variant="secondary"
                className="flex items-center gap-1 pl-3 pr-1"
              >
                <span>{tag.tagName}</span>
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0 hover:bg-transparent"
                    onClick={() => handleRemoveTag(tag.tagName)}
                    disabled={removingTags.has(tag.tagName)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </Badge>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <TagIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No tags yet</p>
            {isOwner && <p className="text-xs mt-1">Add tags to improve organization</p>}
          </div>
        )}

        {/* Tag Count */}
        {tags.length > 0 && (
          <div className="text-xs text-muted-foreground pt-2 border-t">
            {tags.length} tag{tags.length !== 1 ? "s" : ""}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

