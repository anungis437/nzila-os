'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Star, Sparkles, Calendar } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AwardTemplate {
  id: string;
  name: string;
  message: string;
  category: string;
  tags: string[];
  useCount: number;
}

interface TemplatePickerProps {
  templates: AwardTemplate[];
  onSelect: (template: AwardTemplate) => void;
  children: React.ReactNode;
}

export function TemplatePicker({ templates, onSelect, children }: TemplatePickerProps) {
  const t = useTranslations('rewards.templates');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [open, setOpen] = useState(false);

  const categories = [
    { value: 'all', label: t('categories.all'), icon: Sparkles },
    { value: 'performance', label: t('categories.performance'), icon: Star },
    { value: 'teamwork', label: t('categories.teamwork'), icon: null },
    { value: 'innovation', label: t('categories.innovation'), icon: null },
    { value: 'leadership', label: t('categories.leadership'), icon: null },
    { value: 'customer-service', label: t('categories.customerService'), icon: null },
  ];

  // Filter templates
  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      searchQuery === '' ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // Group templates
  const popularTemplates = filteredTemplates
    .filter((t) => t.useCount > 0)
    .sort((a, b) => b.useCount - a.useCount)
    .slice(0, 5);

  const _recentTemplates = filteredTemplates.slice(0, 5);

  const handleSelectTemplate = (template: AwardTemplate) => {
    onSelect(template);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Tabs */}
          <Tabs defaultValue="all" onValueChange={setSelectedCategory}>
            <TabsList className="grid grid-cols-6 w-full">
              {categories.map((category) => (
                <TabsTrigger key={category.value} value={category.value} className="text-xs">
                  {category.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <ScrollArea className="h-[400px] mt-4">
              <TabsContent value={selectedCategory} className="mt-0 space-y-4">
                {/* Popular Templates */}
                {popularTemplates.length > 0 && selectedCategory === 'all' && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-500" />
                      {t('popular')}
                    </h3>
                    <div className="space-y-2">
                      {popularTemplates.map((template) => (
                        <TemplateCard
                          key={template.id}
                          template={template}
                          onSelect={handleSelectTemplate}
                          showUseCount
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* All Templates */}
                <div>
                  {selectedCategory === 'all' && (
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {t('allTemplates')}
                    </h3>
                  )}
                  <div className="space-y-2">
                    {filteredTemplates.length === 0 ? (
                      <p className="text-center py-8 text-muted-foreground text-sm">
                        {t('noTemplates')}
                      </p>
                    ) : (
                      filteredTemplates.map((template) => (
                        <TemplateCard
                          key={template.id}
                          template={template}
                          onSelect={handleSelectTemplate}
                        />
                      ))
                    )}
                  </div>
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TemplateCard({
  template,
  onSelect,
  showUseCount = false,
}: {
  template: AwardTemplate;
  onSelect: (template: AwardTemplate) => void;
  showUseCount?: boolean;
}) {
  return (
    <Card
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => onSelect(template)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-sm">{template.name}</h4>
              {showUseCount && template.useCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {template.useCount} uses
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">{template.message}</p>
            <div className="flex gap-1 flex-wrap">
              {template.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
          <Button size="sm" variant="ghost">
            Use
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

