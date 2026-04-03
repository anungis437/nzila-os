"""
Unit tests for pattern_extractor.py

Tests the PatternExtractor class against its actual API:
  - PatternExtractor(platforms_dir=Path)
  - extract_all(platform_dirs: List[Path]) -> PatternLibrary
  - export_library(library, output_path)
  - generate_report(library) -> str
"""

import json
import sys
from pathlib import Path
from unittest.mock import Mock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "generators"))

from pattern_extractor import CodePattern, PatternExtractor, PatternLibrary


@pytest.mark.unit
@pytest.mark.extractor
class TestPatternExtractor:
    """Test PatternExtractor class"""

    def test_initialization(self, temp_dir):
        """Test extractor initialization."""
        extractor = PatternExtractor(platforms_dir=temp_dir)
        assert extractor.platforms_dir == temp_dir
        assert extractor.legacy_root == temp_dir
        assert isinstance(extractor.patterns, dict)

    def test_initialization_default(self):
        """Test extractor with no args creates temp dir."""
        extractor = PatternExtractor()
        assert extractor.legacy_root.exists()

    def test_extract_clerk_middleware(self, temp_dir):
        """Test Clerk middleware pattern extraction."""
        platform_dir = temp_dir / "clerk-platform"
        platform_dir.mkdir()

        (platform_dir / "middleware.ts").write_text(
            "import { clerkMiddleware } from '@clerk/nextjs/server';\n"
            "export default clerkMiddleware();\n"
        )

        extractor = PatternExtractor(platforms_dir=temp_dir)
        library = extractor.extract_all([platform_dir])

        clerk_patterns = [p for p in library.patterns if "Clerk" in p.name]
        assert len(clerk_patterns) >= 1
        assert clerk_patterns[0].category == "auth"

    def test_extract_drizzle_client(self, temp_dir):
        """Test Drizzle client pattern extraction."""
        platform_dir = temp_dir / "drizzle-platform"
        platform_dir.mkdir()

        (platform_dir / "db.ts").write_text(
            "import { drizzle } from 'drizzle-orm/postgres-js';\n"
            "import postgres from 'postgres';\n"
            "const client = postgres(process.env.DATABASE_URL!);\n"
            "export const db = drizzle(client);\n"
        )

        extractor = PatternExtractor(platforms_dir=temp_dir)
        library = extractor.extract_all([platform_dir])

        db_patterns = [p for p in library.patterns if p.category == "database"]
        assert len(db_patterns) >= 1

    def test_extract_config_env_example(self, temp_dir):
        """Test .env.example pattern extraction."""
        platform_dir = temp_dir / "config-platform"
        platform_dir.mkdir()

        (platform_dir / ".env.example").write_text(
            "DATABASE_URL=postgresql://localhost:5432/mydb\n"
            "CLERK_SECRET_KEY=sk_test_xxx\n"
        )

        extractor = PatternExtractor(platforms_dir=temp_dir)
        library = extractor.extract_all([platform_dir])

        config_patterns = [p for p in library.patterns if p.category == "config"]
        assert len(config_patterns) >= 1

    def test_extract_tailwind_config(self, temp_dir):
        """Test tailwind config pattern extraction."""
        platform_dir = temp_dir / "tailwind-platform"
        platform_dir.mkdir()

        (platform_dir / "tailwind.config.ts").write_text(
            "import type { Config } from 'tailwindcss';\n"
            "const config: Config = { content: ['./src/**/*.tsx'] };\n"
            "export default config;\n"
        )

        extractor = PatternExtractor(platforms_dir=temp_dir)
        library = extractor.extract_all([platform_dir])

        config_patterns = [p for p in library.patterns if p.category == "config"]
        assert len(config_patterns) >= 1

    def test_pattern_deduplication(self, temp_dir):
        """Test SHA256-based deduplication across platforms."""
        middleware_content = (
            "import { clerkMiddleware } from '@clerk/nextjs/server';\n"
            "export default clerkMiddleware();\n"
        )

        for name in ("platform1", "platform2"):
            d = temp_dir / name
            d.mkdir()
            (d / "middleware.ts").write_text(middleware_content)

        extractor = PatternExtractor(platforms_dir=temp_dir)
        library = extractor.extract_all(
            [temp_dir / "platform1", temp_dir / "platform2"]
        )

        clerk_patterns = [p for p in library.patterns if "Clerk" in p.name]
        assert len(clerk_patterns) == 1
        assert clerk_patterns[0].occurrences == 2
        assert len(clerk_patterns[0].platforms) == 2

    def test_assess_complexity_simple(self):
        """Test simple complexity classification."""
        extractor = PatternExtractor()
        assert (
            extractor._assess_complexity("export function add(a, b) { return a + b; }")
            == "SIMPLE"
        )

    def test_assess_complexity_moderate(self):
        """Test moderate complexity classification."""
        extractor = PatternExtractor()
        code = "\n".join([f"const line{i} = {i};" for i in range(30)])
        assert extractor._assess_complexity(code) == "MODERATE"

    def test_assess_complexity_complex(self):
        """Test complex complexity classification."""
        extractor = PatternExtractor()
        code = "\n".join([f"const line{i} = {i};" for i in range(60)])
        assert extractor._assess_complexity(code) == "COMPLEX"

    def test_build_library(self, temp_dir):
        """Test pattern library building."""
        platform = temp_dir / "test-platform"
        platform.mkdir()

        (platform / "middleware.ts").write_text(
            "import { clerkMiddleware } from '@clerk/nextjs/server';\n"
            "export default clerkMiddleware();\n"
        )

        extractor = PatternExtractor(platforms_dir=temp_dir)
        library = extractor.extract_all([platform])

        assert library.total_platforms == 1
        # Pattern extraction depends on specific file structure recognition
        assert isinstance(library.patterns, list)
        assert isinstance(library.categories, dict)

    def test_export_library_json(self, temp_dir):
        """Test JSON export via export_library."""
        platform = temp_dir / "export-platform"
        platform.mkdir()

        (platform / "middleware.ts").write_text(
            "import { clerkMiddleware } from '@clerk/nextjs/server';\n"
            "export default clerkMiddleware();\n"
        )

        extractor = PatternExtractor(platforms_dir=temp_dir)
        library = extractor.extract_all([platform])

        output_file = temp_dir / "patterns.json"
        extractor.export_library(library, output_file)

        assert output_file.exists()
        with open(output_file) as f:
            data = json.load(f)
        assert "patterns" in data
        assert "total_platforms" in data

    def test_generate_report(self, temp_dir):
        """Test markdown report generation."""
        platform = temp_dir / "report-platform"
        platform.mkdir()

        (platform / "middleware.ts").write_text(
            "import { clerkMiddleware } from '@clerk/nextjs/server';\n"
            "export default clerkMiddleware();\n"
        )

        extractor = PatternExtractor(platforms_dir=temp_dir)
        library = extractor.extract_all([platform])

        report = extractor.generate_report(library)
        assert isinstance(report, str)
        assert len(report) > 0

    def test_empty_platform_handling(self, temp_dir):
        """Test handling of empty platforms."""
        platform = temp_dir / "empty-platform"
        platform.mkdir()

        extractor = PatternExtractor(platforms_dir=temp_dir)
        library = extractor.extract_all([platform])

        assert len(library.patterns) == 0

    def test_code_pattern_dataclass(self):
        """Test CodePattern defaults."""
        p = CodePattern(
            pattern_id="test",
            category="auth",
            name="Test",
            description="desc",
            language="TypeScript",
            code_snippet="code",
            hash="abc123",
        )
        assert p.occurrences == 0
        assert p.platforms == []
        assert p.file_paths == []
        assert p.complexity == "SIMPLE"
        assert p.reusability_score == 0.0

    def test_pattern_library_get_by_category(self):
        """Test PatternLibrary.get_by_category."""
        auth = CodePattern("a", "auth", "A", "d", "TS", "c", "h1")
        db = CodePattern("b", "database", "B", "d", "TS", "c", "h2")
        library = PatternLibrary(
            patterns=[auth, db],
            total_platforms=1,
            reuse_percentage=0.0,
            categories={"auth": 1, "database": 1},
        )
        assert len(library.get_by_category("auth")) == 1
        assert len(library.get_by_category("database")) == 1

    def test_pattern_library_get_high_value(self):
        """Test PatternLibrary.get_high_value_patterns."""
        high = CodePattern(
            "a", "auth", "A", "d", "TS", "c", "h1", reusability_score=0.9
        )
        low = CodePattern("b", "db", "B", "d", "TS", "c", "h2", reusability_score=0.3)
        library = PatternLibrary(
            patterns=[high, low],
            total_platforms=1,
            reuse_percentage=0.0,
            categories={},
        )
        assert len(library.get_high_value_patterns(0.7)) == 1


@pytest.mark.integration
@pytest.mark.extractor
class TestPatternExtractorIntegration:
    """Integration tests for Pattern Extractor"""

    def test_multi_platform_extraction(self, temp_dir):
        """Test extracting patterns from multiple platforms."""
        for i in range(1, 4):
            platform = temp_dir / f"platform{i}"
            platform.mkdir()

            (platform / "middleware.ts").write_text(
                "import { clerkMiddleware } from '@clerk/nextjs/server';\n"
                "export default clerkMiddleware();\n"
            )

        platforms = [temp_dir / f"platform{i}" for i in range(1, 4)]
        extractor = PatternExtractor(platforms_dir=temp_dir)
        library = extractor.extract_all(platforms)

        shared_patterns = [p for p in library.patterns if p.occurrences == 3]
        assert len(shared_patterns) >= 1

    def test_full_extraction_workflow(self, temp_dir):
        """Test complete extraction workflow."""
        platform = temp_dir / "full-platform"
        platform.mkdir()

        (platform / "middleware.ts").write_text(
            "import { clerkMiddleware } from '@clerk/nextjs/server';\n"
            "export default clerkMiddleware();\n"
        )
        (platform / "db.ts").write_text(
            "import { drizzle } from 'drizzle-orm/postgres-js';\n"
            "export const db = drizzle(client);\n"
        )
        (platform / ".env.example").write_text(
            "DATABASE_URL=postgresql://localhost:5432/db"
        )

        extractor = PatternExtractor(platforms_dir=temp_dir)
        library = extractor.extract_all([platform])

        assert len(library.patterns) >= 2

        # Export library
        json_file = temp_dir / "patterns.json"
        extractor.export_library(library, json_file)
        assert json_file.exists()

        # Generate report
        report = extractor.generate_report(library)
        assert len(report) > 0


@pytest.mark.unit
@pytest.mark.extractor
class TestPatternExtractorExtended:
    """Extended tests for full coverage of pattern_extractor."""

    # ── Clerk hooks ─────────────────────────────────────────────────────

    def test_extract_clerk_hooks(self, temp_dir):
        """Extract Clerk auth hooks from use-*.ts files."""
        platform = temp_dir / "p1"
        platform.mkdir()
        hook_file = platform / "use-auth.ts"
        hook_file.write_text(
            "export const useAuth = () => {\n"
            "  const { user } = useUser();\n"
            "  return { user };\n"
            "};\n"
        )

        extractor = PatternExtractor(platforms_dir=temp_dir)
        library = extractor.extract_all([platform])

        hook_patterns = [
            p for p in library.patterns if "Clerk" in p.name and "Hook" in p.name
        ]
        assert len(hook_patterns) >= 1

    # ── Django DB patterns ──────────────────────────────────────────────

    def test_extract_django_transaction_utils(self, temp_dir):
        """Extract Django transaction.atomic pattern from utils.py."""
        platform = temp_dir / "djplatform"
        platform.mkdir()
        utils_file = platform / "utils.py"
        utils_file.write_text(
            "from django.db import transaction\n\n"
            "def transfer_funds(sender, receiver, amount):\n"
            "    with transaction.atomic():\n"
            "        sender.balance -= amount\n"
            "        sender.save()\n"
        )

        extractor = PatternExtractor(platforms_dir=temp_dir)
        library = extractor.extract_all([platform])

        db_patterns = [p for p in library.patterns if "Django Transaction" in p.name]
        assert len(db_patterns) >= 1

    # ── API client patterns ─────────────────────────────────────────────

    def test_extract_fetch_wrapper(self, temp_dir):
        """Extract fetch wrapper from api/ directory."""
        platform = temp_dir / "apiplatform"
        api_dir = platform / "api"
        api_dir.mkdir(parents=True)
        (api_dir / "client.ts").write_text(
            "async function fetchApi(url: string) {\n"
            "  const response = await fetch(url);\n"
            "  if (!response.ok) throw new Error('Request failed');\n"
            "  return response.json();\n"
            "}\n"
        )

        extractor = PatternExtractor(platforms_dir=temp_dir)
        library = extractor.extract_all([platform])

        api_patterns = [p for p in library.patterns if "Fetch" in p.name]
        assert len(api_patterns) >= 1

    # ── Utility patterns ────────────────────────────────────────────────

    def test_extract_utility_patterns(self, temp_dir):
        """Extract utility functions like formatDate, debounce, cn."""
        platform = temp_dir / "utilplatform"
        utils_dir = platform / "utils"
        utils_dir.mkdir(parents=True)
        (utils_dir / "helpers.ts").write_text(
            "export function formatDate(date: Date): string {\n"
            "  return date.toISOString();\n"
            "}\n\n"
            "export function debounce(fn: Function, delay: number) {\n"
            "  let timer: NodeJS.Timeout;\n"
            "  return (...args: any[]) => {\n"
            "    clearTimeout(timer);\n"
            "    timer = setTimeout(() => fn(...args), delay);\n"
            "  };\n"
            "}\n\n"
            "export function cn(...classes: string[]) {\n"
            "  return classes.filter(Boolean).join(' ');\n"
            "}\n"
        )

        extractor = PatternExtractor(platforms_dir=temp_dir)
        library = extractor.extract_all([platform])

        util_patterns = [p for p in library.patterns if p.category == "utility"]
        assert len(util_patterns) >= 2  # formatDate, debounce, cn

    # ── Tailwind config extraction ─────────────────────────────────────

    def test_extract_tailwind_config_content(self, temp_dir):
        """Tailwind config snippet is extracted into config category."""
        platform = temp_dir / "twplatform"
        platform.mkdir()
        (platform / "tailwind.config.ts").write_text(
            "import type { Config } from 'tailwindcss';\n"
            "const config: Config = {\n"
            "  content: ['./src/**/*.tsx'],\n"
            "  theme: { extend: { colors: { brand: '#3b82f6' } } },\n"
            "  plugins: [],\n"
            "};\n"
            "export default config;\n"
        )

        extractor = PatternExtractor(platforms_dir=temp_dir)
        library = extractor.extract_all([platform])

        tw_patterns = [p for p in library.patterns if "Tailwind" in p.name]
        assert len(tw_patterns) >= 1

    # ── _add_pattern duplicate ──────────────────────────────────────────

    def test_add_pattern_duplicate_increments(self, temp_dir):
        """Adding a pattern with the same hash increments occurrence."""
        extractor = PatternExtractor(platforms_dir=temp_dir)

        p1 = CodePattern(
            "a",
            "auth",
            "Clerk",
            "desc",
            "TS",
            "code",
            "h1",
            platforms=["p1"],
            file_paths=["f1"],
        )
        p2 = CodePattern(
            "b",
            "auth",
            "Clerk",
            "desc",
            "TS",
            "code",
            "h1",
            platforms=["p2"],
            file_paths=["f2"],
        )

        extractor._add_pattern(p1)
        extractor._add_pattern(p2)

        assert extractor.patterns["a"].occurrences == 2
        assert "p2" in extractor.patterns["a"].platforms

    # ── _extract_function regex ─────────────────────────────────────────

    def test_extract_function_found(self):
        extractor = PatternExtractor()
        content = "export async function fetchApi(url: string) { return fetch(url); }"
        result = extractor._extract_function(content, "fetchApi")
        assert "fetchApi" in result

    def test_extract_function_fallback(self):
        extractor = PatternExtractor()
        content = "const x = 42;\nconst y = 43;"
        result = extractor._extract_function(content, "nonexistent")
        assert result == content[:300]

    # ── _extract_hook regex ─────────────────────────────────────────────

    def test_extract_hook_found(self):
        extractor = PatternExtractor()
        content = "export const useAuth = () => { return { user: null }; };"
        result = extractor._extract_hook(content, "useAuth")
        assert "useAuth" in result

    def test_extract_hook_fallback(self):
        extractor = PatternExtractor()
        content = "const nothing = true;"
        result = extractor._extract_hook(content, "useAuth")
        assert result == content[:300]

    # ── _is_ignored ─────────────────────────────────────────────────────

    def test_is_ignored_for_ignored_path(self, temp_dir):
        """Ignored directories correctly filtered."""
        extractor = PatternExtractor(platforms_dir=temp_dir)
        assert extractor._is_ignored(Path("node_modules/foo/bar.ts")) is True

    # ── main() CLI ──────────────────────────────────────────────────────

    def test_main_no_args(self):
        from pattern_extractor import main

        with patch("sys.argv", ["pattern_extractor.py"]):
            with pytest.raises(SystemExit) as exc_info:
                main()
            assert exc_info.value.code == 1

    def test_main_with_args(self, temp_dir):
        platform = temp_dir / "p1"
        platform.mkdir()
        (platform / "middleware.ts").write_text(
            "import { clerkMiddleware } from '@clerk/nextjs/server';"
        )
        output = temp_dir / "out.json"

        from pattern_extractor import main

        with patch("pattern_extractor.MigrationLogger"):
            with patch("sys.argv", ["prog", str(temp_dir), str(output)]):
                main()
        assert output.exists()
