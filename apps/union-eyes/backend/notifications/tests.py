"""
Tests for notifications models.
"""

import uuid

from auth_core.models import Organizations
from django.test import TestCase

from .models import (
    Campaigns,
    CommunicationChannels,
    CommunicationPreferences,
    CommunicationPreferencesPhase4,
    InAppNotifications,
    MessageLog,
    MessageNotifications,
    MessageParticipants,
    MessageReadReceipts,
    Messages,
    MessageTemplates,
    MessageThreads,
    MobileAnalytics,
    MobileAppConfig,
    MobileDevices,
    MobileNotifications,
    MobileSyncQueue,
    NewsletterCampaigns,
    NewsletterDistributionLists,
    NewsletterEngagement,
    NewsletterListSubscribers,
    NewsletterRecipients,
    NewsletterTemplates,
    NotificationBounces,
    NotificationDeliveryLog,
    NotificationHistory,
    NotificationLog,
    NotificationQueue,
    Notifications,
    NotificationTemplates,
    NotificationTracking,
    PushDeliveries,
    PushDevices,
    PushNotifications,
    PushNotificationTemplates,
    SmsCampaignRecipients,
    SmsCampaigns,
    SmsConversations,
    SmsMessages,
    SmsOptOuts,
    SmsRateLimits,
    SmsTemplates,
    UserNotificationPreferences,
)

# ---------------------------------------------------------------------------
# CLC / Communication basics
# ---------------------------------------------------------------------------


class NotificationLogModelTest(TestCase):
    def test_create(self):
        obj = NotificationLog.objects.create(
            organization_id=uuid.uuid4(),
            type="email",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.type, "email")

    def test_str(self):
        obj = NotificationLog.objects.create(organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class CommunicationPreferencesModelTest(TestCase):
    def test_create(self):
        obj = CommunicationPreferences.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = CommunicationPreferences.objects.create()
        self.assertIsInstance(str(obj), str)


class MessageTemplatesModelTest(TestCase):
    def test_create(self):
        obj = MessageTemplates.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = MessageTemplates.objects.create()
        self.assertIsInstance(str(obj), str)


class CampaignsModelTest(TestCase):
    def test_create(self):
        obj = Campaigns.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = Campaigns.objects.create()
        self.assertIsInstance(str(obj), str)


class MessageLogModelTest(TestCase):
    def test_create(self):
        obj = MessageLog.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = MessageLog.objects.create()
        self.assertIsInstance(str(obj), str)


class CommunicationChannelsModelTest(TestCase):
    def test_create(self):
        obj = CommunicationChannels.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = CommunicationChannels.objects.create()
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# Messaging (threads / messages / read receipts / participants)
# ---------------------------------------------------------------------------


class MessageThreadsModelTest(TestCase):
    def test_create(self):
        obj = MessageThreads.objects.create(
            subject="Benefits Question",
            member_id="clerk_user_100",
            organization_id=uuid.uuid4(),
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.subject, "Benefits Question")
        self.assertEqual(obj.status, "open")
        self.assertFalse(obj.is_archived)

    def test_str(self):
        obj = MessageThreads.objects.create(
            subject="Dues Inquiry",
            member_id="clerk_user_101",
            organization_id=uuid.uuid4(),
        )
        self.assertIsInstance(str(obj), str)


class MessagesModelTest(TestCase):
    def test_create(self):
        thread = MessageThreads.objects.create(
            subject="Thread A",
            member_id="m1",
            organization_id=uuid.uuid4(),
        )
        obj = Messages.objects.create(thread=thread)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.thread, thread)

    def test_str(self):
        thread = MessageThreads.objects.create(
            subject="Thread B",
            member_id="m2",
            organization_id=uuid.uuid4(),
        )
        obj = Messages.objects.create(thread=thread)
        self.assertIsInstance(str(obj), str)


class MessageReadReceiptsModelTest(TestCase):
    def test_create(self):
        thread = MessageThreads.objects.create(
            subject="Thread C",
            member_id="m3",
            organization_id=uuid.uuid4(),
        )
        msg = Messages.objects.create(thread=thread)
        obj = MessageReadReceipts.objects.create(message=msg)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.message, msg)

    def test_str(self):
        thread = MessageThreads.objects.create(
            subject="Thread D",
            member_id="m4",
            organization_id=uuid.uuid4(),
        )
        msg = Messages.objects.create(thread=thread)
        obj = MessageReadReceipts.objects.create(message=msg)
        self.assertIsInstance(str(obj), str)


class MessageParticipantsModelTest(TestCase):
    def test_create(self):
        thread = MessageThreads.objects.create(
            subject="Thread E",
            member_id="m5",
            organization_id=uuid.uuid4(),
        )
        obj = MessageParticipants.objects.create(thread=thread)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        thread = MessageThreads.objects.create(
            subject="Thread F",
            member_id="m6",
            organization_id=uuid.uuid4(),
        )
        obj = MessageParticipants.objects.create(thread=thread)
        self.assertIsInstance(str(obj), str)


class MessageNotificationsModelTest(TestCase):
    def test_create(self):
        thread = MessageThreads.objects.create(
            subject="Thread G",
            member_id="m7",
            organization_id=uuid.uuid4(),
        )
        msg = Messages.objects.create(thread=thread)
        obj = MessageNotifications.objects.create(
            user_id="clerk_user_200",
            message=msg,
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.user_id, "clerk_user_200")

    def test_str(self):
        thread = MessageThreads.objects.create(
            subject="Thread H",
            member_id="m8",
            organization_id=uuid.uuid4(),
        )
        msg = Messages.objects.create(thread=thread)
        obj = MessageNotifications.objects.create(user_id="u2", message=msg)
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# Newsletters
# ---------------------------------------------------------------------------


class NewsletterTemplatesModelTest(TestCase):
    def test_create(self):
        obj = NewsletterTemplates.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = NewsletterTemplates.objects.create()
        self.assertIsInstance(str(obj), str)


class NewsletterDistributionListsModelTest(TestCase):
    def test_create(self):
        obj = NewsletterDistributionLists.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = NewsletterDistributionLists.objects.create()
        self.assertIsInstance(str(obj), str)


class NewsletterListSubscribersModelTest(TestCase):
    def test_create(self):
        obj = NewsletterListSubscribers.objects.create(list_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = NewsletterListSubscribers.objects.create()
        self.assertIsInstance(str(obj), str)


class NewsletterCampaignsModelTest(TestCase):
    def test_create(self):
        obj = NewsletterCampaigns.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = NewsletterCampaigns.objects.create()
        self.assertIsInstance(str(obj), str)


class NewsletterRecipientsModelTest(TestCase):
    def test_create(self):
        obj = NewsletterRecipients.objects.create(campaign_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = NewsletterRecipients.objects.create()
        self.assertIsInstance(str(obj), str)


class NewsletterEngagementModelTest(TestCase):
    def test_create(self):
        obj = NewsletterEngagement.objects.create(campaign_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = NewsletterEngagement.objects.create()
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# Notification system
# ---------------------------------------------------------------------------


class UserNotificationPreferencesModelTest(TestCase):
    def test_create(self):
        obj = UserNotificationPreferences.objects.create(user_id="clerk_user_300")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.user_id, "clerk_user_300")

    def test_str(self):
        obj = UserNotificationPreferences.objects.create(user_id="clerk_user_301")
        self.assertIsInstance(str(obj), str)


class NotificationTrackingModelTest(TestCase):
    def test_create(self):
        obj = NotificationTracking.objects.create(
            organization_id=uuid.uuid4(),
            type="email",
            body="Your dues are overdue.",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.type, "email")
        self.assertEqual(obj.status, "pending")
        self.assertEqual(obj.priority, "normal")

    def test_str(self):
        obj = NotificationTracking.objects.create(
            organization_id=uuid.uuid4(),
            type="sms",
            body="Reminder",
        )
        self.assertIsInstance(str(obj), str)


class InAppNotificationsModelTest(TestCase):
    def test_create(self):
        obj = InAppNotifications.objects.create(user_id="clerk_user_400")
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = InAppNotifications.objects.create(user_id="clerk_user_401")
        self.assertIsInstance(str(obj), str)


class NotificationHistoryModelTest(TestCase):
    def test_create(self):
        obj = NotificationHistory.objects.create()
        self.assertIsNotNone(obj.id)

    def test_create_with_org(self):
        org = Organizations.objects.create(
            name="O", slug="nh-org", organization_type="union"
        )
        obj = NotificationHistory.objects.create(organization=org, user_id="u1")
        self.assertEqual(obj.organization, org)

    def test_str(self):
        obj = NotificationHistory.objects.create()
        self.assertIsInstance(str(obj), str)


class NotificationsModelTest(TestCase):
    def test_create(self):
        obj = Notifications.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = Notifications.objects.create()
        self.assertIsInstance(str(obj), str)


class NotificationTemplatesModelTest(TestCase):
    def test_create(self):
        obj = NotificationTemplates.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = NotificationTemplates.objects.create()
        self.assertIsInstance(str(obj), str)


class NotificationQueueModelTest(TestCase):
    def test_create(self):
        obj = NotificationQueue.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = NotificationQueue.objects.create()
        self.assertIsInstance(str(obj), str)


class NotificationDeliveryLogModelTest(TestCase):
    def test_create(self):
        obj = NotificationDeliveryLog.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = NotificationDeliveryLog.objects.create()
        self.assertIsInstance(str(obj), str)


class NotificationBouncesModelTest(TestCase):
    def test_create(self):
        obj = NotificationBounces.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = NotificationBounces.objects.create()
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# Push notifications
# ---------------------------------------------------------------------------


class PushDevicesModelTest(TestCase):
    def test_create(self):
        obj = PushDevices.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = PushDevices.objects.create()
        self.assertIsInstance(str(obj), str)


class PushNotificationTemplatesModelTest(TestCase):
    def test_create(self):
        obj = PushNotificationTemplates.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = PushNotificationTemplates.objects.create()
        self.assertIsInstance(str(obj), str)


class PushNotificationsModelTest(TestCase):
    def test_create(self):
        obj = PushNotifications.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = PushNotifications.objects.create()
        self.assertIsInstance(str(obj), str)


class PushDeliveriesModelTest(TestCase):
    def test_create(self):
        obj = PushDeliveries.objects.create(notification_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = PushDeliveries.objects.create()
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# SMS
# ---------------------------------------------------------------------------


class SmsTemplatesModelTest(TestCase):
    def test_create(self):
        obj = SmsTemplates.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = SmsTemplates.objects.create()
        self.assertIsInstance(str(obj), str)


class SmsCampaignsModelTest(TestCase):
    def test_create(self):
        obj = SmsCampaigns.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = SmsCampaigns.objects.create()
        self.assertIsInstance(str(obj), str)


class SmsMessagesModelTest(TestCase):
    def test_create(self):
        obj = SmsMessages.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = SmsMessages.objects.create()
        self.assertIsInstance(str(obj), str)


class SmsConversationsModelTest(TestCase):
    def test_create(self):
        obj = SmsConversations.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = SmsConversations.objects.create()
        self.assertIsInstance(str(obj), str)


class SmsCampaignRecipientsModelTest(TestCase):
    def test_create(self):
        obj = SmsCampaignRecipients.objects.create(campaign_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = SmsCampaignRecipients.objects.create()
        self.assertIsInstance(str(obj), str)


class SmsOptOutsModelTest(TestCase):
    def test_create(self):
        obj = SmsOptOuts.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = SmsOptOuts.objects.create()
        self.assertIsInstance(str(obj), str)


class SmsRateLimitsModelTest(TestCase):
    def test_create(self):
        obj = SmsRateLimits.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = SmsRateLimits.objects.create()
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# Mobile
# ---------------------------------------------------------------------------


class MobileDevicesModelTest(TestCase):
    def test_create(self):
        obj = MobileDevices.objects.create(device_token="abc123token")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.device_token, "abc123token")

    def test_str(self):
        obj = MobileDevices.objects.create()
        self.assertIsInstance(str(obj), str)


class MobileNotificationsModelTest(TestCase):
    def test_create(self):
        dev = MobileDevices.objects.create(device_token="tok-mn")
        obj = MobileNotifications.objects.create(device=dev)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.device, dev)

    def test_str(self):
        obj = MobileNotifications.objects.create()
        self.assertIsInstance(str(obj), str)


class MobileSyncQueueModelTest(TestCase):
    def test_create(self):
        dev = MobileDevices.objects.create(device_token="tok-msq")
        obj = MobileSyncQueue.objects.create(device=dev)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.device, dev)

    def test_str(self):
        obj = MobileSyncQueue.objects.create()
        self.assertIsInstance(str(obj), str)


class MobileAnalyticsModelTest(TestCase):
    def test_create(self):
        obj = MobileAnalytics.objects.create(session_id="sess-001")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.session_id, "sess-001")

    def test_str(self):
        obj = MobileAnalytics.objects.create()
        self.assertIsInstance(str(obj), str)


class MobileAppConfigModelTest(TestCase):
    def test_create(self):
        org = Organizations.objects.create(
            name="O", slug="mac-org", organization_type="union"
        )
        obj = MobileAppConfig.objects.create(organization=org)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.organization, org)

    def test_str(self):
        obj = MobileAppConfig.objects.create()
        self.assertIsInstance(str(obj), str)


class CommunicationPreferencesPhase4ModelTest(TestCase):
    def test_create(self):
        obj = CommunicationPreferencesPhase4.objects.create(
            user_id="clerk_user_500",
            organization_id=uuid.uuid4(),
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.user_id, "clerk_user_500")
        self.assertEqual(obj.timezone, "America/Toronto")

    def test_str(self):
        obj = CommunicationPreferencesPhase4.objects.create(
            user_id="clerk_user_501",
            organization_id=uuid.uuid4(),
        )
        self.assertIsInstance(str(obj), str)
