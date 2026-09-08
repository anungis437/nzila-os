"""
Round 53 unions app training/registration containment test
(FINAL_SIMPLE_TENANT_EXCEPTION_CLOSURE, TRAINING_AND_REGISTRATION family).

TrainingCoursesViewSet, CourseRegistrationsViewSet, and TrainingProgramsViewSet
were all generated with queryset=Model.objects.all() + IsAuthenticated-only
and NO organization filter of any kind. CourseRegistrationsViewSet is the
most sensitive of the three: it exposed a member_id filterset field with no
ownership check, letting any authenticated user enumerate any organization's
registrations (test scores, attendance, certification status) by member_id.
The real, live authority surface for all three is the Next.js crudRoutes-
based app/api/education/{courses,registrations,programs}/route.ts (org- and,
for registrations, member-scoped). No legitimate consumer of any of the
three Django REST paths was found. Contained via DenyAllPermission.

Run with:

    python -m unittest unions.tests_round53_training_registration_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from unions import views  # noqa: E402


class Round53TrainingRegistrationContainmentTests(unittest.TestCase):
    def test_training_courses_viewset_uses_deny_all(self):
        self.assertEqual(views.TrainingCoursesViewSet.permission_classes, [views.DenyAllPermission])

    def test_course_registrations_viewset_uses_deny_all(self):
        self.assertEqual(views.CourseRegistrationsViewSet.permission_classes, [views.DenyAllPermission])

    def test_training_programs_viewset_uses_deny_all(self):
        self.assertEqual(views.TrainingProgramsViewSet.permission_classes, [views.DenyAllPermission])

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
