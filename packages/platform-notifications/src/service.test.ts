import { describe, it, expect, beforeEach } from 'vitest'
import {
  createInMemoryNotificationService,
  type NotificationService,
} from './service.js'

describe('InMemoryNotificationService', () => {
  let svc: NotificationService

  beforeEach(() => {
    svc = createInMemoryNotificationService()
  })

  it('sends a notification and returns it', async () => {
    const result = await svc.send({
      orgId: 'org-1',
      recipientUserId: 'user-1',
      title: 'Test',
      body: 'Hello',
      channels: ['in_app'],
    })

    expect(result.id).toBeDefined()
    expect(result.orgId).toBe('org-1')
    expect(result.read).toBe(false)
  })

  it('lists unread notifications', async () => {
    await svc.send({
      orgId: 'org-1',
      recipientUserId: 'user-1',
      title: 'N1',
      body: 'B1',
      channels: ['in_app'],
    })
    await svc.send({
      orgId: 'org-1',
      recipientUserId: 'user-1',
      title: 'N2',
      body: 'B2',
      channels: ['email'],
    })

    const unread = await svc.listUnread('org-1', 'user-1')
    expect(unread).toHaveLength(2)
  })

  it('marks a single notification as read', async () => {
    const n = await svc.send({
      orgId: 'org-1',
      recipientUserId: 'user-1',
      title: 'N1',
      body: 'B1',
      channels: ['in_app'],
    })

    await svc.markRead('org-1', n.id)
    const unread = await svc.listUnread('org-1', 'user-1')
    expect(unread).toHaveLength(0)
  })

  it('marks all notifications as read', async () => {
    await svc.send({ orgId: 'org-1', recipientUserId: 'user-1', title: 'A', body: 'a', channels: ['in_app'] })
    await svc.send({ orgId: 'org-1', recipientUserId: 'user-1', title: 'B', body: 'b', channels: ['in_app'] })

    await svc.markAllRead('org-1', 'user-1')
    const unread = await svc.listUnread('org-1', 'user-1')
    expect(unread).toHaveLength(0)
  })

  it('returns correct unread count per channel', async () => {
    await svc.send({ orgId: 'org-1', recipientUserId: 'user-1', title: 'T', body: 'B', channels: ['in_app', 'email'] })

    const count = await svc.getUnreadCount('org-1', 'user-1')
    expect(count.total).toBe(1)
    expect(count.byChannel.in_app).toBe(1)
    expect(count.byChannel.email).toBe(1)
    expect(count.byChannel.sms).toBe(0)
  })

  it('scopes notifications by org', async () => {
    await svc.send({ orgId: 'org-1', recipientUserId: 'user-1', title: 'T', body: 'B', channels: ['in_app'] })
    await svc.send({ orgId: 'org-2', recipientUserId: 'user-1', title: 'T', body: 'B', channels: ['in_app'] })

    const unread = await svc.listUnread('org-1', 'user-1')
    expect(unread).toHaveLength(1)
  })
})
