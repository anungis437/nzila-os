import ast
from pathlib import Path
import unittest

from prepare import inspect_python, require


class NullOnlyContractTests(unittest.TestCase):
    def test_secrets_import_detected(self):
        self.assertEqual(inspect_python(b"import secrets\n")["secretsImports"], ["secrets"])
        self.assertEqual(inspect_python(b"from secrets import token_bytes\n")["secretsImports"], ["secrets"])

    def test_dynamic_load_is_not_ignored(self):
        report = inspect_python(b"import importlib\nimportlib.import_module(name)\n")
        self.assertEqual(len(report["dynamic"]), 1)

    def test_nonproduction_strings_do_not_create_import(self):
        report = inspect_python(b'warning = "secrets is absent"\nimport ssl\n')
        self.assertEqual(report["secretsImports"], [])
        self.assertEqual(report["imports"], ["ssl"])

    def test_guard_explicit_error(self):
        with self.assertRaisesRegex(RuntimeError, "STOP"):
            require(False, "STOP")

    def test_single_unchanged_core_call(self):
        tree = ast.parse((Path(__file__).parent / "fixture.py").read_text())
        calls = [node for node in ast.walk(tree) if isinstance(node, ast.Call) and
                 isinstance(node.func, ast.Attribute) and ast.unparse(node.func) == "subprocess.run" and
                 node.args and isinstance(node.args[0], ast.List) and
                 any(isinstance(item, ast.Constant) and item.value == "/inputs/portable-assembler"
                     for item in node.args[0].elts)]
        self.assertEqual(len(calls), 1)
        command = [item.value for item in calls[0].args[0].elts]
        self.assertEqual(command, ["/inputs/portable-assembler", "/inputs", "/build/transaction",
                                   "/output/transaction"])

    def test_only_exact_null_device_bind(self):
        source = (Path(__file__).parent / "fixture.py").read_text()
        tree = ast.parse(source)
        binds = [node for node in ast.walk(tree) if isinstance(node, ast.Call) and
                 ast.unparse(node.func) == "mount" and node.args and
                 isinstance(node.args[0], ast.Constant) and
                 isinstance(node.args[0].value, str) and node.args[0].value.startswith("/dev")]
        self.assertEqual([node.args[0].value for node in binds], ["/dev/null"])
        self.assertIn("Observed sample maxima, not every-allocation/lossless exact peaks", source)


if __name__ == "__main__":
    unittest.main()
