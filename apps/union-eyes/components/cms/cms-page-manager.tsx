'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageBuilder } from './page-builder';
import { TemplateGallery } from './template-gallery';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  thumbnail?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blocks: any[];
  isDefault: boolean;
}

export default function CMSPageManager() {
  const [showTemplateGallery, setShowTemplateGallery] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const router = useRouter();

  const handleSelectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setShowTemplateGallery(false);
  };

  const handleCreateBlank = () => {
    setSelectedTemplate({
      id: 'blank',
      name: 'Blank Page',
      description: 'Empty page',
      category: 'All',
      blocks: [],
      isDefault: true,
    });
    setShowTemplateGallery(false);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSavePage = async (blocks: any[], pageData: any) => {
    try {
      // API call to save the page
      const response = await fetch('/api/cms/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: pageData.title,
          slug: pageData.slug,
          metaDescription: pageData.metaDescription,
          content: blocks,
          status: 'draft',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save page');
      }

      const data = await response.json();
      router.push(`/cms/pages/${data.id}`);
    } catch (error) {
throw error;
    }
  };

  if (showTemplateGallery) {
    return (
      <TemplateGallery
        onSelectTemplate={handleSelectTemplate}
        onCreateBlank={handleCreateBlank}
      />
    );
  }

  return (
    <PageBuilder
      initialBlocks={selectedTemplate?.blocks || []}
      onSave={handleSavePage}
      pageTitle=""
      pageSlug=""
    />
  );
}

