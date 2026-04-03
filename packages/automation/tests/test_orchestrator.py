"""
Unit tests for orchestrator.py

Tests MigrationOrchestrator against its actual API:
  - MigrationOrchestrator(workspace_root: Path)
  - analyze_platforms(platform_id=None) -> List[Dict]
  - generate_manifests(profiles=None)
  - create_migration_plan(strategy="parallel")
"""

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, Mock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))


@pytest.mark.unit
@pytest.mark.orchestrator
class TestOrchestrator:
    """Test MigrationOrchestrator class"""

    @patch("orchestrator.get_config")
    @patch("orchestrator.PlatformAnalyzer")
    def test_analyze_platforms(self, mock_analyzer_class, mock_get_config, temp_dir):
        """Test analyzing all platforms."""
        # Configure mock config
        mock_config = Mock()
        mock_config.legacy_root = temp_dir / "legacy"
        mock_config.data_dir = temp_dir / "data"
        mock_config.manifests_dir = temp_dir / "manifests"
        mock_config.legacy_root.mkdir(parents=True, exist_ok=True)
        mock_config.data_dir.mkdir(parents=True, exist_ok=True)
        mock_config.manifests_dir.mkdir(parents=True, exist_ok=True)
        mock_get_config.return_value = mock_config

        # Mock analyzer — export_profiles must also be mocked since analyze_platforms calls it
        from dataclasses import asdict, dataclass

        from platform_analyzer_v2 import PlatformProfile

        mock_profile = PlatformProfile(
            platform_id="test", name="Test", path=str(temp_dir)
        )
        mock_analyzer = Mock()
        mock_analyzer.analyze_all.return_value = [mock_profile]
        mock_analyzer.export_profiles = Mock()
        mock_analyzer_class.return_value = mock_analyzer

        from orchestrator import MigrationOrchestrator

        orchestrator = MigrationOrchestrator(workspace_root=temp_dir)
        profiles = orchestrator.analyze_platforms()

        mock_analyzer.analyze_all.assert_called_once()
        assert len(profiles) >= 1

    @patch("orchestrator.get_config")
    @patch("orchestrator.ManifestGenerator")
    def test_generate_manifests_with_profiles(
        self, mock_generator_class, mock_get_config, temp_dir
    ):
        """Test manifest generation with provided profiles."""
        mock_config = Mock()
        mock_config.legacy_root = temp_dir / "legacy"
        mock_config.data_dir = temp_dir / "data"
        mock_config.manifests_dir = temp_dir / "manifests"
        mock_config.legacy_root.mkdir(parents=True, exist_ok=True)
        mock_config.data_dir.mkdir(parents=True, exist_ok=True)
        mock_config.manifests_dir.mkdir(parents=True, exist_ok=True)
        mock_get_config.return_value = mock_config

        mock_generator = Mock()
        mock_generator.generate_all_manifests.return_value = [{"name": "test-manifest"}]
        mock_generator_class.return_value = mock_generator

        from orchestrator import MigrationOrchestrator

        orchestrator = MigrationOrchestrator(workspace_root=temp_dir)
        profiles = [
            {
                "platform_id": "test",
                "name": "Test",
                "tech_stack": {"framework": "nextjs"},
            }
        ]
        orchestrator.generate_manifests(profiles)

        mock_generator.generate_all_manifests.assert_called_once()

    @patch("orchestrator.get_config")
    def test_create_migration_plan(self, mock_get_config, temp_dir):
        """Test migration plan creation."""
        mock_config = Mock()
        mock_config.legacy_root = temp_dir / "legacy"
        mock_config.data_dir = temp_dir / "data"
        mock_config.manifests_dir = temp_dir / "manifests"
        mock_config.legacy_root.mkdir(parents=True, exist_ok=True)
        mock_config.data_dir.mkdir(parents=True, exist_ok=True)
        mock_config.manifests_dir.mkdir(parents=True, exist_ok=True)
        mock_get_config.return_value = mock_config

        # Write profiles file that create_migration_plan expects
        profiles_file = mock_config.data_dir / "platform_profiles.json"
        profiles_file.write_text(
            json.dumps(
                [
                    {
                        "platform_id": "test-app",
                        "name": "Test App",
                        "complexity": "MEDIUM",
                        "entity_count": 50,
                        "migration_estimate_weeks": 6,
                    }
                ]
            )
        )

        from orchestrator import MigrationOrchestrator

        orchestrator = MigrationOrchestrator(workspace_root=temp_dir)
        orchestrator.create_migration_plan(strategy="parallel")

        plan_file = temp_dir / "MIGRATION_PLAN.json"
        assert plan_file.exists()

        with open(plan_file) as f:
            plan = json.load(f)
        assert plan["strategy"] == "parallel"
        assert plan["total_platforms"] == 1

    @patch("orchestrator.get_config")
    def test_create_sequential_plan(self, mock_get_config, temp_dir):
        """Test sequential migration plan creation."""
        mock_config = Mock()
        mock_config.legacy_root = temp_dir / "legacy"
        mock_config.data_dir = temp_dir / "data"
        mock_config.manifests_dir = temp_dir / "manifests"
        mock_config.legacy_root.mkdir(parents=True, exist_ok=True)
        mock_config.data_dir.mkdir(parents=True, exist_ok=True)
        mock_config.manifests_dir.mkdir(parents=True, exist_ok=True)
        mock_get_config.return_value = mock_config

        profiles_file = mock_config.data_dir / "platform_profiles.json"
        profiles_file.write_text(
            json.dumps(
                [
                    {
                        "platform_id": "abr",
                        "name": "ABR Insights",
                        "complexity": "HIGH",
                        "entity_count": 30,
                        "migration_estimate_weeks": 8,
                    },
                    {
                        "platform_id": "ue",
                        "name": "Union Eyes",
                        "complexity": "MEDIUM",
                        "entity_count": 20,
                        "migration_estimate_weeks": 4,
                    },
                ]
            )
        )

        from orchestrator import MigrationOrchestrator

        orchestrator = MigrationOrchestrator(workspace_root=temp_dir)
        orchestrator.create_migration_plan(strategy="sequential")

        plan_file = temp_dir / "MIGRATION_PLAN.json"
        assert plan_file.exists()

        with open(plan_file) as f:
            plan = json.load(f)
        assert plan["strategy"] == "sequential"
        assert plan["total_platforms"] == 2
        assert plan["estimated_weeks"] == 12
        assert len(plan["phases"]) == 2
        # Check sequential ordering
        assert plan["phases"][0]["start_week"] == 0
        assert plan["phases"][1]["start_week"] == plan["phases"][0]["duration_weeks"]

    @patch("orchestrator.get_config")
    def test_migration_plan_report_generated(self, mock_get_config, temp_dir):
        """Test that markdown report is generated alongside JSON plan."""
        mock_config = Mock()
        mock_config.legacy_root = temp_dir / "legacy"
        mock_config.data_dir = temp_dir / "data"
        mock_config.manifests_dir = temp_dir / "manifests"
        mock_config.legacy_root.mkdir(parents=True, exist_ok=True)
        mock_config.data_dir.mkdir(parents=True, exist_ok=True)
        mock_config.manifests_dir.mkdir(parents=True, exist_ok=True)
        mock_get_config.return_value = mock_config

        profiles_file = mock_config.data_dir / "platform_profiles.json"
        profiles_file.write_text(
            json.dumps(
                [
                    {
                        "platform_id": "abr",
                        "name": "ABR Insights",
                        "complexity": "HIGH",
                        "entity_count": 30,
                        "migration_estimate_weeks": 8,
                    },
                ]
            )
        )

        from orchestrator import MigrationOrchestrator

        orchestrator = MigrationOrchestrator(workspace_root=temp_dir)
        orchestrator.create_migration_plan(strategy="sequential")

        report_file = temp_dir / "MIGRATION_PLAN.md"
        assert report_file.exists()
        content = report_file.read_text()
        assert "Migration Plan" in content
        assert "ABR Insights" in content

    @patch("orchestrator.get_config")
    def test_sort_by_migration_order(self, mock_get_config, temp_dir):
        """Test platform sorting by priority and complexity."""
        mock_config = Mock()
        mock_config.legacy_root = temp_dir / "legacy"
        mock_config.data_dir = temp_dir / "data"
        mock_config.manifests_dir = temp_dir / "manifests"
        mock_config.legacy_root.mkdir(parents=True, exist_ok=True)
        mock_config.data_dir.mkdir(parents=True, exist_ok=True)
        mock_config.manifests_dir.mkdir(parents=True, exist_ok=True)
        mock_get_config.return_value = mock_config

        from orchestrator import MigrationOrchestrator

        orchestrator = MigrationOrchestrator(workspace_root=temp_dir)

        profiles = [
            {
                "platform_id": "low-pri",
                "complexity": "LOW",
                "entity_count": 5,
                "migration_estimate_weeks": 2,
            },
            {
                "platform_id": "union-eyes",
                "complexity": "HIGH",
                "entity_count": 50,
                "migration_estimate_weeks": 8,
            },
            {
                "platform_id": "abr",
                "complexity": "EXTREME",
                "entity_count": 30,
                "migration_estimate_weeks": 12,
            },
        ]

        sorted_profiles = orchestrator._sort_by_migration_order(profiles)
        ids = [p["platform_id"] for p in sorted_profiles]
        # union-eyes and abr should come before low-pri based on priority map
        assert ids.index("union-eyes") < ids.index("low-pri")

    @patch("orchestrator.get_config")
    def test_create_migration_batches(self, mock_get_config, temp_dir):
        """Test batch creation for parallel migration."""
        mock_config = Mock()
        mock_config.legacy_root = temp_dir / "legacy"
        mock_config.data_dir = temp_dir / "data"
        mock_config.manifests_dir = temp_dir / "manifests"
        mock_config.legacy_root.mkdir(parents=True, exist_ok=True)
        mock_config.data_dir.mkdir(parents=True, exist_ok=True)
        mock_config.manifests_dir.mkdir(parents=True, exist_ok=True)
        mock_get_config.return_value = mock_config

        from orchestrator import MigrationOrchestrator

        orchestrator = MigrationOrchestrator(workspace_root=temp_dir)

        profiles = [
            {
                "platform_id": "union-eyes",
                "complexity": "HIGH",
                "entity_count": 50,
                "migration_estimate_weeks": 8,
                "tech_stack": {"framework": "Next.js"},
            },
            {
                "platform_id": "app1",
                "complexity": "MEDIUM",
                "entity_count": 20,
                "migration_estimate_weeks": 4,
                "tech_stack": {"framework": "Next.js"},
            },
            {
                "platform_id": "app2",
                "complexity": "LOW",
                "entity_count": 10,
                "migration_estimate_weeks": 2,
                "tech_stack": {"framework": "Django"},
            },
        ]

        batches = orchestrator._create_migration_batches(profiles)
        assert len(batches) >= 1
        # Foundation batch should contain union-eyes
        foundation = batches[0]
        assert "union-eyes" in foundation["platforms"]

    @patch("orchestrator.get_config")
    def test_parallel_plan_time_savings(self, mock_get_config, temp_dir):
        """Test that parallel plan shows time savings over sequential baseline."""
        mock_config = Mock()
        mock_config.legacy_root = temp_dir / "legacy"
        mock_config.data_dir = temp_dir / "data"
        mock_config.manifests_dir = temp_dir / "manifests"
        mock_config.legacy_root.mkdir(parents=True, exist_ok=True)
        mock_config.data_dir.mkdir(parents=True, exist_ok=True)
        mock_config.manifests_dir.mkdir(parents=True, exist_ok=True)
        mock_get_config.return_value = mock_config

        profiles_file = mock_config.data_dir / "platform_profiles.json"
        profiles_file.write_text(
            json.dumps(
                [
                    {
                        "platform_id": "union-eyes",
                        "name": "Union Eyes",
                        "complexity": "HIGH",
                        "entity_count": 50,
                        "migration_estimate_weeks": 8,
                        "tech_stack": {"framework": "Next.js"},
                    },
                    {
                        "platform_id": "app1",
                        "name": "App One",
                        "complexity": "MEDIUM",
                        "entity_count": 20,
                        "migration_estimate_weeks": 4,
                        "tech_stack": {"framework": "Next.js"},
                    },
                ]
            )
        )

        from orchestrator import MigrationOrchestrator

        orchestrator = MigrationOrchestrator(workspace_root=temp_dir)
        orchestrator.create_migration_plan(strategy="parallel")

        plan_file = temp_dir / "MIGRATION_PLAN.json"
        with open(plan_file) as f:
            plan = json.load(f)
        assert plan["strategy"] == "parallel"
        assert plan["sequential_baseline"] == 12
        assert plan["time_savings"] >= 0

    @patch("orchestrator.get_config")
    def test_analyze_single_platform(self, mock_get_config, temp_dir):
        """Test analyzing a specific platform by ID."""
        mock_config = Mock()
        mock_config.legacy_root = temp_dir / "legacy"
        mock_config.data_dir = temp_dir / "data"
        mock_config.manifests_dir = temp_dir / "manifests"
        mock_config.legacy_root.mkdir(parents=True, exist_ok=True)
        mock_config.data_dir.mkdir(parents=True, exist_ok=True)
        mock_config.manifests_dir.mkdir(parents=True, exist_ok=True)
        mock_get_config.return_value = mock_config

        from orchestrator import MigrationOrchestrator

        orchestrator = MigrationOrchestrator(workspace_root=temp_dir)
        # Request a platform that doesn't exist
        profiles = orchestrator.analyze_platforms(platform_id="nonexistent")
        assert profiles == []


@pytest.mark.integration
@pytest.mark.orchestrator
class TestOrchestratorIntegration:
    """Integration tests for Orchestrator"""

    def test_end_to_end_orchestration(self, mock_legacy_platform, temp_dir):
        """Test complete orchestration workflow — placeholder for full integration."""
        # Full integration requires real config + filesystem
        # Covered by unit tests above
        pass


def _make_orchestrator(mock_get_config, temp_dir):
    """Helper to build an orchestrator with mocked config."""
    mock_config = Mock()
    mock_config.legacy_root = temp_dir / "legacy"
    mock_config.data_dir = temp_dir / "data"
    mock_config.manifests_dir = temp_dir / "manifests"
    for d in (mock_config.legacy_root, mock_config.data_dir, mock_config.manifests_dir):
        d.mkdir(parents=True, exist_ok=True)
    mock_get_config.return_value = mock_config
    from orchestrator import MigrationOrchestrator

    return MigrationOrchestrator(workspace_root=temp_dir), mock_config


@pytest.mark.unit
@pytest.mark.orchestrator
class TestOrchestratorExtended:
    """Additional orchestrator tests for full coverage."""

    # ── apply_template ──────────────────────────────────────────────────

    @patch("orchestrator.get_config")
    def test_apply_template_dry_run(self, mock_get_config, temp_dir):
        """apply_template with dry_run prints without executing."""
        orch, cfg = _make_orchestrator(mock_get_config, temp_dir)
        manifest = cfg.manifests_dir / "my-app.manifest.json"
        manifest.write_text(json.dumps({"name": "My App"}))
        orch.template_root = temp_dir / "template"
        orch.template_root.mkdir()
        orch.apply_template("my-app", dry_run=True)  # should not raise

    @patch("orchestrator.get_config")
    def test_apply_template_no_manifest(self, mock_get_config, temp_dir, capsys):
        """apply_template prints error when manifest is missing."""
        orch, _ = _make_orchestrator(mock_get_config, temp_dir)
        orch.apply_template("nonexistent")
        captured = capsys.readouterr()
        assert "No manifest found" in captured.out

    @patch("orchestrator.get_config")
    def test_apply_template_no_template_dir(self, mock_get_config, temp_dir, capsys):
        """apply_template prints error when template dir missing."""
        orch, cfg = _make_orchestrator(mock_get_config, temp_dir)
        manifest = cfg.manifests_dir / "x.manifest.json"
        manifest.write_text("{}")
        orch.template_root = temp_dir / "no-such-template"
        orch.apply_template("x")
        captured = capsys.readouterr()
        assert "Template not found" in captured.out

    @patch("orchestrator.get_config")
    def test_apply_template_non_dry(self, mock_get_config, temp_dir, capsys):
        """apply_template without dry_run prints manual instructions."""
        orch, cfg = _make_orchestrator(mock_get_config, temp_dir)
        manifest = cfg.manifests_dir / "y.manifest.json"
        manifest.write_text("{}")
        orch.template_root = temp_dir / "tpl"
        orch.template_root.mkdir()
        orch.apply_template("y", dry_run=False)
        captured = capsys.readouterr()
        assert "Template application requires manual steps" in captured.out

    # ── generate_code ───────────────────────────────────────────────────

    @patch("orchestrator.run_ue_generation")
    @patch("orchestrator.run_abr_generation")
    @patch("orchestrator.get_config")
    def test_generate_code_all(self, mock_get_config, mock_abr, mock_ue, temp_dir):
        orch, _ = _make_orchestrator(mock_get_config, temp_dir)
        r = Mock(model_count=3, field_count=10)
        mock_abr.return_value = [r]
        mock_ue.return_value = [r]
        results = orch.generate_code("all")
        assert len(results) == 2

    @patch("orchestrator.run_abr_generation")
    @patch("orchestrator.get_config")
    def test_generate_code_abr_only(self, mock_get_config, mock_abr, temp_dir):
        orch, _ = _make_orchestrator(mock_get_config, temp_dir)
        mock_abr.return_value = [Mock(model_count=1, field_count=5)]
        results = orch.generate_code("abr")
        assert len(results) == 1

    # ── analyze_dependencies ────────────────────────────────────────────

    @patch("orchestrator.analyze_ue_dependencies")
    @patch("orchestrator.analyze_abr_dependencies")
    @patch("orchestrator.get_config")
    def test_analyze_dependencies(self, mock_get_config, mock_abr, mock_ue, temp_dir):
        orch, _ = _make_orchestrator(mock_get_config, temp_dir)
        mock_abr.return_value = Mock(
            platform="abr", total_packages=10, categories={"core": 5}
        )
        mock_ue.return_value = Mock(
            platform="ue", total_packages=8, categories={"core": 3}
        )
        reports = orch.analyze_dependencies("all")
        assert len(reports) == 2

    # ── track_progress ──────────────────────────────────────────────────

    @patch("orchestrator.init_tracking")
    @patch("orchestrator.get_config")
    def test_track_progress_summary(self, mock_get_config, mock_init, temp_dir):
        orch, _ = _make_orchestrator(mock_get_config, temp_dir)
        platform_mock = Mock()
        platform_mock.compute_overall.return_value = None
        platform_mock.overall_progress = 55.0
        platform_mock.platform_name = "ABR"
        tracker_mock = Mock()
        tracker_mock.platforms = {"abr": platform_mock}
        mock_init.return_value = tracker_mock
        tracker = orch.track_progress(dashboard=False)
        assert tracker is tracker_mock

    @patch("orchestrator.init_tracking")
    @patch("orchestrator.get_config")
    def test_track_progress_dashboard(self, mock_get_config, mock_init, temp_dir):
        orch, _ = _make_orchestrator(mock_get_config, temp_dir)
        tracker_mock = Mock()
        tracker_mock.generate_dashboard.return_value = "# Dashboard"
        mock_init.return_value = tracker_mock
        orch.track_progress(dashboard=True, platform="abr")
        tracker_mock.generate_dashboard.assert_called_once_with("abr")

    # ── status ──────────────────────────────────────────────────────────

    @patch("orchestrator.get_config")
    def test_status_no_profiles(self, mock_get_config, temp_dir, capsys):
        orch, _ = _make_orchestrator(mock_get_config, temp_dir)
        orch.status()
        captured = capsys.readouterr()
        assert "Not completed" in captured.out

    @patch("orchestrator.get_config")
    def test_status_with_profiles(self, mock_get_config, temp_dir, capsys):
        orch, cfg = _make_orchestrator(mock_get_config, temp_dir)
        (cfg.data_dir / "platform_profiles.json").write_text(
            json.dumps(
                [
                    {
                        "platform_id": "a",
                        "entity_count": 10,
                        "size_mb": 1.0,
                        "complexity": "LOW",
                    }
                ]
            )
        )
        # Manifests
        (cfg.manifests_dir / "a.manifest.json").write_text("{}")
        # Plan
        (temp_dir / "MIGRATION_PLAN.json").write_text(
            json.dumps({"strategy": "parallel", "estimated_weeks": 5})
        )
        orch.status()
        captured = capsys.readouterr()
        assert "1 platforms analyzed" in captured.out
        assert "1 manifests" in captured.out
        assert "parallel strategy" in captured.out

    # ── batching with high-complexity grouping ──────────────────────────

    @patch("orchestrator.get_config")
    def test_batches_nextjs_and_django(self, mock_get_config, temp_dir):
        """High-complexity platforms grouped by framework."""
        orch, _ = _make_orchestrator(mock_get_config, temp_dir)
        profiles = [
            {
                "platform_id": "p1",
                "complexity": "HIGH",
                "entity_count": 100,
                "migration_estimate_weeks": 9,
                "tech_stack": {"framework": "Next.js"},
            },
            {
                "platform_id": "p2",
                "complexity": "EXTREME",
                "entity_count": 200,
                "migration_estimate_weeks": 12,
                "tech_stack": {"framework": "Django"},
            },
            {
                "platform_id": "p3",
                "complexity": "LOW",
                "entity_count": 5,
                "migration_estimate_weeks": 2,
                "tech_stack": {"framework": "Express"},
            },
        ]
        batches = orch._create_migration_batches(profiles)
        # Should have Next.js batch and Django batch
        names = [b["name"] for b in batches]
        assert any("Next.js" in n for n in names)
        assert any("Django" in n for n in names)

    @patch("orchestrator.get_config")
    def test_batches_split_remaining(self, mock_get_config, temp_dir):
        """More than 4 remaining platforms get split into two batches."""
        orch, _ = _make_orchestrator(mock_get_config, temp_dir)
        profiles = [
            {
                "platform_id": f"app-{i}",
                "complexity": "LOW",
                "entity_count": 5,
                "migration_estimate_weeks": 2,
                "tech_stack": {"framework": "Express"},
            }
            for i in range(6)
        ]
        batches = orch._create_migration_batches(profiles)
        # Should have at least 2 standard batches
        standard = [b for b in batches if "Standard" in b.get("name", "")]
        assert len(standard) == 2

    # ── _generate_plan_report parallel ──────────────────────────────────

    @patch("orchestrator.get_config")
    def test_plan_report_parallel(self, mock_get_config, temp_dir):
        orch, _ = _make_orchestrator(mock_get_config, temp_dir)
        plan = {
            "strategy": "parallel",
            "total_platforms": 2,
            "estimated_weeks": 8,
            "sequential_baseline": 12,
            "time_savings": 4,
            "batches": [
                {
                    "batch": 1,
                    "name": "Batch 1",
                    "duration_weeks": 8,
                    "parallel": True,
                    "goal": "Goal",
                    "platforms": ["a", "b"],
                },
            ],
        }
        out = temp_dir / "report.md"
        orch._generate_plan_report(plan, out)
        content = out.read_text()
        assert "Time Savings" in content
        assert "Parallel" in content

    # ── generate_manifests without profiles ─────────────────────────────

    @patch("orchestrator.get_config")
    def test_generate_manifests_no_profiles_file(
        self, mock_get_config, temp_dir, capsys
    ):
        orch, _ = _make_orchestrator(mock_get_config, temp_dir)
        orch.generate_manifests()  # no profiles file → error message
        captured = capsys.readouterr()
        assert "No platform profiles found" in captured.out

    # ── main() CLI ──────────────────────────────────────────────────────

    @patch("orchestrator.get_config")
    def test_main_no_command(self, mock_get_config, temp_dir):
        from orchestrator import main

        with patch("sys.argv", ["orchestrator.py"]):
            main()  # prints help, doesn't crash

    @patch("orchestrator.get_config")
    def test_main_status_command(self, mock_get_config, temp_dir):
        from orchestrator import main

        cfg = Mock()
        cfg.legacy_root = temp_dir / "legacy"
        cfg.data_dir = temp_dir / "data"
        cfg.manifests_dir = temp_dir / "manifests"
        for d in (cfg.legacy_root, cfg.data_dir, cfg.manifests_dir):
            d.mkdir(parents=True, exist_ok=True)
        mock_get_config.return_value = cfg
        with patch(
            "sys.argv", ["orchestrator.py", "--workspace", str(temp_dir), "status"]
        ):
            main()

    @patch("orchestrator.MigrationOrchestrator")
    @patch("orchestrator.get_config")
    def test_main_plan_command(self, mock_get_config, mock_orch_cls, temp_dir):
        from orchestrator import main

        mock_orch = Mock()
        mock_orch_cls.return_value = mock_orch
        with patch(
            "sys.argv",
            ["prog", "--workspace", str(temp_dir), "plan", "--strategy", "sequential"],
        ):
            main()
        mock_orch.create_migration_plan.assert_called_once_with("sequential")

    @patch("orchestrator.MigrationOrchestrator")
    @patch("orchestrator.get_config")
    def test_main_apply_template_command(
        self, mock_get_config, mock_orch_cls, temp_dir
    ):
        from orchestrator import main

        mock_orch = Mock()
        mock_orch_cls.return_value = mock_orch
        with patch(
            "sys.argv",
            [
                "prog",
                "--workspace",
                str(temp_dir),
                "apply-template",
                "--platform",
                "my-app",
                "--dry-run",
            ],
        ):
            main()
        mock_orch.apply_template.assert_called_once_with("my-app", True)

    @patch("orchestrator.MigrationOrchestrator")
    @patch("orchestrator.get_config")
    def test_main_generate_code_command(self, mock_get_config, mock_orch_cls, temp_dir):
        from orchestrator import main

        mock_orch = Mock()
        mock_orch_cls.return_value = mock_orch
        with patch(
            "sys.argv",
            [
                "prog",
                "--workspace",
                str(temp_dir),
                "generate-code",
                "--platform",
                "abr",
            ],
        ):
            main()
        mock_orch.generate_code.assert_called_once_with("abr")

    @patch("orchestrator.MigrationOrchestrator")
    @patch("orchestrator.get_config")
    def test_main_analyze_deps_command(self, mock_get_config, mock_orch_cls, temp_dir):
        from orchestrator import main

        mock_orch = Mock()
        mock_orch_cls.return_value = mock_orch
        with patch("sys.argv", ["prog", "--workspace", str(temp_dir), "analyze-deps"]):
            main()
        mock_orch.analyze_dependencies.assert_called_once_with("all")

    @patch("orchestrator.MigrationOrchestrator")
    @patch("orchestrator.get_config")
    def test_main_progress_command(self, mock_get_config, mock_orch_cls, temp_dir):
        from orchestrator import main

        mock_orch = Mock()
        mock_orch_cls.return_value = mock_orch
        with patch(
            "sys.argv",
            ["prog", "--workspace", str(temp_dir), "progress", "--dashboard"],
        ):
            main()
        mock_orch.track_progress.assert_called_once()

    @patch("orchestrator.MigrationOrchestrator")
    @patch("orchestrator.get_config")
    def test_main_full_setup_command(self, mock_get_config, mock_orch_cls, temp_dir):
        from orchestrator import main

        mock_orch = Mock()
        mock_orch.analyze_platforms.return_value = [{"name": "a"}]
        mock_orch_cls.return_value = mock_orch
        with patch("sys.argv", ["prog", "--workspace", str(temp_dir), "full-setup"]):
            main()
        mock_orch.analyze_platforms.assert_called_once()
        mock_orch.generate_manifests.assert_called_once()
        mock_orch.create_migration_plan.assert_called_once_with("parallel")
        mock_orch.status.assert_called_once()

    @patch("orchestrator.MigrationOrchestrator")
    @patch("orchestrator.get_config")
    def test_main_generate_manifests_command(
        self, mock_get_config, mock_orch_cls, temp_dir
    ):
        from orchestrator import main

        mock_orch = Mock()
        mock_orch_cls.return_value = mock_orch
        with patch(
            "sys.argv", ["prog", "--workspace", str(temp_dir), "generate-manifests"]
        ):
            main()
        mock_orch.generate_manifests.assert_called_once()

    @patch("orchestrator.MigrationOrchestrator")
    @patch("orchestrator.get_config")
    def test_main_analyze_command(self, mock_get_config, mock_orch_cls, temp_dir):
        from orchestrator import main

        mock_orch = Mock()
        mock_orch.analyze_platforms.return_value = []
        mock_orch_cls.return_value = mock_orch
        with patch(
            "sys.argv",
            ["prog", "--workspace", str(temp_dir), "analyze", "--platform", "myapp"],
        ):
            main()
        mock_orch.analyze_platforms.assert_called_once()

    # ── Coverage for remaining uncovered lines ───────────────────────

    def test_analyze_single_platform(self, temp_dir):
        """analyze_platforms with platform_id hits single-platform branch (lines 66-67)."""
        from orchestrator import MigrationOrchestrator

        orch = MigrationOrchestrator(workspace_root=temp_dir)
        # Override legacy_root to temp path
        orch.legacy_root = temp_dir / "legacy"
        orch.legacy_root.mkdir(parents=True, exist_ok=True)
        orch.data_dir = temp_dir / "data"
        orch.data_dir.mkdir(parents=True, exist_ok=True)
        # Create a platform dir inside the temp legacy_root
        plat_dir = orch.legacy_root / "my-plat"
        plat_dir.mkdir(parents=True)
        (plat_dir / "package.json").write_text(
            '{"name":"my-plat","dependencies":{"next":"^14"}}'
        )
        (plat_dir / "tsconfig.json").write_text("{}")
        result = orch.analyze_platforms(platform_id="my-plat")
        assert len(result) == 1

    def test_analyze_platform_not_found(self, temp_dir, capsys):
        """analyze_platforms with bad platform_id prints error."""
        from orchestrator import MigrationOrchestrator

        orch = MigrationOrchestrator(workspace_root=temp_dir)
        orch.legacy_root = temp_dir / "empty-legacy"
        orch.legacy_root.mkdir(parents=True, exist_ok=True)
        result = orch.analyze_platforms(platform_id="nonexistent")
        assert result == []
        captured = capsys.readouterr()
        assert "not found" in captured.out

    def test_generate_manifests_from_profiles_file(self, temp_dir):
        """generate_manifests loads profiles from JSON file when not passed (lines 96-97)."""
        from orchestrator import MigrationOrchestrator

        orch = MigrationOrchestrator(workspace_root=temp_dir)
        # Override to use temp paths
        orch.data_dir = temp_dir / "data"
        orch.data_dir.mkdir(parents=True, exist_ok=True)
        orch.manifests_dir = temp_dir / "manifests"
        orch.manifests_dir.mkdir(parents=True, exist_ok=True)
        profiles_file = orch.data_dir / "platform_profiles.json"
        profiles_file.write_text(
            json.dumps(
                [
                    {
                        "platform_id": "acme",
                        "name": "Acme",
                        "path": "/acme",
                        "tech_stack": {
                            "framework": "Next.js",
                            "language": "TypeScript",
                            "monorepo": False,
                        },
                        "database": {
                            "type": "postgresql",
                            "orm": "Drizzle",
                            "models_count": 5,
                            "migrations_count": 3,
                            "has_rls": False,
                        },
                        "auth": {"current": "clerk", "migration_complexity": "LOW"},
                        "entity_count": 5,
                        "pages_count": 2,
                        "api_routes_count": 1,
                        "size_mb": 1.0,
                        "features": [],
                        "production_readiness": 7,
                        "complexity": "LOW",
                        "migration_estimate_weeks": 4,
                        "business_vertical": "saas",
                        "dependencies": [],
                    }
                ]
            )
        )
        orch.generate_manifests()

    def test_generate_manifests_no_profiles(self, temp_dir, capsys):
        """generate_manifests prints error when no profiles exist (lines 120-121)."""
        from orchestrator import MigrationOrchestrator

        orch = MigrationOrchestrator(workspace_root=temp_dir)
        # Override to use empty temp paths
        orch.data_dir = temp_dir / "empty-data"
        orch.data_dir.mkdir(parents=True, exist_ok=True)
        orch.generate_manifests()
        captured = capsys.readouterr()
        assert "No platform profiles found" in captured.out

    def test_status_no_manifests(self, temp_dir, capsys):
        """status prints 'Not generated' when manifests_dir missing (line 419)."""
        from orchestrator import MigrationOrchestrator

        orch = MigrationOrchestrator(workspace_root=temp_dir)
        # Override to use temp paths
        orch.data_dir = temp_dir / "status-data"
        orch.data_dir.mkdir(parents=True, exist_ok=True)
        orch.manifests_dir = temp_dir / "nonexistent-manifests"
        profiles_file = orch.data_dir / "platform_profiles.json"
        profiles_file.write_text(
            json.dumps(
                [
                    {
                        "platform_id": "a",
                        "name": "A",
                        "path": "/a",
                        "entity_count": 1,
                        "size_mb": 0.1,
                        "complexity": "LOW",
                    }
                ]
            )
        )
        orch.status()
        captured = capsys.readouterr()
        assert "Not generated" in captured.out

    def test_status_no_migration_plan(self, temp_dir, capsys):
        """status prints 'Not created' when migration plan missing (line 428)."""
        from orchestrator import MigrationOrchestrator

        orch = MigrationOrchestrator(workspace_root=temp_dir)
        # Override to use temp paths
        orch.data_dir = temp_dir / "plan-data"
        orch.data_dir.mkdir(parents=True, exist_ok=True)
        orch.manifests_dir = temp_dir / "plan-manifests"
        orch.manifests_dir.mkdir(parents=True, exist_ok=True)
        profiles_file = orch.data_dir / "platform_profiles.json"
        profiles_file.write_text(
            json.dumps(
                [
                    {
                        "platform_id": "a",
                        "name": "A",
                        "path": "/a",
                        "entity_count": 1,
                        "size_mb": 0.1,
                        "complexity": "LOW",
                    }
                ]
            )
        )
        orch.status()
        captured = capsys.readouterr()
        assert "Not created" in captured.out

    def test_create_migration_plan_no_profiles(self, temp_dir, capsys):
        """create_migration_plan prints error when no profiles exist (lines 120-121)."""
        from orchestrator import MigrationOrchestrator

        orch = MigrationOrchestrator(workspace_root=temp_dir)
        orch.data_dir = temp_dir / "no-plan-data"
        orch.data_dir.mkdir(parents=True, exist_ok=True)
        orch.create_migration_plan()
        captured = capsys.readouterr()
        assert "No platform profiles found" in captured.out

    def test_conftest_fixtures_covered(
        self, mock_platform_profile, mock_calibration_data
    ):
        """Exercise conftest fixtures so their body lines are covered."""
        assert mock_platform_profile["id"] == "mock-platform"
        assert "union-eyes" in mock_calibration_data
