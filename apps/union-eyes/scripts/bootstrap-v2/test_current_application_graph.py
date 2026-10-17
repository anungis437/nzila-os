import importlib.util
import tempfile
import textwrap
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "current_application", Path(__file__).with_name("current_application.py")
)
application = importlib.util.module_from_spec(spec)
spec.loader.exec_module(application)


class PythonMutationGraphTests(unittest.TestCase):
    def graph(self, files, entry="example.views.endpoint"):
        with tempfile.TemporaryDirectory(prefix="ue-v2-python-graph-") as directory:
            root = Path(directory)
            backend = root / "apps" / "union-eyes" / "backend"
            for name, source in files.items():
                target = backend / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(textwrap.dedent(source), encoding="utf-8")
            return application.python_mutation_graph(
                root,
                backend,
                [{"id": "owned-http-root", "callable": entry}],
                {"example.models.Widget": "widgets"},
            )

    def test_imported_helper_reaches_bound_model_write_from_get(self):
        graph = self.graph(
            {
                "example/views.py": """
                from .services import write
                def endpoint():
                    return write()
            """,
                "example/services.py": """
                from .models import Widget
                def write():
                    return Widget.objects.create()
            """,
            }
        )
        self.assertEqual(len(graph["callers"]), 2)
        write = next(
            node for node in graph["callers"] if node["callable"].endswith(".write")
        )
        self.assertEqual(write["mutations"][0]["table"], "widgets")
        self.assertEqual(write["mutations"][0]["classification"], "MODEL_BOUND_ORM")
        self.assertFalse(graph["denominatorComplete"])
        self.assertEqual(graph["runtimeQualification"], "NOT_PROVEN")

    def test_cycle_and_registered_task_root_reach_helper(self):
        graph = self.graph(
            {
                "example/tasks.py": """
                from .models import Widget
                def first():
                    second()
                def second():
                    first()
                    Widget.objects.update()
            """,
            },
            "example.tasks.first",
        )
        self.assertEqual(len(graph["callers"]), 2)
        self.assertTrue(
            all(
                node["rootCallables"] == ["example.tasks.first"]
                for node in graph["callers"]
            )
        )

    def test_uncalled_nested_function_is_not_promoted(self):
        graph = self.graph(
            {
                "example/views.py": """
                from .models import Widget
                def endpoint():
                    def uncalled():
                        Widget.objects.delete()
                    return 1
            """,
            }
        )
        self.assertEqual(graph["callers"], [])
        self.assertEqual(len(graph["unreachableDirectWriters"]), 1)

    def test_called_nested_function_is_retained(self):
        graph = self.graph(
            {
                "example/views.py": """
                from .models import Widget
                def endpoint():
                    def called():
                        Widget.objects.delete()
                    called()
            """,
            }
        )
        self.assertEqual(len(graph["callers"]), 2)

    def test_dynamic_sql_is_retained_unresolved(self):
        graph = self.graph(
            {
                "example/views.py": """
                def endpoint(cursor, query):
                    cursor.execute(query)
            """,
            }
        )
        mutation = graph["callers"][0]["mutations"][0]
        self.assertEqual(mutation["operation"], "UNKNOWN")
        self.assertEqual(mutation["table"], "UNRESOLVED_DYNAMIC_SQL")
        self.assertEqual(len(graph["unresolvedReachableCalls"]), 1)

    def test_literal_sql_writes_are_retained_but_select_is_not(self):
        graph = self.graph(
            {
                "example/views.py": """
                def endpoint(cursor):
                    cursor.execute('SELECT 1')
                    cursor.execute('UPDATE public.widgets SET enabled = true')
            """,
            }
        )
        self.assertEqual(len(graph["callers"][0]["mutations"]), 1)
        self.assertEqual(graph["callers"][0]["mutations"][0]["table"], "public.widgets")

    def test_local_import_does_not_rebind_another_function(self):
        graph = self.graph(
            {
                "example/views.py": """
                from .services import write
                def endpoint():
                    write()
                def unrelated():
                    from .unused import write
                    write()
            """,
                "example/services.py": """
                from .models import Widget
                def write():
                    Widget.objects.create()
            """,
                "example/unused.py": """
                def write():
                    cursor.execute(query)
            """,
            }
        )
        self.assertEqual(len(graph["callers"]), 2)
        self.assertTrue(
            all("unused" not in node["callable"] for node in graph["callers"])
        )
        self.assertEqual(len(graph["unreachableDirectWriters"]), 1)

    def test_inherited_or_missing_root_is_not_invented(self):
        graph = self.graph(
            {"example/views.py": "def endpoint():\n    return 1\n"},
            "rest_framework.mixins.CreateModelMixin.create",
        )
        self.assertEqual(graph["callers"], [])
        self.assertEqual(len(graph["unresolvedRoots"]), 1)
        self.assertEqual(graph["unresolvedRoots"][0]["bindings"], ["owned-http-root"])


if __name__ == "__main__":
    unittest.main()
