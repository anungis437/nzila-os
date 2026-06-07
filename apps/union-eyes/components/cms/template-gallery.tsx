'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Plus, Eye, Layout, FileText } from 'lucide-react';

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

interface TemplateGalleryProps {
  onSelectTemplate: (template: Template) => void;
  onCreateBlank: () => void;
}

const TEMPLATE_CATEGORIES = [
  'All',
  'Landing Pages',
  'About Us',
  'Events',
  'Campaigns',
  'News',
  'Contact',
  'Resources',
];

const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'blank',
    name: 'Blank Page',
    description: 'Start from scratch with an empty page',
    category: 'All',
    blocks: [],
    isDefault: true,
  },
  {
    id: 'landing-hero',
    name: 'Hero Landing Page',
    description: 'Landing page with large hero section and features',
    category: 'Landing Pages',
    thumbnail: '/templates/hero-landing.jpg',
    isDefault: true,
    blocks: [
      {
        id: 'hero-1',
        type: 'hero',
        content: {
          heading: 'Welcome to Our Union',
          subheading: 'Fighting for workers\' rights since 1950',
          backgroundImage: '',
          buttonText: 'Join Us',
          buttonUrl: '/join',
        },
        styles: { padding: '6rem 2rem', backgroundColor: '#1e40af' },
      },
      {
        id: 'features-1',
        type: 'features',
        content: {
          items: [
            { icon: '🛡️', title: 'Strong Representation', description: 'Expert advocates fighting for your rights' },
            { icon: '💰', title: 'Better Wages', description: 'Negotiating fair compensation packages' },
            { icon: '🤝', title: 'Community', description: 'Join thousands of united workers' },
          ],
        },
        styles: { padding: '4rem 2rem' },
      },
      {
        id: 'cta-1',
        type: 'cta',
        content: {
          heading: 'Ready to Make a Difference?',
          description: 'Join our union today and be part of something bigger',
          buttonText: 'Become a Member',
          buttonUrl: '/membership',
        },
        styles: { padding: '4rem 2rem', backgroundColor: '#f9fafb' },
      },
    ],
  },
  {
    id: 'about-us',
    name: 'About Us',
    description: 'Tell your union\'s story with this professional template',
    category: 'About Us',
    thumbnail: '/templates/about-us.jpg',
    isDefault: true,
    blocks: [
      {
        id: 'heading-1',
        type: 'heading',
        content: { level: 'h1', text: 'About Our Union' },
        styles: { marginTop: '2rem', marginBottom: '1rem' },
      },
      {
        id: 'text-1',
        type: 'text',
        content: {
          text: 'Founded in 1950, our union has been at the forefront of the labor movement, fighting for workers\' rights, fair wages, and safe working conditions. We represent over 50,000 members across the country.',
        },
        styles: { marginBottom: '2rem' },
      },
      {
        id: 'heading-2',
        type: 'heading',
        content: { level: 'h2', text: 'Our Mission' },
        styles: { marginTop: '3rem', marginBottom: '1rem' },
      },
      {
        id: 'text-2',
        type: 'text',
        content: {
          text: 'To empower workers through collective action, advocate for social and economic justice, and build a better future for all working families.',
        },
        styles: { marginBottom: '2rem' },
      },
      {
        id: 'heading-3',
        type: 'heading',
        content: { level: 'h2', text: 'Our Values' },
        styles: { marginTop: '3rem', marginBottom: '1rem' },
      },
      {
        id: 'features-1',
        type: 'features',
        content: {
          items: [
            { icon: '⚖️', title: 'Fairness', description: 'Equal treatment and opportunity for all' },
            { icon: '💪', title: 'Solidarity', description: 'Stronger together than apart' },
            { icon: '🎯', title: 'Integrity', description: 'Honest and transparent representation' },
          ],
        },
        styles: { padding: '2rem 0' },
      },
    ],
  },
  {
    id: 'event-registration',
    name: 'Event Registration',
    description: 'Promote events with registration details',
    category: 'Events',
    thumbnail: '/templates/event-registration.jpg',
    isDefault: true,
    blocks: [
      {
        id: 'hero-1',
        type: 'hero',
        content: {
          heading: 'Annual Labor Day Rally',
          subheading: 'Join us for a day of solidarity, speeches, and celebration',
          backgroundImage: '',
          buttonText: 'Register Now',
          buttonUrl: '#register',
        },
        styles: { padding: '5rem 2rem', backgroundColor: '#1e40af' },
      },
      {
        id: 'heading-1',
        type: 'heading',
        content: { level: 'h2', text: 'Event Details' },
        styles: { marginTop: '3rem', marginBottom: '1rem' },
      },
      {
        id: 'text-1',
        type: 'text',
        content: {
          text: '📅 Date: September 2, 2024\n📍 Location: City Hall Plaza\n⏰ Time: 10:00 AM - 4:00 PM\n\nJoin thousands of union members for our annual Labor Day celebration. Enjoy live music, food trucks, family activities, and inspiring speeches from labor leaders.',
        },
        styles: { marginBottom: '2rem' },
      },
      {
        id: 'cta-1',
        type: 'cta',
        content: {
          heading: 'Save Your Spot',
          description: 'Free admission - registration required',
          buttonText: 'Register Today',
          buttonUrl: '/events/labor-day-rally/register',
        },
        styles: { padding: '3rem 2rem', backgroundColor: '#f9fafb' },
      },
    ],
  },
  {
    id: 'donation-campaign',
    name: 'Donation Campaign',
    description: 'Fundraising page with compelling call-to-action',
    category: 'Campaigns',
    thumbnail: '/templates/donation-campaign.jpg',
    isDefault: true,
    blocks: [
      {
        id: 'heading-1',
        type: 'heading',
        content: { level: 'h1', text: 'Support Our Strike Fund' },
        styles: { marginTop: '2rem', marginBottom: '1rem' },
      },
      {
        id: 'text-1',
        type: 'text',
        content: {
          text: 'Our members are fighting for fair contracts and better working conditions. Your donation helps provide essential support during this critical time.',
        },
        styles: { marginBottom: '2rem' },
      },
      {
        id: 'hero-1',
        type: 'hero',
        content: {
          heading: '$125,000 Raised',
          subheading: 'Goal: $250,000 - We\'re halfway there!',
          backgroundImage: '',
          buttonText: 'Donate Now',
          buttonUrl: '#donate',
        },
        styles: { padding: '4rem 2rem', backgroundColor: '#059669' },
      },
      {
        id: 'heading-2',
        type: 'heading',
        content: { level: 'h2', text: 'How Your Donation Helps' },
        styles: { marginTop: '3rem', marginBottom: '1rem' },
      },
      {
        id: 'features-1',
        type: 'features',
        content: {
          items: [
            { icon: '🏠', title: 'Rent & Utilities', description: 'Help families stay in their homes' },
            { icon: '🍽️', title: 'Food Support', description: 'Grocery assistance for striking workers' },
            { icon: '⚖️', title: 'Legal Defense', description: 'Fund representation in negotiations' },
          ],
        },
        styles: { padding: '2rem 0' },
      },
    ],
  },
  {
    id: 'news-article',
    name: 'News Article',
    description: 'Clean layout for news and updates',
    category: 'News',
    thumbnail: '/templates/news-article.jpg',
    isDefault: true,
    blocks: [
      {
        id: 'heading-1',
        type: 'heading',
        content: { level: 'h1', text: 'Union Wins Major Contract Victory' },
        styles: { marginTop: '2rem', marginBottom: '0.5rem' },
      },
      {
        id: 'text-1',
        type: 'text',
        content: {
          text: 'Published: January 15, 2024 | By: Communications Team',
        },
        styles: { marginBottom: '2rem', color: '#6b7280' },
      },
      {
        id: 'image-1',
        type: 'image',
        content: {
          url: '',
          alt: 'Union members celebrating contract victory',
          caption: 'Members celebrate after ratifying new three-year agreement',
        },
        styles: { marginBottom: '2rem' },
      },
      {
        id: 'text-2',
        type: 'text',
        content: {
          text: 'In a historic vote, union members ratified a new three-year contract that delivers significant wage increases, improved healthcare benefits, and stronger job protections.\n\nThe agreement includes:\n\n• 15% wage increase over three years\n• Enhanced healthcare coverage with lower out-of-pocket costs\n• Additional paid time off\n• Stronger workplace safety provisions\n\n"This contract is a testament to the power of collective bargaining," said Union President Jane Smith. "Our members stood together, and we achieved a deal that respects their contributions and secures their futures."',
        },
        styles: { marginBottom: '2rem' },
      },
    ],
  },
  {
    id: 'contact',
    name: 'Contact Page',
    description: 'Help members get in touch with multiple contact methods',
    category: 'Contact',
    thumbnail: '/templates/contact.jpg',
    isDefault: true,
    blocks: [
      {
        id: 'heading-1',
        type: 'heading',
        content: { level: 'h1', text: 'Contact Us' },
        styles: { marginTop: '2rem', marginBottom: '1rem' },
      },
      {
        id: 'text-1',
        type: 'text',
        content: {
          text: 'Have questions? Need assistance? Our team is here to help. Reach out using any of the methods below.',
        },
        styles: { marginBottom: '3rem' },
      },
      {
        id: 'heading-2',
        type: 'heading',
        content: { level: 'h2', text: 'Office Locations' },
        styles: { marginTop: '2rem', marginBottom: '1rem' },
      },
      {
        id: 'features-1',
        type: 'features',
        content: {
          items: [
            {
              icon: '📍',
              title: 'Main Office',
              description: '123 Union Street\nCity, ST 12345\n\n📞 (555) 123-4567\n✉️ info@union.org',
            },
            {
              icon: '📍',
              title: 'Regional Office',
              description: '456 Worker Ave\nTown, ST 67890\n\n📞 (555) 987-6543\n✉️ regional@union.org',
            },
            {
              icon: '⏰',
              title: 'Office Hours',
              description: 'Monday - Friday\n9:00 AM - 5:00 PM\n\nEmergency: 24/7\n📞 (555) 911-HELP',
            },
          ],
        },
        styles: { padding: '2rem 0' },
      },
      {
        id: 'cta-1',
        type: 'cta',
        content: {
          heading: 'Send Us a Message',
          description: 'Fill out our contact form and we\'ll get back to you within 24 hours',
          buttonText: 'Contact Form',
          buttonUrl: '/contact-form',
        },
        styles: { padding: '3rem 2rem', backgroundColor: '#f9fafb', marginTop: '3rem' },
      },
    ],
  },
  {
    id: 'resources',
    name: 'Resource Library',
    description: 'Organize and share important documents and links',
    category: 'Resources',
    thumbnail: '/templates/resources.jpg',
    isDefault: true,
    blocks: [
      {
        id: 'heading-1',
        type: 'heading',
        content: { level: 'h1', text: 'Member Resources' },
        styles: { marginTop: '2rem', marginBottom: '1rem' },
      },
      {
        id: 'text-1',
        type: 'text',
        content: {
          text: 'Access important documents, guides, and resources for union members. Everything you need in one place.',
        },
        styles: { marginBottom: '3rem' },
      },
      {
        id: 'heading-2',
        type: 'heading',
        content: { level: 'h2', text: 'Contracts & Agreements' },
        styles: { marginTop: '2rem', marginBottom: '1rem' },
      },
      {
        id: 'text-2',
        type: 'text',
        content: {
          text: '📄 Current Collective Bargaining Agreement (PDF)\n📄 Wage Scale & Classification Guide (PDF)\n📄 Benefits Summary (PDF)\n📄 Grievance Procedure (PDF)',
        },
        styles: { marginBottom: '3rem' },
      },
      {
        id: 'heading-3',
        type: 'heading',
        content: { level: 'h2', text: 'Forms & Applications' },
        styles: { marginTop: '2rem', marginBottom: '1rem' },
      },
      {
        id: 'text-3',
        type: 'text',
        content: {
          text: '📝 Membership Application\n📝 Grievance Filing Form\n📝 Scholarship Application\n📝 Dues Adjustment Request',
        },
        styles: { marginBottom: '3rem' },
      },
      {
        id: 'heading-4',
        type: 'heading',
        content: { level: 'h2', text: 'Educational Materials' },
        styles: { marginTop: '2rem', marginBottom: '1rem' },
      },
      {
        id: 'text-4',
        type: 'text',
        content: {
          text: '📚 Know Your Rights Handbook\n📚 Workplace Safety Guide\n📚 Leadership Training Resources\n📚 Organizing Manual',
        },
        styles: { marginBottom: '2rem' },
      },
    ],
  },
];

export function TemplateGallery({ onSelectTemplate, onCreateBlank }: TemplateGalleryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [templates, _setTemplates] = useState<Template[]>(DEFAULT_TEMPLATES);
  const [filteredTemplates, setFilteredTemplates] = useState<Template[]>(DEFAULT_TEMPLATES);

  useEffect(() => {
    let filtered = templates;

    // Filter by category
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(t => t.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        t =>
          t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilteredTemplates(filtered);
  }, [searchQuery, selectedCategory, templates]);

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Choose a Template</h1>
        <p className="text-muted-foreground">
          Start with a professionally designed template or create a blank page
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TEMPLATE_CATEGORIES.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Blank Page Card */}
        <Card
          className="cursor-pointer hover:shadow-lg transition-shadow overflow-hidden group"
          onClick={onCreateBlank}
        >
          <div className="aspect-video bg-linear-to-br from-muted to-muted/50 flex items-center justify-center">
            <Plus className="h-16 w-16 text-muted-foreground group-hover:scale-110 transition-transform" />
          </div>
          <div className="p-4">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold">Blank Page</h3>
              <Badge variant="secondary">Empty</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Start from scratch with a clean slate
            </p>
          </div>
        </Card>

        {/* Template Cards */}
        {filteredTemplates.map((template) => (
          <Card
            key={template.id}
            className="cursor-pointer hover:shadow-lg transition-shadow overflow-hidden group"
            onClick={() => onSelectTemplate(template)}
          >
            <div className="aspect-video bg-linear-to-br from-primary/10 to-primary/5 flex items-center justify-center relative overflow-hidden">
              {template.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={template.thumbnail}
                  alt={template.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Layout className="h-16 w-16 text-primary/40 group-hover:scale-110 transition-transform" />
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <Button size="sm" variant="secondary">
                  <Eye className="h-4 w-4 mr-2" />
                  Use Template
                </Button>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold">{template.name}</h3>
                <Badge variant="outline">{template.category}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{template.description}</p>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <FileText className="h-3 w-3" />
                {template.blocks.length} blocks
              </div>
            </div>
          </Card>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-16">
          <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No templates found</h3>
          <p className="text-muted-foreground mb-4">
            Try adjusting your search or category filter
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('All');
            }}
          >
            Clear Filters
          </Button>
        </div>
      )}
    </div>
  );
}

