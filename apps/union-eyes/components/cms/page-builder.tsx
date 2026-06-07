import React from 'react';
// eslint-disable-next-line @typescript-eslint/no-unused-expressions
'use client';

import { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Type,
  Heading1,
  Image as ImageIcon,
  Video,
  Grid3x3,
  GripVertical,
  Plus,
  Trash2,
  Eye,
  Settings,
  Copy,
  ChevronUp,
  ChevronDown,
  Save,
} from 'lucide-react';

interface ContentBlock {
  id: string;
  type: 'heading' | 'text' | 'image' | 'video' | 'button' | 'hero' | 'features' | 'cta' | 'gallery';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  styles?: any;
}

interface PageBuilderProps {
  initialBlocks?: ContentBlock[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSave: (blocks: ContentBlock[], pageData: any) => Promise<void>;
  pageTitle?: string;
  pageSlug?: string;
}

const BLOCK_TYPES = [
  { type: 'heading', label: 'Heading', icon: Heading1, description: 'H1, H2, or H3 heading' },
  { type: 'text', label: 'Text', icon: Type, description: 'Rich text paragraph' },
  { type: 'image', label: 'Image', icon: ImageIcon, description: 'Single image with caption' },
  { type: 'video', label: 'Video', icon: Video, description: 'YouTube or Vimeo embed' },
  { type: 'button', label: 'Button', icon: Plus, description: 'Call-to-action button' },
  { type: 'hero', label: 'Hero Section', icon: Grid3x3, description: 'Large header with background' },
  { type: 'features', label: 'Features', icon: Grid3x3, description: '3-column feature grid' },
  { type: 'cta', label: 'Call to Action', icon: Plus, description: 'CTA banner section' },
  { type: 'gallery', label: 'Gallery', icon: Grid3x3, description: 'Image gallery grid' },
];

export function PageBuilder({ initialBlocks = [], onSave, pageTitle = '', pageSlug = '' }: PageBuilderProps) {
  const [blocks, setBlocks] = useState<ContentBlock[]>(initialBlocks);
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [_showBlockPicker, setShowBlockPicker] = useState(false);
  const [title, setTitle] = useState(pageTitle);
  const [slug, _setSlug] = useState(pageSlug);
  const [metaDescription, _setMetaDescription] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(blocks);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setBlocks(items);
  };

  const addBlock = (type: ContentBlock['type']) => {
    const newBlock: ContentBlock = {
      id: `block-${Date.now()}`,
      type,
      content: getDefaultContent(type),
      styles: getDefaultStyles(type),
    };

    setBlocks([...blocks, newBlock]);
    setSelectedBlock(newBlock.id);
    setShowBlockPicker(false);
  };

  const getDefaultContent = (type: ContentBlock['type']) => {
    switch (type) {
      case 'heading':
        return { level: 'h2', text: 'Your Heading Here' };
      case 'text':
        return { text: 'Start typing your content...' };
      case 'image':
        return { url: '', alt: '', caption: '' };
      case 'video':
        return { url: '', platform: 'youtube' };
      case 'button':
        return { text: 'Click Here', url: '', variant: 'primary' };
      case 'hero':
        return { heading: 'Welcome', subheading: '', backgroundImage: '', buttonText: 'Learn More', buttonUrl: '' };
      case 'features':
        return {
          items: [
            { icon: '✓', title: 'Feature 1', description: 'Description here' },
            { icon: '✓', title: 'Feature 2', description: 'Description here' },
            { icon: '✓', title: 'Feature 3', description: 'Description here' },
          ],
        };
      case 'cta':
        return { heading: 'Ready to get started?', description: '', buttonText: 'Get Started', buttonUrl: '' };
      case 'gallery':
        return { images: [] };
      default:
        return {};
    }
  };

  const getDefaultStyles = (type: ContentBlock['type']) => {
    return {
      marginTop: '1rem',
      marginBottom: '1rem',
      padding: type === 'hero' || type === 'cta' ? '4rem 2rem' : '0',
      backgroundColor: type === 'hero' || type === 'cta' ? '#f9fafb' : 'transparent',
    };
  };

  const updateBlock = (blockId: string, updates: Partial<ContentBlock>) => {
    setBlocks(blocks.map(block => 
      block.id === blockId ? { ...block, ...updates } : block
    ));
  };

  const deleteBlock = (blockId: string) => {
    setBlocks(blocks.filter(block => block.id !== blockId));
    if (selectedBlock === blockId) setSelectedBlock(null);
  };

  const duplicateBlock = (blockId: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    const newBlock = {
      ...block,
      id: `block-${Date.now()}`,
    };

    const index = blocks.findIndex(b => b.id === blockId);
    const newBlocks = [...blocks];
    newBlocks.splice(index + 1, 0, newBlock);
    setBlocks(newBlocks);
  };

  const moveBlock = (blockId: string, direction: 'up' | 'down') => {
    const index = blocks.findIndex(b => b.id === blockId);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === blocks.length - 1) return;

    const newBlocks = [...blocks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];
    setBlocks(newBlocks);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(blocks, {
        title,
        slug,
        metaDescription,
      });
    } finally {
      setSaving(false);
    }
  };

  const renderBlockEditor = (block: ContentBlock) => {
    switch (block.type) {
      case 'heading':
        return (
          <div className="space-y-4">
            <div>
              <Label>Level</Label>
              <Select
                value={block.content.level}
                onValueChange={(value) => updateBlock(block.id, { content: { ...block.content, level: value } })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="h1">H1</SelectItem>
                  <SelectItem value="h2">H2</SelectItem>
                  <SelectItem value="h3">H3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Text</Label>
              <Input
                value={block.content.text}
                onChange={(e) => updateBlock(block.id, { content: { ...block.content, text: e.target.value } })}
                placeholder="Your heading text"
              />
            </div>
          </div>
        );

      case 'text':
        return (
          <div>
            <Label>Content</Label>
            <Textarea
              value={block.content.text}
              onChange={(e) => updateBlock(block.id, { content: { ...block.content, text: e.target.value } })}
              placeholder="Write your content here..."
              rows={6}
            />
          </div>
        );

      case 'image':
        return (
          <div className="space-y-4">
            <div>
              <Label>Image URL</Label>
              <Input
                value={block.content.url}
                onChange={(e) => updateBlock(block.id, { content: { ...block.content, url: e.target.value } })}
                placeholder="https://example.com/image.jpg"
              />
            </div>
            <div>
              <Label>Alt Text</Label>
              <Input
                value={block.content.alt}
                onChange={(e) => updateBlock(block.id, { content: { ...block.content, alt: e.target.value } })}
                placeholder="Image description"
              />
            </div>
            <div>
              <Label>Caption (Optional)</Label>
              <Input
                value={block.content.caption}
                onChange={(e) => updateBlock(block.id, { content: { ...block.content, caption: e.target.value } })}
                placeholder="Image caption"
              />
            </div>
          </div>
        );

      case 'button':
        return (
          <div className="space-y-4">
            <div>
              <Label>Button Text</Label>
              <Input
                value={block.content.text}
                onChange={(e) => updateBlock(block.id, { content: { ...block.content, text: e.target.value } })}
                placeholder="Click Here"
              />
            </div>
            <div>
              <Label>Link URL</Label>
              <Input
                value={block.content.url}
                onChange={(e) => updateBlock(block.id, { content: { ...block.content, url: e.target.value } })}
                placeholder="https://example.com"
              />
            </div>
            <div>
              <Label>Style</Label>
              <Select
                value={block.content.variant}
                onValueChange={(value) => updateBlock(block.id, { content: { ...block.content, variant: value } })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="secondary">Secondary</SelectItem>
                  <SelectItem value="outline">Outline</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'hero':
        return (
          <div className="space-y-4">
            <div>
              <Label>Heading</Label>
              <Input
                value={block.content.heading}
                onChange={(e) => updateBlock(block.id, { content: { ...block.content, heading: e.target.value } })}
                placeholder="Main headline"
              />
            </div>
            <div>
              <Label>Subheading</Label>
              <Textarea
                value={block.content.subheading}
                onChange={(e) => updateBlock(block.id, { content: { ...block.content, subheading: e.target.value } })}
                placeholder="Supporting text"
                rows={3}
              />
            </div>
            <div>
              <Label>Background Image URL</Label>
              <Input
                value={block.content.backgroundImage}
                onChange={(e) => updateBlock(block.id, { content: { ...block.content, backgroundImage: e.target.value } })}
                placeholder="https://example.com/background.jpg"
              />
            </div>
            <div>
              <Label>Button Text</Label>
              <Input
                value={block.content.buttonText}
                onChange={(e) => updateBlock(block.id, { content: { ...block.content, buttonText: e.target.value } })}
                placeholder="Learn More"
              />
            </div>
            <div>
              <Label>Button URL</Label>
              <Input
                value={block.content.buttonUrl}
                onChange={(e) => updateBlock(block.id, { content: { ...block.content, buttonUrl: e.target.value } })}
                placeholder="https://example.com"
              />
            </div>
          </div>
        );

      default:
        return <div className="text-muted-foreground">No editor available for this block type</div>;
    }
  };

  const renderBlockPreview = (block: ContentBlock) => {
    switch (block.type) {
      case 'heading':
        const HeadingTag = block.content.level as keyof React.JSX.IntrinsicElements;
        return <HeadingTag className={block.content.level === 'h1' ? 'text-4xl' : block.content.level === 'h2' ? 'text-3xl' : 'text-2xl'}>{block.content.text}</HeadingTag>;
      
      case 'text':
        return <p className="text-base leading-7">{block.content.text}</p>;
      
      case 'image':
        return (
          <div>
            {block.content.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={block.content.url} alt={block.content.alt} className="max-w-full h-auto rounded-lg" />
            )}
            {block.content.caption && <p className="text-sm text-muted-foreground mt-2">{block.content.caption}</p>}
          </div>
        );
      
      case 'button':
        return (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          <Button variant={block.content.variant as any}>
            {block.content.text}
          </Button>
        );
      
      case 'hero':
        return (
          <div 
            className="rounded-lg p-16 text-center text-white relative overflow-hidden"
            style={{ 
              backgroundImage: block.content.backgroundImage ? `url(${block.content.backgroundImage})` : 'linear-gradient(to right, #1e40af, #3b82f6)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div className="relative z-10">
              <h1 className="text-5xl font-bold mb-4">{block.content.heading}</h1>
              {block.content.subheading && <p className="text-xl mb-6">{block.content.subheading}</p>}
              {block.content.buttonText && (
                <Button size="lg" variant="secondary">{block.content.buttonText}</Button>
              )}
            </div>
          </div>
        );
      
      default:
        return <div className="text-muted-foreground">Preview not available</div>;
    }
  };

  if (previewMode) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold">{title || 'Untitled Page'}</h1>
            <Button onClick={() => setPreviewMode(false)}>Exit Preview</Button>
          </div>
        </div>
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {blocks.map((block) => (
            <div key={block.id} style={block.styles} className="mb-6">
              {renderBlockPreview(block)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Left Sidebar - Block Library */}
      <div className="w-64 border-r bg-card overflow-y-auto">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Blocks</h2>
        </div>
        <div className="p-2 space-y-1">
          {BLOCK_TYPES.map((blockType) => {
            const Icon = blockType.icon;
            return (
              <button
                key={blockType.type}
                onClick={() => addBlock(blockType.type as ContentBlock['type'])}
                className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-accent text-left transition-colors"
              >
                <Icon className="h-5 w-5 mt-0.5 text-muted-foreground" />
                <div>
                  <div className="font-medium text-sm">{blockType.label}</div>
                  <div className="text-xs text-muted-foreground">{blockType.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Canvas */}
      <div className="flex-1 overflow-y-auto">
        <div className="border-b bg-card px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Page Title"
              className="text-xl font-semibold border-0 px-0 focus-visible:ring-0"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPreviewMode(true)}>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Page'}
            </Button>
          </div>
        </div>

        <div className="container mx-auto px-6 py-8 max-w-4xl">
          {blocks.length === 0 ? (
            <div className="text-center py-16">
              <Grid3x3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No blocks yet</h3>
              <p className="text-muted-foreground mb-4">Add blocks from the sidebar to start building your page</p>
            </div>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="blocks">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                    {blocks.map((block, index) => (
                      <Draggable key={block.id} draggableId={block.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`group relative ${snapshot.isDragging ? 'opacity-50' : ''}`}
                          >
                            <Card className={`p-6 ${selectedBlock === block.id ? 'ring-2 ring-primary' : ''}`}>
                              <div className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div
                                  {...provided.dragHandleProps}
                                  className="cursor-grab active:cursor-grabbing p-1 hover:bg-accent rounded"
                                >
                                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                                </div>
                              </div>

                              <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => moveBlock(block.id, 'up')}
                                  disabled={index === 0}
                                >
                                  <ChevronUp className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => moveBlock(block.id, 'down')}
                                  disabled={index === blocks.length - 1}
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => duplicateBlock(block.id)}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setSelectedBlock(block.id === selectedBlock ? null : block.id)}
                                >
                                  <Settings className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => deleteBlock(block.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>

                              {renderBlockPreview(block)}
                            </Card>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </div>
      </div>

      {/* Right Sidebar - Block Settings */}
      {selectedBlock && (
        <div className="w-80 border-l bg-card overflow-y-auto">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Block Settings</h2>
          </div>
          <div className="p-4">
            <Tabs defaultValue="content">
              <TabsList className="w-full">
                <TabsTrigger value="content" className="flex-1">Content</TabsTrigger>
                <TabsTrigger value="style" className="flex-1">Style</TabsTrigger>
              </TabsList>
              <TabsContent value="content" className="mt-4">
                {renderBlockEditor(blocks.find(b => b.id === selectedBlock)!)}
              </TabsContent>
              <TabsContent value="style" className="mt-4">
                <div className="space-y-4">
                  <div>
                    <Label>Background Color</Label>
                    <Input
                      type="color"
                      value={blocks.find(b => b.id === selectedBlock)?.styles?.backgroundColor || '#ffffff'}
                      onChange={(e) => {
                        const block = blocks.find(b => b.id === selectedBlock);
                        if (block) {
                          updateBlock(block.id, {
                            styles: { ...block.styles, backgroundColor: e.target.value },
                          });
                        }
                      }}
                    />
                  </div>
                  <div>
                    <Label>Padding</Label>
                    <Input
                      value={blocks.find(b => b.id === selectedBlock)?.styles?.padding || '0'}
                      onChange={(e) => {
                        const block = blocks.find(b => b.id === selectedBlock);
                        if (block) {
                          updateBlock(block.id, {
                            styles: { ...block.styles, padding: e.target.value },
                          });
                        }
                      }}
                      placeholder="e.g., 2rem or 1rem 2rem"
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}
    </div>
  );
}

