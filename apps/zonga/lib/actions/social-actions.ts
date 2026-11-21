/** Personal ownership and explicit published creator/content projections. */
'use server'
import { resolveOrgContext } from '@/lib/resolve-org'
import {
  follow,
  unfollow,
  followers,
  following,
  favorite,
  unfavorite,
  favoriteCount,
  comment,
  comments,
  tip,
  publicSocialStats,
  type Follow,
  type Comment,
  type SocialStats,
} from '@/lib/services/listener-social'
export type { Follow, Like, Comment, SocialStats } from '@/lib/services/listener-social'
export async function followCreator(creatorId: string): Promise<{ success: boolean }> {
  return resolveOrgContext('personal', (context) => follow(context, creatorId))
}
export async function followUser(creatorId: string): Promise<{ success: boolean }> {
  return resolveOrgContext('personal', (context) => follow(context, creatorId))
}
export async function unfollowCreator(creatorId: string): Promise<{ success: boolean }> {
  return resolveOrgContext('personal', (context) => unfollow(context, creatorId))
}
export async function unfollowUser(creatorId: string): Promise<{ success: boolean }> {
  return resolveOrgContext('personal', (context) => unfollow(context, creatorId))
}
export async function listFollowers(creatorId: string): Promise<Follow[]> {
  return resolveOrgContext('personal', (context) => followers(context, creatorId))
}
export async function listFollowing(userId?: string): Promise<Follow[]> {
  return resolveOrgContext('personal', (context) => following(context, userId))
}
export async function favoriteEntity(
  entityType: string,
  targetEntityId: string,
): Promise<{ success: boolean }> {
  return resolveOrgContext('personal', (context) => favorite(context, entityType, targetEntityId))
}
export async function likeAsset(
  assetId: string,
  _assetTitle?: string,
): Promise<{ success: boolean }> {
  return resolveOrgContext('personal', (context) => favorite(context, 'asset', assetId))
}
export async function unfavoriteEntity(targetEntityId: string): Promise<{ success: boolean }> {
  return resolveOrgContext('personal', (context) => unfavorite(context, targetEntityId))
}
export async function unlikeAsset(assetId: string): Promise<{ success: boolean }> {
  return resolveOrgContext('personal', (context) => unfavorite(context, assetId))
}
export async function getEntityFavoriteCount(
  targetEntityId: string,
  entityType = 'asset',
): Promise<number> {
  return resolveOrgContext('published', (context) =>
    favoriteCount(context, targetEntityId, entityType),
  )
}
export async function getAssetLikeCount(assetId: string): Promise<number> {
  return resolveOrgContext('published', (context) => favoriteCount(context, assetId, 'asset'))
}
export async function postComment(data: {
  assetId: string
  content: string
  userName?: string
}): Promise<{ success: boolean; commentId?: string }> {
  return resolveOrgContext('personal', (context) => comment(context, data))
}
export async function listComments(assetId: string): Promise<Comment[]> {
  return resolveOrgContext('published', (context) => comments(context, assetId))
}
export async function tipCreator(data: {
  creatorId: string
  creatorName?: string
  amount: number
  currency: string
  message?: string
}): Promise<{ success: boolean }> {
  return resolveOrgContext('personal', (context) => tip(context, data))
}
export async function getSocialStats(targetEntityId: string): Promise<SocialStats> {
  return resolveOrgContext('published', (context) => publicSocialStats(context, targetEntityId))
}
