/**
 * Inspection Checklist Component
 * 
 * Interactive checklist for conducting safety inspections with:
 * - Checklist items by category
 * - Pass/fail/NA selection
 * - Photo attachments per item
 * - Notes and observations
 * - Offline support
 * - Auto-save progress
 * 
 * @module components/health-safety/InspectionChecklist
 */

"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  XCircle, 
  MinusCircle, 
  Camera,
  Save,
  Send,
  AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChecklistItem {
  id: string;
  category: string;
  item: string;
  description?: string;
  isCritical: boolean;
  status?: "pass" | "fail" | "na";
  notes?: string;
  photos?: File[];
}

export interface InspectionChecklistProps {
  inspectionId: string;
  items: ChecklistItem[];
  onComplete?: (results: ChecklistItem[]) => Promise<void>;
  onSaveDraft?: () => void;
}

export function InspectionChecklist({
  inspectionId,
  items: initialItems,
  onComplete,
  onSaveDraft
}: InspectionChecklistProps) {
  const { toast } = useToast();
  const [items, setItems] = React.useState<ChecklistItem[]>(initialItems);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [generalNotes, setGeneralNotes] = React.useState("");

  // Auto-save progress
  React.useEffect(() => {
    const autoSave = setInterval(() => {
      localStorage.setItem(
        `inspection-progress-${inspectionId}`,
        JSON.stringify({ items, generalNotes })
      );
    }, 30000); // Every 30 seconds

    return () => clearInterval(autoSave);
  }, [items, generalNotes, inspectionId]);

  // Load saved progress
  React.useEffect(() => {
    const saved = localStorage.getItem(`inspection-progress-${inspectionId}`);
    if (saved) {
      const { items: savedItems, generalNotes: savedNotes } = JSON.parse(saved);
      setItems(savedItems);
      setGeneralNotes(savedNotes);
    }
  }, [inspectionId]);

  function updateItem(itemId: string, updates: Partial<ChecklistItem>) {
    setItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, ...updates } : item
      )
    );
  }

  function handlePhotoUpload(itemId: string, files: FileList | null) {
    if (!files) return;
    
    const photos = Array.from(files);
    updateItem(itemId, {
      photos: [...(items.find(i => i.id === itemId)?.photos || []), ...photos]
    });
  }

  async function handleSubmit() {
    // Validate critical items
    const incompleteCritical = items.filter(
      item => item.isCritical && !item.status
    );

    if (incompleteCritical.length > 0) {
      toast({
        title: "Incomplete Inspection",
        description: "Please complete all critical items before submitting",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (onComplete) {
        await onComplete(items);
      } else {
        // Default API call
        const formData = new FormData();
        formData.append('inspectionId', inspectionId);
        formData.append('results', JSON.stringify(items));
        formData.append('generalNotes', generalNotes);

        // Add all photos
        items.forEach((item, itemIndex) => {
          item.photos?.forEach((photo, photoIndex) => {
            formData.append(`item_${itemIndex}_photo_${photoIndex}`, photo);
          });
        });

        const response = await fetch(
          `/api/health-safety/inspections/${inspectionId}/complete`,
          {
            method: 'POST',
            body: formData
          }
        );

        if (!response.ok) {
          throw new Error("Failed to submit inspection");
        }

        toast({
          title: "Success",
          description: "Inspection completed successfully"
        });

        // Clear saved progress
        localStorage.removeItem(`inspection-progress-${inspectionId}`);

        // Redirect
        window.location.href = `/health-safety/inspections/${inspectionId}`;
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to submit inspection",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSaveDraft() {
    if (onSaveDraft) {
      onSaveDraft();
    } else {
      localStorage.setItem(
        `inspection-progress-${inspectionId}`,
        JSON.stringify({ items, generalNotes })
      );
      toast({
        title: "Draft Saved",
        description: "Your inspection progress has been saved"
      });
    }
  }

  // Group items by category
  const categories = Array.from(new Set(items.map(item => item.category)));

  // Calculate progress
  const completedItems = items.filter(item => item.status).length;
  const totalItems = items.length;
  const progress = Math.round((completedItems / totalItems) * 100);

  return (
    <div className="space-y-6">
      {/* Progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Progress</span>
              <span className="text-muted-foreground">
                {completedItems} of {totalItems} items
              </span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Checklist by category */}
      {categories.map(category => {
        const categoryItems = items.filter(item => item.category === category);
        
        return (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="text-lg">{category}</CardTitle>
              <CardDescription>
                {categoryItems.filter(i => i.status).length} of {categoryItems.length} completed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {categoryItems.map(item => (
                <div
                  key={item.id}
                  className={cn(
                    "p-4 border rounded-lg space-y-3",
                    item.isCritical && "border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{item.item}</p>
                        {item.isCritical && (
                          <Badge variant="outline" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Critical
                          </Badge>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Status Selection */}
                  <RadioGroup
                    value={item.status || ""}
                    onValueChange={(value) =>
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      updateItem(item.id, { status: value as any })
                    }
                  >
                    <div className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="pass" id={`${item.id}-pass`} />
                        <Label
                          htmlFor={`${item.id}-pass`}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          Pass
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="fail" id={`${item.id}-fail`} />
                        <Label
                          htmlFor={`${item.id}-fail`}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <XCircle className="h-4 w-4 text-red-600" />
                          Fail
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="na" id={`${item.id}-na`} />
                        <Label
                          htmlFor={`${item.id}-na`}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <MinusCircle className="h-4 w-4 text-gray-600" />
                          N/A
                        </Label>
                      </div>
                    </div>
                  </RadioGroup>

                  {/* Notes */}
                  {(item.status === "fail" || item.notes) && (
                    <div className="space-y-2">
                      <Label htmlFor={`${item.id}-notes`}>
                        Notes {item.status === "fail" && <span className="text-red-600">*</span>}
                      </Label>
                      <Textarea
                        id={`${item.id}-notes`}
                        value={item.notes || ""}
                        onChange={(e) =>
                          updateItem(item.id, { notes: e.target.value })
                        }
                        placeholder={
                          item.status === "fail"
                            ? "Please describe the issue and recommended corrective action..."
                            : "Add any observations..."
                        }
                        rows={2}
                      />
                    </div>
                  )}

                  {/* Photo Upload */}
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept="image/*"
                      multiple
                      capture="environment"
                      onChange={(e) => handlePhotoUpload(item.id, e.target.files)}
                      className="hidden"
                      id={`${item.id}-photos`}
                    />
                    <Label
                      htmlFor={`${item.id}-photos`}
                      className="flex items-center gap-2 px-3 py-2 text-sm border rounded-md cursor-pointer hover:bg-accent"
                    >
                      <Camera className="h-4 w-4" />
                      Add Photos
                    </Label>
                    {item.photos && item.photos.length > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {item.photos.length} photo{item.photos.length !== 1 ? 's' : ''} attached
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      {/* General Notes */}
      <Card>
        <CardHeader>
          <CardTitle>General Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={generalNotes}
            onChange={(e) => setGeneralNotes(e.target.value)}
            placeholder="Add any general observations or notes about the inspection..."
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={handleSaveDraft}
        >
          <Save className="h-4 w-4 mr-2" />
          Save Draft
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || completedItems < totalItems}
        >
          <Send className="h-4 w-4 mr-2" />
          {isSubmitting ? "Submitting..." : "Complete Inspection"}
        </Button>
      </div>
    </div>
  );
}
