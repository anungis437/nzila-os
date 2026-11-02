"""The models equal the physical schema.

This needs the schema the platform migrations build: it runs when ``UE_DJANGO_TEST_TEMPLATE`` names that database, which
is how CI runs the Django suite. Without it the test database is Django's migrations plus the columns the runner adds, which
agrees with the models by construction and proves nothing; the test is skipped, never passed.
"""
import os
import unittest

from django.test import TestCase

from core.management.commands.ue_physical_parity import STRICT_KINDS, measure
from core.test_runner import TEMPLATE_VARIABLE


@unittest.skipUnless(os.environ.get(TEMPLATE_VARIABLE), f"{TEMPLATE_VARIABLE} is not set: no converged database to measure")
class ModelsEqualThePhysicalSchema(TestCase):
    def test_no_strict_finding(self):
        measured, findings = measure(set(), False)
        strict = [f for f in findings if f["kind"] in STRICT_KINDS]
        self.assertGreater(measured, 500)
        self.assertEqual(
            strict,
            [],
            "A Django model and its table disagree in a way that makes an ORM operation fail or corrupt data: "
            + "; ".join(f"{f['kind']} {f['table']}.{f['column']}" for f in strict[:10]),
        )
