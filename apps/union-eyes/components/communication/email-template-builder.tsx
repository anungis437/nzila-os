/**
 * Email Template Builder Component
 * 
 * Visual email template builder with:
 * - Drag-drop block editor
 * - Variable placeholders
 * - Template library
 * - Mobile/desktop preview
 * - Subject line optimization
 * - Save and reuse templates
 * 
 * @module components/communication/email-template-builder
 */

"use client";

import * as React from "react";
import { sanitizeHtml } from '@/lib/utils/sanitize';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Mail,
  Save,
  Eye,
  Smartphone,
  Monitor,
  GripVertical,
  Image as ImageIcon,
  Type,
  Link2,
  Code,
  Trash2,
  Copy,
} from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

const emailTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  subject: z.string().min(1, "Subject line is required"),
  preheader: z.string().max(100).optional(),
  category: z.string().min(1, "Category is required"),
  blocks: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["text", "heading", "image", "button", "divider", "html"]),
      content: z.string(),
      styles: z.record(z.string()).optional(),
    })
  ),
});

type EmailTemplateData = z.infer<typeof emailTemplateSchema>;

interface EmailBlock {
  id: string;
  type: "text" | "heading" | "image" | "button" | "divider" | "html";
  content: string;
  styles?: Record<string, string>;
}

const VARIABLES = [
  { label: "First Name", value: "{{first_name}}" },
  { label: "Last Name", value: "{{last_name}}" },
  { label: "Email", value: "{{email}}" },
  { label: "Member ID", value: "{{member_id}}" },
  { label: "Organization", value: "{{organization}}" },
  { label: "Department", value: "{{department}}" },
  { label: "Join Date", value: "{{join_date}}" },
];

const TEMPLATE_CATEGORIES = [
  "Welcome",
  "Newsletter",
  "Event",
  "Reminder",
  "Announcement",
  "Transactional",
];

export interface EmailTemplateBuilderProps {
  templates?: EmailTemplateData[];
  onSave?: (template: EmailTemplateData) => Promise<void>;
  onLoad?: (templateId: string) => void;
}

export function EmailTemplateBuilder({
  templates = [],
  onSave,
  onLoad,
}: EmailTemplateBuilderProps) {
  const [blocks, setBlocks] = React.useState<EmailBlock[]>([]);
  const [previewDevice, setPreviewDevice] = React.useState<"desktop" | "mobile">("desktop");
  const [showPreview, setShowPreview] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<EmailTemplateData>({
    resolver: zodResolver(emailTemplateSchema),
    defaultValues: {
      name: "",
      subject: "",
      preheader: "",
      category: "",
      blocks: [],
    },
  });

  const addBlock = (type: EmailBlock["type"]) => {
    const newBlock: EmailBlock = {
      id: `block-${Date.now()}`,
      type,
      content: getDefaultContent(type),
      styles: {},
    };
    setBlocks([...blocks, newBlock]);
  };

  const getDefaultContent = (type: EmailBlock["type"]): string => {
    switch (type) {
      case "heading":
        return "Heading Text";
      case "text":
        return "Enter your text here...";
      case "button":
        return "Click Here|https://example.com";
      case "image":
        return "https://via.placeholder.com/600x300";
      case "divider":
        return "";
      case "html":
        return "<div>Custom HTML</div>";
      default:
        return "";
    }
  };

  const updateBlock = (id: string, content: string) => {
    setBlocks(blocks.map((b) => (b.id === id ? { ...b, content } : b)));
  };

  const deleteBlock = (id: string) => {
    setBlocks(blocks.filter((b) => b.id !== id));
  };

  const duplicateBlock = (id: string) => {
    const block = blocks.find((b) => b.id === id);
    if (block) {
      const newBlock = { ...block, id: `block-${Date.now()}` };
      const index = blocks.findIndex((b) => b.id === id);
      setBlocks([...blocks.slice(0, index + 1), newBlock, ...blocks.slice(index + 1)]);
    }
  };

  const moveBlock = (id: string, direction: "up" | "down") => {
    const index = blocks.findIndex((b) => b.id === id);
    if (index === -1) return;
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === blocks.length - 1) return;

    const newBlocks = [...blocks];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];
    setBlocks(newBlocks);
  };

  const insertVariable = (variable: string, blockId: string) => {
    const block = blocks.find((b) => b.id === blockId);
    if (block) {
      updateBlock(blockId, block.content + variable);
    }
  };

  const handleSave = async (data: EmailTemplateData) => {
    setIsSubmitting(true);
    try {
      const templateData = { ...data, blocks };
      await onSave?.(templateData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderBlock = (block: EmailBlock, isPreview: boolean = false) => {
    if (isPreview) {
      switch (block.type) {
        case "heading":
          return <h2 className="text-2xl font-bold mb-4">{block.content}</h2>;
        case "text":
          return <p className="mb-4 text-gray-700">{block.content}</p>;
        case "button":
          const [label, url] = block.content.split("|");
          return (
            <div className="mb-4">
              <a
                href={url}
                className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
              >
                {label}
              </a>
            </div>
          );
        case "image":
          // eslint-disable-next-line @next/next/no-img-element
          return <img src={block.content} alt="" className="mb-4 w-full" />;
        case "divider":
          return <hr className="my-6 border-gray-300" />;
        case "html":
          return <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.content) }} className="mb-4" />;
        default:
          return null;
      }
    }

    return (
      <Card key={block.id} className="mb-3">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex flex-col gap-1 pt-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 cursor-move"
                onClick={() => moveBlock(block.id, "up")}
              >
                <GripVertical className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="outline">{block.type}</Badge>
                <div className="flex gap-1">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm">
                        Insert Variable
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56">
                      <div className="space-y-2">
                        {VARIABLES.map((variable) => (
                          <Button
                            key={variable.value}
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start"
                            onClick={() => insertVariable(variable.value, block.id)}
                          >
                            {variable.label}
                          </Button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => duplicateBlock(block.id)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteBlock(block.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>

              {block.type === "text" && (
                <Textarea
                  value={block.content}
                  onChange={(e) => updateBlock(block.id, e.target.value)}
                  rows={3}
                  placeholder="Enter text content..."
                />
              )}

              {block.type === "heading" && (
                <Input
                  value={block.content}
                  onChange={(e) => updateBlock(block.id, e.target.value)}
                  placeholder="Enter heading text..."
                />
              )}

              {block.type === "button" && (
                <div className="space-y-2">
                  <Input
                    value={block.content.split("|")[0] || ""}
                    onChange={(e) => {
                      const url = block.content.split("|")[1] || "";
                      updateBlock(block.id, `${e.target.value}|${url}`);
                    }}
                    placeholder="Button text"
                  />
                  <Input
                    value={block.content.split("|")[1] || ""}
                    onChange={(e) => {
                      const label = block.content.split("|")[0] || "";
                      updateBlock(block.id, `${label}|${e.target.value}`);
                    }}
                    placeholder="Button URL"
                  />
                </div>
              )}

              {block.type === "image" && (
                <Input
                  value={block.content}
                  onChange={(e) => updateBlock(block.id, e.target.value)}
                  placeholder="Image URL"
                />
              )}

              {block.type === "html" && (
                <Textarea
                  value={block.content}
                  onChange={(e) => updateBlock(block.id, e.target.value)}
                  rows={4}
                  placeholder="Enter custom HTML..."
                  className="font-mono text-sm"
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  React.useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    form.setValue("blocks", blocks as any);
  }, [blocks, form]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Mail className="h-6 w-6" />
          Email Template Builder
        </h2>
        <p className="text-gray-600 mt-1">
          Create custom email templates with drag-and-drop blocks
        </p>
      </div>

      <Tabs defaultValue="edit" value={showPreview ? "preview" : "edit"}>
        <TabsList>
          <TabsTrigger value="edit" onClick={() => setShowPreview(false)}>
            Edit
          </TabsTrigger>
          <TabsTrigger value="preview" onClick={() => setShowPreview(true)}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="edit">
          <div className="grid grid-cols-12 gap-6">
            {/* Sidebar - Blocks & Templates */}
            <div className="col-span-3 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Add Blocks</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => addBlock("heading")}
                  >
                    <Type className="h-4 w-4 mr-2" />
                    Heading
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => addBlock("text")}
                  >
                    <Type className="h-4 w-4 mr-2" />
                    Text
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => addBlock("button")}
                  >
                    <Link2 className="h-4 w-4 mr-2" />
                    Button
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => addBlock("image")}
                  >
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Image
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => addBlock("divider")}
                  >
                    <Separator className="h-4 w-4 mr-2" />
                    Divider
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => addBlock("html")}
                  >
                    <Code className="h-4 w-4 mr-2" />
                    Custom HTML
                  </Button>
                </CardContent>
              </Card>

              {templates.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Load Template</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Select onValueChange={onLoad}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select template" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((template, idx) => (
                          <SelectItem key={idx} value={template.name}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Main Editor */}
            <div className="col-span-9">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSave)} className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Template Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Template Name</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="My Email Template" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="category"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Category</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select category" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {TEMPLATE_CATEGORIES.map((cat) => (
                                    <SelectItem key={cat} value={cat.toLowerCase()}>
                                      {cat}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="subject"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Subject Line</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Email subject line" />
                            </FormControl>
                            <FormDescription>
                              {field.value.length}/100 characters
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="preheader"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Preheader Text (Optional)</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Preview text shown in inbox"
                                maxLength={100}
                              />
                            </FormControl>
                            <FormDescription>
                              Appears after subject line in email clients
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Email Content</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {blocks.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                          <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
                          <p>No blocks added yet</p>
                          <p className="text-sm">Add blocks from the sidebar to get started</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {blocks.map((block) => renderBlock(block, false))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <div className="flex justify-end gap-2">
                    <Button type="submit" disabled={isSubmitting}>
                      <Save className="h-4 w-4 mr-2" />
                      {isSubmitting ? "Saving..." : "Save Template"}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="preview">
          <div className="space-y-4">
            {/* Preview Controls */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <Button
                      variant={previewDevice === "desktop" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPreviewDevice("desktop")}
                    >
                      <Monitor className="h-4 w-4 mr-2" />
                      Desktop
                    </Button>
                    <Button
                      variant={previewDevice === "mobile" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPreviewDevice("mobile")}
                    >
                      <Smartphone className="h-4 w-4 mr-2" />
                      Mobile
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Preview Frame */}
            <Card>
              <CardContent className="p-0">
                <div
                  className={`mx-auto transition-all ${
                    previewDevice === "mobile" ? "max-w-md" : "max-w-3xl"
                  }`}
                >
                  <div className="bg-white border rounded-lg overflow-hidden">
                    {/* Email Header */}
                    <div className="bg-gray-100 p-4 border-b">
                      <div className="text-sm text-gray-600">
                        <strong>Subject:</strong> {form.watch("subject") || "No subject"}
                      </div>
                      {form.watch("preheader") && (
                        <div className="text-xs text-gray-500 mt-1">
                          {form.watch("preheader")}
                        </div>
                      )}
                    </div>

                    {/* Email Body */}
                    <div className="p-6">
                      {blocks.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                          <p>No content to preview</p>
                        </div>
                      ) : (
                        blocks.map((block) => (
                          <div key={block.id}>{renderBlock(block, true)}</div>
                        ))
                      )}
                    </div>

                    {/* Email Footer */}
                    <div className="bg-gray-100 p-4 border-t text-center text-xs text-gray-600">
                      <p>© 2026 Your Organization. All rights reserved.</p>
                      <p className="mt-2">
                        <a href="#" className="text-blue-600 hover:underline">
                          Unsubscribe
                        </a>{" "}
                        |{" "}
                        <a href="#" className="text-blue-600 hover:underline">
                          Manage Preferences
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

