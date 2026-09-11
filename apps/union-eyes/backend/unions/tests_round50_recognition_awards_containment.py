"""
Round 50 unions app recognition_awards / recognition_award_types
Django containment.

lib/services/rewards/*-service.ts (the real TS consumers, reached via
app/[locale]/dashboard/admin/rewards/analytics/page.tsx and
app/api/rewards/cron/route.ts) already enforce org scoping in Next.js.
RecognitionAwardTypesViewSet and RecognitionAwardsViewSet were full
ModelViewSets with queryset=Model.objects.all() and IsAuthenticated only —
no organization scoping, both router-registered at
api/unions/recognition-award-types/ and api/unions/recognition-awards/
(REAL, not theoretical reachability). No legitimate Django consumer of
either REST endpoint was found. Contained with the existing
DenyAllPermission — same disposition already applied to
RecognitionProgramsViewSet (round 40) and RewardBudgetEnvelopesViewSet
(round 36) in this same file.

Run via: python -m unittest unions.tests_round50_recognition_awards_containment -v
"""

from __future__ import annotations

import os
import unittest

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from unions import views  # noqa: E402
from rest_framework import viewsets, permissions  # noqa: E402


class RecognitionAwardsContainmentTests(unittest.TestCase):
    def test_recognition_award_types_viewset_uses_deny_all_permission(self):
        self.assertEqual(views.RecognitionAwardTypesViewSet.permission_classes, [views.DenyAllPermission])

    def test_recognition_awards_viewset_uses_deny_all_permission(self):
        self.assertEqual(views.RecognitionAwardsViewSet.permission_classes, [views.DenyAllPermission])

    def test_neither_viewset_is_plain_is_authenticated(self):
        self.assertNotIn(permissions.IsAuthenticated, views.RecognitionAwardTypesViewSet.permission_classes)
        self.assertNotIn(permissions.IsAuthenticated, views.RecognitionAwardsViewSet.permission_classes)

    def test_both_viewsets_remain_model_viewsets(self):
        self.assertTrue(issubclass(views.RecognitionAwardTypesViewSet, viewsets.ModelViewSet))
        self.assertTrue(issubclass(views.RecognitionAwardsViewSet, viewsets.ModelViewSet))


if __name__ == "__main__":
    unittest.main()
