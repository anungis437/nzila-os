/** Personal listener ownership and fixed authenticated published projections. */
'use server'
import { resolveOrgContext } from '@/lib/resolve-org'
import {
  profile,
  ensureProfile,
  updateProfile,
  feed,
  activity,
  save,
  unsave,
  saved,
  artists,
  releases,
  recommendations,
  type ListenerProfile,
  type ListenerActivity,
  type SavedPlaylist,
  type DiscoverArtist,
  type DiscoverRelease,
  type ListenerRecommendation,
} from '@/lib/services/listener-library'
export type {
  ListenerProfile,
  ListenerActivity,
  SavedPlaylist,
  DiscoverArtist,
  DiscoverRelease,
  ListenerRecommendation,
} from '@/lib/services/listener-library'
export async function getListenerProfile(listenerId?: string): Promise<ListenerProfile | null> {
  return resolveOrgContext('personal', (context) => profile(context, listenerId))
}
export async function ensureListenerProfile(data: {
  displayName: string
  email?: string
}): Promise<{ id: string }> {
  return resolveOrgContext('personal', (context) => ensureProfile(context, data))
}
export async function updateListenerProfile(data: {
  displayName?: string
  email?: string
  avatarUrl?: string
  bio?: string
  city?: string
  country?: string
}): Promise<{ success: true } | { success: false; error: string }> {
  return resolveOrgContext('personal', (context) => updateProfile(context, data))
}
export async function getListenerFeed(opts?: { limit?: number }): Promise<ListenerActivity[]> {
  return resolveOrgContext('personal', (context) => feed(context, opts))
}
export async function recordActivity(data: {
  activityType: string
  entityType: string
  targetEntityId: string
  metadata?: Record<string, unknown>
}): Promise<{ success: boolean }> {
  return resolveOrgContext('personal', (context) => activity(context, data))
}
export async function savePlaylist(playlistId: string): Promise<{ success: boolean }> {
  return resolveOrgContext('personal', (context) => save(context, playlistId))
}
export async function unsavePlaylist(playlistId: string): Promise<{ success: boolean }> {
  return resolveOrgContext('personal', (context) => unsave(context, playlistId))
}
export async function listSavedPlaylists(): Promise<SavedPlaylist[]> {
  return resolveOrgContext('personal', saved)
}
export async function discoverArtists(opts?: {
  genre?: string
  country?: string
  limit?: number
}): Promise<DiscoverArtist[]> {
  return resolveOrgContext('published', (context) => artists(context, opts))
}
export async function discoverReleases(opts?: { limit?: number }): Promise<DiscoverRelease[]> {
  return resolveOrgContext('published', (context) => releases(context, opts))
}
export async function getRecommendationsForUser(opts?: {
  limit?: number
}): Promise<{ items: ListenerRecommendation[]; strategy: string }> {
  return resolveOrgContext('personal', (context) => recommendations(context, opts))
}
