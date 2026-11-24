/**
 * Document Bulk Operations Component
 * 
 * Batch document operations with:
 * - Multi-selection
 * - Bulk download
 * - Bulk move/copy
 * - Bulk delete
 * - Bulk tagging
 * - Bulk sharing
 * - Progress tracking
 * 
 * @module components/documents/document-bulk-operations
 */

"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import {
  CheckSquare,
  Download,
  Trash2,
  Move,
  Copy,
  Tag,
  Share2,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { failureLanguage, type FailureLanguage } from "@/lib/client/api-envelope";

type Verb = "download" | "delete" | "move" | "copy" | "tag" | "share";

const COPY: Record<FailureLanguage, {
  selected: (count: number) => string; clear: string; processing: (verb: string) => string; failed: string; notDone: string; dismiss: string;
  verbs: Record<Verb, string>; titles: Record<Verb, string>; documentsSelected: (count: number) => string;
  destination: string; chooseFolder: string; addTags: string; tagName: string; add: string; existing: string; chosen: string;
  permission: string; choosePermission: string; permissions: Record<"view" | "comment" | "edit" | "admin", string>;
  deleteWarning: (count: number) => string; downloadNote: (count: number) => string; cancel: string; removeTag: string;
}> = {
  en: {
    selected: (count) => `${count} selected`, clear: "Clear selection", processing: (verb) => `Processing: ${verb}…`,
    failed: "The action could not be completed. Nothing was confirmed; check the documents before trying again.",
    notDone: "The action was not completed.", dismiss: "Dismiss",
    verbs: { download: "Download", delete: "Delete", move: "Move", copy: "Copy", tag: "Tag", share: "Share" },
    titles: { download: "Download documents", delete: "Delete documents", move: "Move documents", copy: "Copy documents", tag: "Add tags", share: "Share documents" },
    documentsSelected: (count) => `${count} document${count > 1 ? "s" : ""} selected`,
    destination: "Destination folder", chooseFolder: "Choose a folder…", addTags: "Add tags", tagName: "Enter a tag name…", add: "Add",
    existing: "Or select from existing:", chosen: "Selected tags:", permission: "Permission level", choosePermission: "Choose a permission…",
    permissions: { view: "View", comment: "Comment", edit: "Edit", admin: "Admin" },
    deleteWarning: (count) => `This action cannot be undone. ${count} document${count > 1 ? "s" : ""} will be permanently deleted.`,
    downloadNote: (count) => `Each of the ${count} document${count > 1 ? "s" : ""} you may download opens as its own download. Documents you may not download are listed in the report.`,
    cancel: "Cancel", removeTag: "Remove tag",
  },
  fr: {
    selected: (count) => `${count} sélectionné${count > 1 ? "s" : ""}`, clear: "Effacer la sélection", processing: (verb) => `Traitement : ${verb}…`,
    failed: "L’action n’a pas pu être effectuée. Rien n’a été confirmé; vérifiez les documents avant de réessayer.",
    notDone: "L’action n’a pas été effectuée.", dismiss: "Fermer",
    verbs: { download: "Télécharger", delete: "Supprimer", move: "Déplacer", copy: "Copier", tag: "Étiqueter", share: "Partager" },
    titles: { download: "Télécharger les documents", delete: "Supprimer les documents", move: "Déplacer les documents", copy: "Copier les documents", tag: "Ajouter des étiquettes", share: "Partager les documents" },
    documentsSelected: (count) => `${count} document${count > 1 ? "s" : ""} sélectionné${count > 1 ? "s" : ""}`,
    destination: "Dossier de destination", chooseFolder: "Choisir un dossier…", addTags: "Ajouter des étiquettes", tagName: "Saisir le nom d’une étiquette…", add: "Ajouter",
    existing: "Ou choisir parmi les étiquettes existantes :", chosen: "Étiquettes choisies :", permission: "Niveau d’autorisation", choosePermission: "Choisir une autorisation…",
    permissions: { view: "Lecture", comment: "Commentaire", edit: "Modification", admin: "Administration" },
    deleteWarning: (count) => `Cette action est irréversible. ${count} document${count > 1 ? "s seront supprimés" : " sera supprimé"} définitivement.`,
    downloadNote: (count) => `Chacun des ${count} document${count > 1 ? "s" : ""} que vous pouvez télécharger s’ouvre dans son propre téléchargement. Les documents que vous ne pouvez pas télécharger sont indiqués dans le rapport.`,
    cancel: "Annuler", removeTag: "Retirer l’étiquette",
  },
};

export interface BulkOperation {
  id: string;
  type: "download" | "delete" | "move" | "copy" | "tag" | "share";
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  total: number;
  current: number;
  error?: string;
}

export interface DocumentBulkOperationsProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkDownload?: () => Promise<void | boolean>;
  onBulkDelete?: () => Promise<void | boolean>;
  onBulkMove?: (folderId: string) => Promise<void | boolean>;
  onBulkCopy?: (folderId: string) => Promise<void | boolean>;
  onBulkTag?: (tags: string[]) => Promise<void | boolean>;
  onBulkShare?: (permission: string) => Promise<void | boolean>;
  folders?: { id: string; name: string }[];
  availableTags?: string[];
}

export function DocumentBulkOperations({
  selectedCount,
  onClearSelection,
  onBulkDownload,
  onBulkDelete,
  onBulkMove,
  onBulkCopy,
  onBulkTag,
  onBulkShare,
  folders = [],
  availableTags = [],
}: DocumentBulkOperationsProps) {
  const [operation, setOperation] = React.useState<BulkOperation | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogType, setDialogType] = React.useState<string>("");
  const [selectedFolder, setSelectedFolder] = React.useState("");
  const [selectedTags, setSelectedTags] = React.useState<string[]>([]);
  const [selectedPermission, setSelectedPermission] = React.useState("view");
  const [newTag, setNewTag] = React.useState("");

  const language = failureLanguage(useLocale());
  const t = COPY[language];

  if (selectedCount === 0) return null;

  const handleOperation = async (type: BulkOperation["type"], action: () => Promise<void | boolean>) => {
    setOperation({
      id: Date.now().toString(),
      type: type,
      status: "running",
      progress: 0,
      total: selectedCount,
      current: 0,
    });

    try {
      const outcome = await action();
      if (outcome === false) {
        // The caller has said why; the selection stays so that nothing looks done.
        setOperation((prev) => prev && { ...prev, status: "failed", error: t.notDone });
        return;
      }
      setOperation((prev) => prev && { ...prev, status: "completed", progress: 100 });
      setTimeout(() => {
        setOperation(null);
        onClearSelection();
      }, 2000);
    } catch {
      setOperation((prev) => prev && { ...prev, status: "failed", error: t.failed });
    }
  };

  const openDialog = (type: string) => {
    setDialogType(type);
    setDialogOpen(true);
  };

  const handleConfirm = async () => {
    setDialogOpen(false);
    
    switch (dialogType) {
      case "move":
        if (onBulkMove && selectedFolder) {
          await handleOperation("move", () => onBulkMove(selectedFolder));
        }
        break;
      case "copy":
        if (onBulkCopy && selectedFolder) {
          await handleOperation("copy", () => onBulkCopy(selectedFolder));
        }
        break;
      case "tag":
        if (onBulkTag && selectedTags.length > 0) {
          await handleOperation("tag", () => onBulkTag(selectedTags));
        }
        break;
      case "delete":
        if (onBulkDelete) {
          await handleOperation("delete", onBulkDelete);
        }
        break;
      case "download":
        if (onBulkDownload) {
          await handleOperation("download", onBulkDownload);
        }
        break;
      case "share":
        if (onBulkShare) {
          await handleOperation("share", () => onBulkShare(selectedPermission));
        }
        break;
    }

    // Reset dialog state
    setSelectedFolder("");
    setSelectedTags([]);
    setSelectedPermission("view");
    setNewTag("");
  };

  const addTag = () => {
    if (newTag && !selectedTags.includes(newTag)) {
      setSelectedTags([...selectedTags, newTag]);
      setNewTag("");
    }
  };

  return (
    <>
      {/* Bulk Actions Bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        <div className="bg-blue-600 text-white rounded-lg shadow-2xl p-4 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            <span className="font-medium">{t.selected(selectedCount)}</span>
          </div>

          <div className="h-6 w-px bg-white/20" />

          <div className="flex gap-2">
            {onBulkDownload && (
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10"
                onClick={() => openDialog("download")}
              >
                <Download className="h-4 w-4 mr-1" />
                {t.verbs.download}
              </Button>
            )}

            {onBulkMove && folders.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10"
                onClick={() => openDialog("move")}
              >
                <Move className="h-4 w-4 mr-1" />
                {t.verbs.move}
              </Button>
            )}

            {onBulkCopy && folders.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10"
                onClick={() => openDialog("copy")}
              >
                <Copy className="h-4 w-4 mr-1" />
                {t.verbs.copy}
              </Button>
            )}

            {onBulkTag && (
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10"
                onClick={() => openDialog("tag")}
              >
                <Tag className="h-4 w-4 mr-1" />
                {t.verbs.tag}
              </Button>
            )}

            {onBulkShare && (
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10"
                onClick={() => openDialog("share")}
              >
                <Share2 className="h-4 w-4 mr-1" />
                {t.verbs.share}
              </Button>
            )}

            {onBulkDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10"
                onClick={() => openDialog("delete")}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {t.verbs.delete}
              </Button>
            )}
          </div>

          <div className="h-6 w-px bg-white/20" />

          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/10"
            onClick={onClearSelection}
            aria-label={t.clear}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Operation Progress */}
      {operation && operation.status === "running" && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-96">
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>{t.processing(t.verbs[operation.type])}</span>
                  <span>{operation.current} / {operation.total}</span>
                </div>
                <Progress value={operation.progress} />
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {operation && operation.status === "failed" && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-96">
          <Alert variant="destructive" role="alert">
            <AlertDescription>
              <div className="flex items-start justify-between gap-2">
                <span>{operation.error}</span>
                <button type="button" className="underline" onClick={() => setOperation(null)}>{t.dismiss}</button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Confirmation Dialogs */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogType in t.titles && t.titles[dialogType as Verb]}
            </DialogTitle>
            <DialogDescription>
              {t.documentsSelected(selectedCount)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {(dialogType === "move" || dialogType === "copy") && (
              <div>
                <Label>{t.destination}</Label>
                <Select value={selectedFolder} onValueChange={setSelectedFolder}>
                  <SelectTrigger>
                    <SelectValue placeholder={t.chooseFolder} />
                  </SelectTrigger>
                  <SelectContent>
                    {folders.map((folder) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {folder.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {dialogType === "tag" && (
              <div className="space-y-3">
                <div>
                  <Label>{t.addTags}</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder={t.tagName}
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addTag()}
                    />
                    <Button onClick={addTag}>{t.add}</Button>
                  </div>
                </div>

                {availableTags.length > 0 && (
                  <div>
                    <Label className="mb-2 block">{t.existing}</Label>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                      {availableTags.map((tag) => (
                        <Badge
                          key={tag}
                          variant={selectedTags.includes(tag) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => {
                            setSelectedTags(
                              selectedTags.includes(tag)
                                ? selectedTags.filter((name) => name !== tag)
                                : [...selectedTags, tag]
                            );
                          }}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedTags.length > 0 && (
                  <div>
                    <Label className="mb-2 block">{t.chosen}</Label>
                    <div className="flex flex-wrap gap-2">
                      {selectedTags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                          <button
                            type="button"
                            aria-label={`${t.removeTag}: ${tag}`}
                            onClick={() =>
                              setSelectedTags(selectedTags.filter((name) => name !== tag))
                            }
                            className="ml-1 hover:text-red-600"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {dialogType === "share" && (
              <div>
                <Label>{t.permission}</Label>
                <Select value={selectedPermission} onValueChange={setSelectedPermission}>
                  <SelectTrigger>
                    <SelectValue placeholder={t.choosePermission} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">{t.permissions.view}</SelectItem>
                    <SelectItem value="comment">{t.permissions.comment}</SelectItem>
                    <SelectItem value="edit">{t.permissions.edit}</SelectItem>
                    <SelectItem value="admin">{t.permissions.admin}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {dialogType === "delete" && (
              <Alert variant="destructive">
                <AlertDescription>
                  {t.deleteWarning(selectedCount)}
                </AlertDescription>
              </Alert>
            )}

            {dialogType === "download" && (
              <Alert>
                <AlertDescription>
                  {t.downloadNote(selectedCount)}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t.cancel}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={
                (dialogType === "move" || dialogType === "copy") && !selectedFolder ||
                dialogType === "tag" && selectedTags.length === 0
              }
              variant={dialogType === "delete" ? "destructive" : "default"}
            >
              {dialogType === "tag" ? t.addTags : dialogType in t.verbs && t.verbs[dialogType as Verb]}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

