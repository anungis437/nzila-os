"""
Round 53 unions app calendar/scheduling containment test
(FINAL_SIMPLE_TENANT_EXCEPTION_CLOSURE, CALENDAR_AND_SCHEDULING family).

CalendarsViewSet, MeetingRoomsViewSet, and RoomBookingsViewSet were all
generated with queryset=Model.objects.all() + IsAuthenticated-only and NO
organization filter of any kind. The real, live authority surface for
calendars/meeting_rooms is the Next.js crudRoutes-based app/api routes
(org- and, for calendars, owner-scoped); room_bookings has zero TS
consumers anywhere (dead code). No legitimate consumer of any of the three
Django REST paths was found. Contained via DenyAllPermission.

Run with:

    python -m unittest unions.tests_round53_calendar_scheduling_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from unions import views  # noqa: E402


class Round53CalendarSchedulingContainmentTests(unittest.TestCase):
    def test_calendars_viewset_uses_deny_all(self):
        self.assertEqual(views.CalendarsViewSet.permission_classes, [views.DenyAllPermission])

    def test_meeting_rooms_viewset_uses_deny_all(self):
        self.assertEqual(views.MeetingRoomsViewSet.permission_classes, [views.DenyAllPermission])

    def test_room_bookings_viewset_uses_deny_all(self):
        self.assertEqual(views.RoomBookingsViewSet.permission_classes, [views.DenyAllPermission])

    def test_deny_all_still_denies_authenticated_and_anonymous_requests(self):
        permission = views.DenyAllPermission()
        authenticated_request = MagicMock(user=MagicMock(is_authenticated=True))
        anonymous_request = MagicMock(user=MagicMock(is_authenticated=False))

        self.assertFalse(permission.has_permission(authenticated_request, MagicMock()))
        self.assertFalse(
            permission.has_object_permission(authenticated_request, MagicMock(), MagicMock())
        )
        self.assertFalse(permission.has_permission(anonymous_request, MagicMock()))
        self.assertFalse(
            permission.has_object_permission(anonymous_request, MagicMock(), MagicMock())
        )


if __name__ == "__main__":
    unittest.main()
