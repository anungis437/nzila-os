import React from 'react';
// eslint-disable-next-line @typescript-eslint/no-unused-expressions
'use client';
import Link from 'next/link';

import { useEffect, useState } from 'react';

interface CMSPage {
  id: string;
  title: string;
  slug: string;
  content: Array<{
    id: string;
    type: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    styles?: any;
  }>;
  status: 'draft' | 'published' | 'archived';
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string[] | null;
  ogImage: string | null;
}

interface PublicPageRendererProps {
  pageSlug: string;
}

export function PublicPageRenderer({ pageSlug }: PublicPageRendererProps) {
  const [page, setPage] = useState<CMSPage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPage();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSlug]);

  const fetchPage = async () => {
    try {
      const response = await fetch(`/api/cms/pages/${pageSlug}`);
      if (!response.ok) throw new Error('Page not found');
      const data = await response.json();
      setPage(data);

      // Update page title and meta tags
      if (data.seoTitle) {
        document.title = data.seoTitle;
      } else {
        document.title = data.title;
      }

      if (data.seoDescription) {
        updateMetaTag('description', data.seoDescription);
      }

      if (data.seoKeywords) {
        updateMetaTag('keywords', data.seoKeywords.join(', '));
      }

      // Open Graph tags
      updateMetaTag('og:title', data.seoTitle || data.title, 'property');
      if (data.seoDescription) {
        updateMetaTag('og:description', data.seoDescription, 'property');
      }
      if (data.ogImage) {
        updateMetaTag('og:image', data.ogImage, 'property');
      }
    } catch (_error) {
} finally {
      setLoading(false);
    }
  };

  const updateMetaTag = (name: string, content: string, attr: string = 'name') => {
    let element = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement;
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute(attr, name);
      document.head.appendChild(element);
    }
    element.content = content;
  };

  const renderBlock = (block: CMSPage['content'][0]) => {
    const { type, content, styles } = block;

    const styleProps = styles ? { style: styles } : {};

    switch (type) {
      case 'heading':
        const HeadingTag = content.level as keyof React.JSX.IntrinsicElements;
        const headingClass =
          content.level === 'h1'
            ? 'text-4xl font-bold mb-6'
            : content.level === 'h2'
            ? 'text-3xl font-bold mb-5'
            : 'text-2xl font-semibold mb-4';
        return (
          <HeadingTag key={block.id} className={headingClass} {...styleProps}>
            {content.text}
          </HeadingTag>
        );

      case 'text':
        return (
          <p key={block.id} className="text-base leading-7 mb-4" {...styleProps}>
            {content.text}
          </p>
        );

      case 'image':
        return (
          <figure key={block.id} className="mb-6" {...styleProps}>
            {content.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={content.url}
                alt={content.alt || ''}
                className="max-w-full h-auto rounded-lg"
              />
            )}
            {content.caption && (
              <figcaption className="text-sm text-muted-foreground mt-2 text-center">
                {content.caption}
              </figcaption>
            )}
          </figure>
        );

      case 'video':
        const getVideoEmbedUrl = (url: string, platform: string) => {
          if (platform === 'youtube') {
            const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/)?.[1];
            return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
          } else if (platform === 'vimeo') {
            const videoId = url.match(/vimeo\.com\/(\d+)/)?.[1];
            return videoId ? `https://player.vimeo.com/video/${videoId}` : url;
          }
          return url;
        };

        return (
          <div key={block.id} className="aspect-video mb-6" {...styleProps}>
            <iframe
              src={getVideoEmbedUrl(content.url, content.platform)}
              className="w-full h-full rounded-lg"
              allowFullScreen
              title="Video content"
            />
          </div>
        );

      case 'button':
        const buttonVariantClass =
          content.variant === 'primary'
            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
            : content.variant === 'secondary'
            ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            : 'border border-input bg-background hover:bg-accent hover:text-accent-foreground';

        return (
          <div key={block.id} className="mb-6" {...styleProps}>
            <a
              href={content.url}
              className={`inline-flex items-center justify-center rounded-md px-6 py-3 text-sm font-medium transition-colors ${buttonVariantClass}`}
            >
              {content.text}
            </a>
          </div>
        );

      case 'hero':
        return (
          <div
            key={block.id}
            className="rounded-lg text-center text-white relative overflow-hidden mb-8"
            style={{
              backgroundImage: content.backgroundImage
                ? `url(${content.backgroundImage})`
                : 'linear-gradient(to right, #1e40af, #3b82f6)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              ...styles,
            }}
          >
            <div className="relative z-10 py-16 px-8">
              <h1 className="text-5xl font-bold mb-4">{content.heading}</h1>
              {content.subheading && <p className="text-xl mb-6">{content.subheading}</p>}
              {content.buttonText && (
                <a
                  href={content.buttonUrl}
                  className="inline-flex items-center justify-center rounded-md bg-white text-primary px-8 py-4 text-lg font-semibold hover:bg-gray-100 transition-colors"
                >
                  {content.buttonText}
                </a>
              )}
            </div>
            <div className="absolute inset-0 bg-black/40 z-0" />
          </div>
        );

      case 'features':
        return (
          <div key={block.id} className="grid md:grid-cols-3 gap-8 mb-8" {...styleProps}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {content.items?.map((item: any, index: number) => (
              <div key={index} className="text-center">
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        );

      case 'cta':
        return (
          <div
            key={block.id}
            className="rounded-lg text-center py-16 px-8 mb-8"
            {...styleProps}
          >
            <h2 className="text-3xl font-bold mb-4">{content.heading}</h2>
            {content.description && (
              <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
                {content.description}
              </p>
            )}
            {content.buttonText && (
              <a
                href={content.buttonUrl}
                className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-8 py-4 text-lg font-semibold hover:bg-primary/90 transition-colors"
              >
                {content.buttonText}
              </a>
            )}
          </div>
        );

      case 'gallery':
        return (
          <div key={block.id} className="grid md:grid-cols-3 gap-4 mb-8" {...styleProps}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {content.images?.map((image: any, index: number) => (
              <div key={index} className="aspect-square overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  alt={image.alt || ''}
                  className="w-full h-full object-cover hover:scale-105 transition-transform"
                />
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">Loading page...</p>
      </div>
    );
  }

  if (!page || page.status !== 'published') {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-bold mb-4">Page Not Found</h1>
        <p className="text-muted-foreground mb-8">
          The page you&apos;re looking for doesn&apos;t exist or is no longer available.
        </p>
        <Link href="/"
          className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-6 py-3 font-medium hover:bg-primary/90 transition-colors"
        >
          Go Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {page.content.map((block) => renderBlock(block))}
      </main>
    </div>
  );
}

