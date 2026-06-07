// ================================================================
// SOCIAL MEDIA POST COMPOSER
// ================================================================
// Advanced multi-platform post composer with media upload, scheduling,
// hashtag suggestions, mentions, and platform-specific previews
// Created: December 7, 2025
// ================================================================

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
 
import {
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  Youtube,
  Calendar as CalendarIcon,
  Send,
  Image as ImageIcon,
  Video,
  Link as _LinkIcon,
  Hash,
  AtSign,
  Smile,
  MapPin,
  X,
  Upload as _Upload,
  Clock,
  Save,
  Eye,
  Sparkles,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { format, addDays, addHours } from 'date-fns';

// ================================================================
// TYPES
// ================================================================

type SocialPlatform = 'facebook' | 'twitter' | 'instagram' | 'linkedin' | 'youtube' | 'tiktok';
type PostType = 'text' | 'image' | 'video' | 'link' | 'carousel' | 'story' | 'reel';

interface SocialAccount {
  id: string;
  platform: SocialPlatform;
  username: string;
  displayName: string;
  characterLimit?: number;
  supportsTypes: PostType[];
}

interface MediaFile {
  id: string;
  file: File;
  preview: string;
  type: 'image' | 'video';
}

interface HashtagSuggestion {
  tag: string;
  popularity: number;
  relevance: number;
}

interface _PostPreview {
  platform: SocialPlatform;
  content: string;
  media: MediaFile[];
  hashtags: string[];
  mentions: string[];
}

// ================================================================
// QUICK SCHEDULE OPTIONS
// ================================================================

const quickScheduleOptions = [
  { label: 'Now', date: new Date() },
  { label: 'In 1 hour', date: addHours(new Date(), 1) },
  { label: 'Tomorrow 9 AM', date: addHours(addDays(new Date(), 1), 9 - new Date().getHours()) },
  { label: 'Next Monday 9 AM', date: addDays(new Date(), 7) }
];

// ================================================================
// HELPER FUNCTIONS
// ================================================================

const getPlatformIcon = (platform: SocialPlatform) => {
  const icons = {
    facebook: Facebook,
    twitter: Twitter,
    instagram: Instagram,
    linkedin: Linkedin,
    youtube: Youtube,
    tiktok: Video
  };
  return icons[platform];
};

const getPlatformColor = (platform: SocialPlatform): string => {
  const colors = {
    facebook: 'bg-blue-600',
    twitter: 'bg-sky-500',
    instagram: 'bg-linear-to-tr from-purple-600 via-pink-600 to-orange-500',
    linkedin: 'bg-blue-700',
    youtube: 'bg-red-600',
    tiktok: 'bg-black'
  };
  return colors[platform];
};

const extractHashtags = (text: string): string[] => {
  const regex = /#(\w+)/g;
  const matches = text.match(regex);
  return matches ? matches.map(tag => tag.slice(1)) : [];
};

const extractMentions = (text: string): string[] => {
  const regex = /@(\w+)/g;
  const matches = text.match(regex);
  return matches ? matches.map(mention => mention.slice(1)) : [];
};

// ================================================================
// MAIN COMPONENT
// ================================================================

export default function SocialMediaPostComposer() {
  const [availableAccounts, setAvailableAccounts] = useState<SocialAccount[]>([]);
  const [hashtagSuggestions, setHashtagSuggestions] = useState<HashtagSuggestion[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [postType, setPostType] = useState<PostType>('text');
  const [content, setContent] = useState('');
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [linkUrl, setLinkUrl] = useState('');
  const [location, setLocation] = useState('');
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [showHashtagSuggestions, setShowHashtagSuggestions] = useState(false);
  const [_showEmojiPicker, _setShowEmojiPicker] = useState(false);
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [useAIOptimization, setUseAIOptimization] = useState(true);
  const [previewPlatform, setPreviewPlatform] = useState<SocialPlatform>('facebook');
  const [_loading, setLoading] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v2/social-media/accounts');
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : data?.results ?? data?.data ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const accounts = items.map((a: any) => ({
          id: String(a.id),
          platform: a.platform,
          username: a.username,
          displayName: a.displayName ?? a.display_name ?? a.username,
          characterLimit: a.characterLimit ?? a.character_limit,
          supportsTypes: a.supportsTypes ?? a.supports_types ?? ['text', 'image'],
        }));
        setAvailableAccounts(accounts);
        if (accounts.length > 0) setSelectedAccounts(accounts.map((a: SocialAccount) => a.id));
      }
      // Fetch hashtag suggestions
      const hashRes = await fetch('/api/v2/social-media/hashtag-suggestions');
      if (hashRes.ok) {
        const data = await hashRes.json();
        setHashtagSuggestions(Array.isArray(data) ? data : data?.results ?? data?.data ?? []);
      }
    } catch {
      // API not available — empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);
  
  const hashtags = extractHashtags(content);
  const _mentions = extractMentions(content);
  const selectedAccountsData = availableAccounts.filter(a => selectedAccounts.includes(a.id));
  
  // Character limits for selected platforms
  const minCharLimit = Math.min(
    ...selectedAccountsData
      .filter(a => a.characterLimit)
      .map(a => a.characterLimit!)
  );
  const charCount = content.length;
  const isOverLimit = charCount > minCharLimit;

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const newMedia: MediaFile[] = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      preview: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? 'video' : 'image'
    }));
    setMediaFiles(prev => [...prev, ...newMedia]);
  };

  // Remove media file
  const removeMedia = (id: string) => {
    setMediaFiles(prev => prev.filter(m => m.id !== id));
  };

  // Toggle account selection
  const toggleAccount = (accountId: string) => {
    setSelectedAccounts(prev =>
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  // Add hashtag to content
  const addHashtag = (tag: string) => {
    if (!content.includes(`#${tag}`)) {
      setContent(prev => `${prev} #${tag}`.trim());
    }
    setShowHashtagSuggestions(false);
  };

  // Generate AI content
  const generateAIContent = async () => {
    setIsGeneratingContent(true);
    // Simulate API call
    setTimeout(() => {
      setContent('Join us for our monthly membership meeting! We\'ll discuss the new contract proposal, upcoming strike vote, and member concerns. Your voice matters! 💪 #UnionStrong #WorkersRights');
      setIsGeneratingContent(false);
    }, 2000);
  };

  // Optimize content with AI
  const optimizeContent = async () => {
    setIsGeneratingContent(true);
    // Simulate API call
    setTimeout(() => {
      setContent(prev => `${prev}\n\n🔔 Don&apos;t miss out! RSVP today.`);
      setIsGeneratingContent(false);
    }, 1500);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Compose Post</h1>
          <p className="text-muted-foreground">
            Create engaging content for your audience
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button variant="outline" size="sm">
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Composer */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Post Content</CardTitle>
              <CardDescription>Create your post and select where to publish</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Platform Selection */}
              <div className="space-y-2">
                <Label>Select Platforms</Label>
                <div className="flex flex-wrap gap-2">
                  {availableAccounts.map(account => {
                    const Icon = getPlatformIcon(account.platform);
                    const isSelected = selectedAccounts.includes(account.id);
                    return (
                      <Button
                        key={account.id}
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleAccount(account.id)}
                        className={isSelected ? getPlatformColor(account.platform) : ''}
                      >
                        <Icon className="h-4 w-4 mr-2" />
                        {account.displayName}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Post Type */}
              <div className="space-y-2">
                <Label>Post Type</Label>
                <Select value={postType} onValueChange={(value) => setPostType(value as PostType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text Post</SelectItem>
                    <SelectItem value="image">Image Post</SelectItem>
                    <SelectItem value="video">Video Post</SelectItem>
                    <SelectItem value="link">Link Post</SelectItem>
                    <SelectItem value="carousel">Carousel</SelectItem>
                    <SelectItem value="story">Story</SelectItem>
                    <SelectItem value="reel">Reel</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* AI Content Generation */}
              <div className="flex items-center justify-between p-4 border rounded-lg bg-linear-to-r from-purple-50 to-blue-50">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  <div>
                    <div className="font-medium text-sm">AI-Powered Content</div>
                    <div className="text-xs text-muted-foreground">
                      Generate engaging post ideas automatically
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={generateAIContent}
                    disabled={isGeneratingContent}
                  >
                    {isGeneratingContent ? 'Generating...' : 'Generate'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={optimizeContent}
                    disabled={!content || isGeneratingContent}
                  >
                    Optimize
                  </Button>
                </div>
              </div>

              {/* Content Editor */}
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  placeholder="What&apos;s on your mind?"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={8}
                  className={`resize-none ${isOverLimit ? 'border-red-500' : ''}`}
                />
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <ImageIcon className="h-4 w-4 mr-1" />
                      Media
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowHashtagSuggestions(!showHashtagSuggestions)}
                    >
                      <Hash className="h-4 w-4 mr-1" />
                      Hashtag
                    </Button>
                    <Button variant="ghost" size="sm">
                      <AtSign className="h-4 w-4 mr-1" />
                      Mention
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Smile className="h-4 w-4 mr-1" />
                      Emoji
                    </Button>
                    <Button variant="ghost" size="sm">
                      <MapPin className="h-4 w-4 mr-1" />
                      Location
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${isOverLimit ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                      {charCount} / {minCharLimit}
                    </span>
                    <Progress
                      value={(charCount / minCharLimit) * 100}
                      className={`w-20 ${isOverLimit ? 'bg-red-100' : ''}`}
                    />
                  </div>
                </div>
                {isOverLimit && (
                  <div className="flex items-center gap-2 text-sm text-red-500">
                    <AlertCircle className="h-4 w-4" />
                    Content exceeds character limit for Twitter
                  </div>
                )}
              </div>

              {/* Hashtag Suggestions */}
              {showHashtagSuggestions && (
                <div className="space-y-2">
                  <Label>Suggested Hashtags</Label>
                  <div className="flex flex-wrap gap-2 p-4 border rounded-lg bg-muted/30">
                    {hashtagSuggestions.map(suggestion => (
                      <Button
                        key={suggestion.tag}
                        variant="secondary"
                        size="sm"
                        onClick={() => addHashtag(suggestion.tag)}
                        disabled={content.includes(`#${suggestion.tag}`)}
                      >
                        #{suggestion.tag}
                        <TrendingUp className="h-3 w-3 ml-2 text-green-600" />
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Media Preview */}
              {mediaFiles.length > 0 && (
                <div className="space-y-2">
                  <Label>Media ({mediaFiles.length})</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {mediaFiles.map(media => (
                      <div key={media.id} className="relative group">
                        {media.type === 'image' ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={media.preview}
                            alt="Upload preview"
                            className="w-full h-32 object-cover rounded-lg"
                          />
                        ) : (
                          <video
                            src={media.preview}
                            className="w-full h-32 object-cover rounded-lg"
                          />
                        )}
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeMedia(media.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />

              {/* Link URL (if link post type) */}
              {postType === 'link' && (
                <div className="space-y-2">
                  <Label>Link URL</Label>
                  <Input
                    type="url"
                    placeholder="https://..."
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                  />
                </div>
              )}

              {/* Location */}
              <div className="space-y-2">
                <Label>Location (Optional)</Label>
                <Input
                  placeholder="Add location..."
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>

              {/* Scheduling */}
              <div className="space-y-2">
                <Label>Schedule Post</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {quickScheduleOptions.map(option => (
                    <Button
                      key={option.label}
                      variant="outline"
                      size="sm"
                      onClick={() => setScheduledDate(option.date)}
                    >
                      <Clock className="h-3 w-3 mr-1" />
                      {option.label}
                    </Button>
                  ))}
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {scheduledDate ? format(scheduledDate, 'PPP p') : 'Post immediately'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={scheduledDate}
                      onSelect={setScheduledDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <Button className="flex-1" disabled={!content || isOverLimit}>
                  <Send className="h-4 w-4 mr-2" />
                  {scheduledDate ? 'Schedule Post' : 'Publish Now'}
                </Button>
                <Button variant="outline">
                  Save Draft
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Preview & Insights */}
        <div className="space-y-6">
          {/* Preview Card */}
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>How your post will appear</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={previewPlatform} onValueChange={(value) => setPreviewPlatform(value as SocialPlatform)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {selectedAccountsData.map(account => {
                    const Icon = getPlatformIcon(account.platform);
                    return (
                      <SelectItem key={account.id} value={account.platform}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {account.platform}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              <div className="border rounded-lg p-4 bg-white">
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-full ${getPlatformColor(previewPlatform)} shrink-0`} />
                  <div className="flex-1">
                    <div className="font-medium text-sm">
                      {selectedAccountsData.find(a => a.platform === previewPlatform)?.displayName}
                    </div>
                    <div className="text-xs text-muted-foreground">Just now</div>
                  </div>
                </div>
                <p className="text-sm whitespace-pre-wrap break-words">
                  {content || 'Your post content will appear here...'}
                </p>
                {mediaFiles.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {mediaFiles.slice(0, 4).map(media => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={media.id}
                        src={media.preview}
                        alt="Preview"
                        className="w-full h-24 object-cover rounded"
                      />
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Insights Card */}
          <Card>
            <CardHeader>
              <CardTitle>Post Insights</CardTitle>
              <CardDescription>Optimization recommendations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Content Quality</span>
                  <span className="font-medium text-green-600">Excellent</span>
                </div>
                <Progress value={85} className="bg-green-100" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Hashtags</span>
                  <span className="font-medium">{hashtags.length} / 5</span>
                </div>
                <Progress value={(hashtags.length / 5) * 100} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Best Time to Post</span>
                  <span className="font-medium text-blue-600">Now</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Your audience is most active right now
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">AI Optimization</Label>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Automatically optimize posts
                  </span>
                  <Switch
                    checked={useAIOptimization}
                    onCheckedChange={setUseAIOptimization}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Statistics Card */}
          <Card>
            <CardHeader>
              <CardTitle>Estimated Reach</CardTitle>
              <CardDescription>Based on your audience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Followers</span>
                <span className="font-medium">40.2K</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Estimated Reach</span>
                <span className="font-medium">8.5K - 12K</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Engagement Rate</span>
                <span className="font-medium text-green-600">4.2%</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

