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
from core.testing import create_valid

# ---------------------------------------------------------------------------
# CLC / Communication basics
# ---------------------------------------------------------------------------


class NotificationLogModelTest(TestCase):
    def test_create(self):
        obj = create_valid(NotificationLog,
            organization_id=uuid.uuid4(),
            type="email",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.type, "email")

    def test_str(self):
        obj = create_valid(NotificationLog, organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class CommunicationPreferencesModelTest(TestCase):
    def test_create(self):
        obj = create_valid(CommunicationPreferences, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(CommunicationPreferences)
        self.assertIsInstance(str(obj), str)


class MessageTemplatesModelTest(TestCase):
    def test_create(self):
        obj = create_valid(MessageTemplates, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(MessageTemplates)
        self.assertIsInstance(str(obj), str)


class CampaignsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(Campaigns, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(Campaigns)
        self.assertIsInstance(str(obj), str)


class MessageLogModelTest(TestCase):
    def test_create(self):
        obj = create_valid(MessageLog, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(MessageLog)
        self.assertIsInstance(str(obj), str)


class CommunicationChannelsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(CommunicationChannels, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(CommunicationChannels)
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# Messaging (threads / messages / read receipts / participants)
# ---------------------------------------------------------------------------


class MessageThreadsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(MessageThreads,
            subject="Benefits Question",
            member_id="user_100",
            organization_id=uuid.uuid4(),
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.subject, "Benefits Question")
        self.assertEqual(obj.status, "open")
        self.assertFalse(obj.is_archived)

    def test_str(self):
        obj = create_valid(MessageThreads,
            subject="Dues Inquiry",
            member_id="user_101",
            organization_id=uuid.uuid4(),
        )
        self.assertIsInstance(str(obj), str)


class MessagesModelTest(TestCase):
    def test_create(self):
        thread = create_valid(MessageThreads,
            subject="Thread A",
            member_id="m1",
            organization_id=uuid.uuid4(),
        )
        obj = create_valid(Messages, thread=thread)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.thread, thread)

    def test_str(self):
        thread = create_valid(MessageThreads,
            subject="Thread B",
            member_id="m2",
            organization_id=uuid.uuid4(),
        )
        obj = create_valid(Messages, thread=thread)
        self.assertIsInstance(str(obj), str)


class MessageReadReceiptsModelTest(TestCase):
    def test_create(self):
        thread = create_valid(MessageThreads,
            subject="Thread C",
            member_id="m3",
            organization_id=uuid.uuid4(),
        )
        msg = create_valid(Messages, thread=thread)
        obj = create_valid(MessageReadReceipts, message=msg)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.message, msg)

    def test_str(self):
        thread = create_valid(MessageThreads,
            subject="Thread D",
            member_id="m4",
            organization_id=uuid.uuid4(),
        )
        msg = create_valid(Messages, thread=thread)
        obj = create_valid(MessageReadReceipts, message=msg)
        self.assertIsInstance(str(obj), str)


class MessageParticipantsModelTest(TestCase):
    def test_create(self):
        thread = create_valid(MessageThreads,
            subject="Thread E",
            member_id="m5",
            organization_id=uuid.uuid4(),
        )
        obj = create_valid(MessageParticipants, thread=thread)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        thread = create_valid(MessageThreads,
            subject="Thread F",
            member_id="m6",
            organization_id=uuid.uuid4(),
        )
        obj = create_valid(MessageParticipants, thread=thread)
        self.assertIsInstance(str(obj), str)


class MessageNotificationsModelTest(TestCase):
    def test_create(self):
        thread = create_valid(MessageThreads,
            subject="Thread G",
            member_id="m7",
            organization_id=uuid.uuid4(),
        )
        msg = create_valid(Messages, thread=thread)
        obj = create_valid(MessageNotifications,
            user_id="user_200",
            message=msg,
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.user_id, "user_200")

    def test_str(self):
        thread = create_valid(MessageThreads,
            subject="Thread H",
            member_id="m8",
            organization_id=uuid.uuid4(),
        )
        msg = create_valid(Messages, thread=thread)
        obj = create_valid(MessageNotifications, user_id="u2", message=msg)
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# Newsletters
# ---------------------------------------------------------------------------


class NewsletterTemplatesModelTest(TestCase):
    def test_create(self):
        obj = create_valid(NewsletterTemplates, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(NewsletterTemplates)
        self.assertIsInstance(str(obj), str)


class NewsletterDistributionListsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(NewsletterDistributionLists, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(NewsletterDistributionLists)
        self.assertIsInstance(str(obj), str)


class NewsletterListSubscribersModelTest(TestCase):
    def test_create(self):
        obj = create_valid(NewsletterListSubscribers, list_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(NewsletterListSubscribers)
        self.assertIsInstance(str(obj), str)


class NewsletterCampaignsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(NewsletterCampaigns, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(NewsletterCampaigns)
        self.assertIsInstance(str(obj), str)


class NewsletterRecipientsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(NewsletterRecipients, campaign_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(NewsletterRecipients)
        self.assertIsInstance(str(obj), str)


class NewsletterEngagementModelTest(TestCase):
    def test_create(self):
        obj = create_valid(NewsletterEngagement, campaign_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(NewsletterEngagement)
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# Notification system
# ---------------------------------------------------------------------------


class UserNotificationPreferencesModelTest(TestCase):
    def test_create(self):
        obj = create_valid(UserNotificationPreferences, user_id="user_300")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.user_id, "user_300")

    def test_str(self):
        obj = create_valid(UserNotificationPreferences, user_id="user_301")
        self.assertIsInstance(str(obj), str)


class NotificationTrackingModelTest(TestCase):
    def test_create(self):
        obj = create_valid(NotificationTracking,
            organization_id=uuid.uuid4(),
            type="email",
            body="Your dues are overdue.",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.type, "email")
        self.assertEqual(obj.status, "pending")
        self.assertEqual(obj.priority, "normal")

    def test_str(self):
        obj = create_valid(NotificationTracking,
            organization_id=uuid.uuid4(),
            type="sms",
            body="Reminder",
        )
        self.assertIsInstance(str(obj), str)


class InAppNotificationsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(InAppNotifications, user_id="user_400")
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(InAppNotifications, user_id="user_401")
        self.assertIsInstance(str(obj), str)


class NotificationHistoryModelTest(TestCase):
    def test_create(self):
        obj = create_valid(NotificationHistory)
        self.assertIsNotNone(obj.id)

    def test_create_with_org(self):
        org = create_valid(Organizations,
            name="O", slug="nh-org", organization_type="union"
        )
        obj = create_valid(NotificationHistory, organization=org, user_id="u1")
        self.assertEqual(obj.organization, org)

    def test_str(self):
        obj = create_valid(NotificationHistory)
        self.assertIsInstance(str(obj), str)


class NotificationsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(Notifications, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(Notifications)
        self.assertIsInstance(str(obj), str)


class NotificationTemplatesModelTest(TestCase):
    def test_create(self):
        obj = create_valid(NotificationTemplates, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(NotificationTemplates)
        self.assertIsInstance(str(obj), str)


class NotificationQueueModelTest(TestCase):
    def test_create(self):
        obj = create_valid(NotificationQueue, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(NotificationQueue)
        self.assertIsInstance(str(obj), str)


class NotificationDeliveryLogModelTest(TestCase):
    def test_create(self):
        obj = create_valid(NotificationDeliveryLog, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(NotificationDeliveryLog)
        self.assertIsInstance(str(obj), str)


class NotificationBouncesModelTest(TestCase):
    def test_create(self):
        obj = create_valid(NotificationBounces, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(NotificationBounces)
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# Push notifications
# ---------------------------------------------------------------------------


class PushDevicesModelTest(TestCase):
    def test_create(self):
        obj = create_valid(PushDevices, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(PushDevices)
        self.assertIsInstance(str(obj), str)


class PushNotificationTemplatesModelTest(TestCase):
    def test_create(self):
        obj = create_valid(PushNotificationTemplates, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(PushNotificationTemplates)
        self.assertIsInstance(str(obj), str)


class PushNotificationsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(PushNotifications, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(PushNotifications)
        self.assertIsInstance(str(obj), str)


class PushDeliveriesModelTest(TestCase):
    def test_create(self):
        obj = create_valid(PushDeliveries, notification_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(PushDeliveries)
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# SMS
# ---------------------------------------------------------------------------


class SmsTemplatesModelTest(TestCase):
    def test_create(self):
        obj = create_valid(SmsTemplates, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(SmsTemplates)
        self.assertIsInstance(str(obj), str)


class SmsCampaignsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(SmsCampaigns, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(SmsCampaigns)
        self.assertIsInstance(str(obj), str)


class SmsMessagesModelTest(TestCase):
    def test_create(self):
        obj = create_valid(SmsMessages, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(SmsMessages)
        self.assertIsInstance(str(obj), str)


class SmsConversationsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(SmsConversations, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(SmsConversations)
        self.assertIsInstance(str(obj), str)


class SmsCampaignRecipientsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(SmsCampaignRecipients, campaign_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(SmsCampaignRecipients)
        self.assertIsInstance(str(obj), str)


class SmsOptOutsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(SmsOptOuts, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(SmsOptOuts)
        self.assertIsInstance(str(obj), str)


class SmsRateLimitsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(SmsRateLimits, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(SmsRateLimits)
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# Mobile
# ---------------------------------------------------------------------------


class MobileDevicesModelTest(TestCase):
    def test_create(self):
        obj = create_valid(MobileDevices, device_token="abc123token")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.device_token, "abc123token")

    def test_str(self):
        obj = create_valid(MobileDevices)
        self.assertIsInstance(str(obj), str)


class MobileNotificationsModelTest(TestCase):
    def test_create(self):
        dev = create_valid(MobileDevices, device_token="tok-mn")
        obj = create_valid(MobileNotifications, device=dev)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.device, dev)

    def test_str(self):
        obj = create_valid(MobileNotifications)
        self.assertIsInstance(str(obj), str)


class MobileSyncQueueModelTest(TestCase):
    def test_create(self):
        dev = create_valid(MobileDevices, device_token="tok-msq")
        obj = create_valid(MobileSyncQueue, device=dev)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.device, dev)

    def test_str(self):
        obj = create_valid(MobileSyncQueue)
        self.assertIsInstance(str(obj), str)


class MobileAnalyticsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(MobileAnalytics, session_id="sess-001")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.session_id, "sess-001")

    def test_str(self):
        obj = create_valid(MobileAnalytics)
        self.assertIsInstance(str(obj), str)


class MobileAppConfigModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="O", slug="mac-org", organization_type="union"
        )
        obj = create_valid(MobileAppConfig, organization=org)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.organization, org)

    def test_str(self):
        obj = create_valid(MobileAppConfig)
        self.assertIsInstance(str(obj), str)


class CommunicationPreferencesPhase4ModelTest(TestCase):
    def test_create(self):
        obj = create_valid(CommunicationPreferencesPhase4,
            user_id="user_500",
            organization_id=uuid.uuid4(),
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.user_id, "user_500")
        self.assertEqual(obj.timezone, "America/Toronto")

    def test_str(self):
        obj = create_valid(CommunicationPreferencesPhase4,
            user_id="user_501",
            organization_id=uuid.uuid4(),
        )
        self.assertIsInstance(str(obj), str)
