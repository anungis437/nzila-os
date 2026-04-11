"""
Unit tests for progress_tracker.py

Tests QualityGate, PhaseProgress, PlatformProgress, ProgressTracker,
and the full lifecycle of phase/gate management + persistence.
"""

import json
import sys
from pathlib import Path
from unittest.mock import Mock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "generators"))
sys.path.insert(0, str(Path(__file__).parent.parent / "generators" / "core"))

from progress_tracker import (
    MigrationPhase,
    PhaseProgress,
    PhaseStatus,
    PlatformProgress,
    ProgressTracker,
    QualityGate,
    QualityGateStatus,
    _default_quality_gates,
)

# ──────────────────────────────────────────
# QualityGate
# ──────────────────────────────────────────


@pytest.mark.unit
class TestQualityGate:
    """Test QualityGate dataclass."""

    def test_default_status(self):
        gate = QualityGate(name="test", description="A test gate")
        assert gate.status == QualityGateStatus.PENDING
        assert gate.checked_at is None
        assert gate.required is True

    def test_pass_gate(self):
        gate = QualityGate(name="test", description="A test gate")
        gate.pass_gate("All good")
        assert gate.status == QualityGateStatus.PASSED
        assert gate.checked_at is not None
        assert gate.message == "All good"

    def test_fail_gate(self):
        gate = QualityGate(name="test", description="A test gate")
        gate.fail_gate("Something broke")
        assert gate.status == QualityGateStatus.FAILED
        assert gate.message == "Something broke"

    def test_waive_gate(self):
        gate = QualityGate(name="test", description="A test gate")
        gate.waive_gate("Not applicable")
        assert gate.status == QualityGateStatus.WAIVED
        assert "WAIVED" in gate.message

    def test_non_required_gate(self):
        gate = QualityGate(name="advisory", description="Advisory", required=False)
        assert gate.required is False


# ──────────────────────────────────────────
# PhaseProgress
# ──────────────────────────────────────────


@pytest.mark.unit
class TestPhaseProgress:
    """Test PhaseProgress dataclass."""

    def test_defaults(self):
        pp = PhaseProgress(phase="analysis")
        assert pp.status == PhaseStatus.NOT_STARTED
        assert pp.progress_pct == 0.0
        assert pp.tasks_total == 0

    def test_start(self):
        pp = PhaseProgress(phase="analysis")
        pp.start()
        assert pp.status == PhaseStatus.IN_PROGRESS
        assert pp.started_at is not None

    def test_complete(self):
        pp = PhaseProgress(phase="analysis")
        pp.start()
        pp.complete()
        assert pp.status == PhaseStatus.COMPLETED
        assert pp.progress_pct == 100.0
        assert pp.completed_at is not None

    def test_fail(self):
        pp = PhaseProgress(phase="analysis")
        pp.fail("Test failure")
        assert pp.status == PhaseStatus.FAILED
        assert pp.notes == "Test failure"

    def test_block(self):
        pp = PhaseProgress(phase="analysis")
        pp.block("Waiting for DB")
        assert pp.status == PhaseStatus.BLOCKED
        assert "Waiting for DB" in pp.blockers

    def test_update_progress(self):
        pp = PhaseProgress(phase="analysis")
        pp.update_progress(3, 10)
        assert pp.tasks_completed == 3
        assert pp.tasks_total == 10
        assert pp.progress_pct == 30.0

    def test_update_progress_zero_total(self):
        pp = PhaseProgress(phase="analysis")
        pp.update_progress(0, 0)
        assert pp.progress_pct == 0.0

    def test_all_gates_passed_empty(self):
        pp = PhaseProgress(phase="analysis")
        assert pp.all_gates_passed() is True

    def test_all_gates_passed_with_passed_gates(self):
        gate = QualityGate(name="g1", description="gate 1")
        gate.pass_gate()
        pp = PhaseProgress(phase="analysis", quality_gates=[gate])
        assert pp.all_gates_passed() is True

    def test_all_gates_not_passed(self):
        gate = QualityGate(name="g1", description="gate 1")
        pp = PhaseProgress(phase="analysis", quality_gates=[gate])
        assert pp.all_gates_passed() is False

    def test_waived_gate_counts_as_passed(self):
        gate = QualityGate(name="g1", description="gate 1")
        gate.waive_gate("OK")
        pp = PhaseProgress(phase="analysis", quality_gates=[gate])
        assert pp.all_gates_passed() is True

    def test_non_required_gate_ignored(self):
        gate = QualityGate(name="advisory", description="advisory", required=False)
        pp = PhaseProgress(phase="analysis", quality_gates=[gate])
        assert pp.all_gates_passed() is True


# ──────────────────────────────────────────
# PlatformProgress
# ──────────────────────────────────────────


@pytest.mark.unit
class TestPlatformProgress:
    """Test PlatformProgress dataclass."""

    def test_defaults(self):
        pp = PlatformProgress(platform_id="test", platform_name="Test")
        assert pp.overall_progress == 0.0
        assert pp.phases == {}

    def test_compute_overall_empty(self):
        pp = PlatformProgress(platform_id="test", platform_name="Test")
        pp.compute_overall()
        assert pp.overall_progress == 0.0

    def test_compute_overall(self):
        pp = PlatformProgress(platform_id="test", platform_name="Test")
        pp.phases["a"] = PhaseProgress(phase="a", progress_pct=50.0)
        pp.phases["b"] = PhaseProgress(phase="b", progress_pct=100.0)
        pp.compute_overall()
        assert pp.overall_progress == 75.0
        assert pp.last_updated is not None


# ──────────────────────────────────────────
# Default Quality Gates
# ──────────────────────────────────────────


@pytest.mark.unit
class TestDefaultQualityGates:
    """Test _default_quality_gates function."""

    def test_analysis_gates(self):
        gates = _default_quality_gates(MigrationPhase.ANALYSIS)
        names = [g.name for g in gates]
        assert "schema_report_exists" in names
        assert "tech_stack_identified" in names

    def test_schema_extraction_gates(self):
        gates = _default_quality_gates(MigrationPhase.SCHEMA_EXTRACTION)
        assert len(gates) >= 2

    def test_code_generation_gates(self):
        gates = _default_quality_gates(MigrationPhase.CODE_GENERATION)
        names = [g.name for g in gates]
        assert "models_generated" in names

    def test_testing_gates(self):
        gates = _default_quality_gates(MigrationPhase.TESTING)
        names = [g.name for g in gates]
        assert "coverage_80pct" in names

    def test_deployment_gates(self):
        gates = _default_quality_gates(MigrationPhase.DEPLOYMENT)
        names = [g.name for g in gates]
        assert "docker_builds" in names

    def test_unknown_phase_returns_empty(self):
        gates = _default_quality_gates(MigrationPhase.CUTOVER)
        assert gates == []


# ──────────────────────────────────────────
# ProgressTracker
# ──────────────────────────────────────────


@pytest.mark.unit
class TestProgressTracker:
    """Test ProgressTracker class."""

    def test_initialization(self, tmp_path):
        tracker = ProgressTracker(checkpoint_dir=tmp_path / "progress")
        assert (tmp_path / "progress").is_dir()
        assert tracker.platforms == {}

    def test_init_platform(self, tmp_path):
        tracker = ProgressTracker(checkpoint_dir=tmp_path)
        tracker.init_platform("abr", "ABR Insights")

        assert "abr" in tracker.platforms
        p = tracker.platforms["abr"]
        assert p.platform_name == "ABR Insights"
        assert len(p.phases) == len(MigrationPhase)
        assert p.started_at is not None

    def test_init_platform_idempotent(self, tmp_path):
        tracker = ProgressTracker(checkpoint_dir=tmp_path)
        tracker.init_platform("abr", "ABR Insights")
        tracker.init_platform("abr", "ABR Insights 2")  # should skip
        assert tracker.platforms["abr"].platform_name == "ABR Insights"

    def test_init_platform_custom_phases(self, tmp_path):
        tracker = ProgressTracker(checkpoint_dir=tmp_path)
        tracker.init_platform(
            "mini", "Mini", phases=[MigrationPhase.ANALYSIS, MigrationPhase.TESTING]
        )
        assert len(tracker.platforms["mini"].phases) == 2

    def test_start_phase(self, tmp_path):
        tracker = ProgressTracker(checkpoint_dir=tmp_path)
        tracker.init_platform("abr", "ABR Insights")
        tracker.start_phase("abr", MigrationPhase.ANALYSIS)

        pp = tracker.platforms["abr"].phases["analysis"]
        assert pp.status == PhaseStatus.IN_PROGRESS

    def test_update_phase(self, tmp_path):
        tracker = ProgressTracker(checkpoint_dir=tmp_path)
        tracker.init_platform("abr", "ABR Insights")
        tracker.start_phase("abr", MigrationPhase.ANALYSIS)
        tracker.update_phase(
            "abr", MigrationPhase.ANALYSIS, completed=3, total=5, notes="In progress"
        )

        pp = tracker.platforms["abr"].phases["analysis"]
        assert pp.progress_pct == 60.0
        assert pp.notes == "In progress"

    def test_complete_phase(self, tmp_path):
        tracker = ProgressTracker(checkpoint_dir=tmp_path)
        tracker.init_platform("abr", "ABR Insights")
        tracker.start_phase("abr", MigrationPhase.ANALYSIS)
        # Pass all required gates first
        for gate in tracker.platforms["abr"].phases["analysis"].quality_gates:
            gate.pass_gate()
        tracker.complete_phase("abr", MigrationPhase.ANALYSIS)

        pp = tracker.platforms["abr"].phases["analysis"]
        assert pp.status == PhaseStatus.COMPLETED
        assert pp.progress_pct == 100.0

    def test_complete_phase_with_unmet_gates(self, tmp_path):
        """Completing a phase with unmet gates should still complete but warn."""
        tracker = ProgressTracker(checkpoint_dir=tmp_path)
        tracker.init_platform("abr", "ABR Insights")
        tracker.start_phase("abr", MigrationPhase.ANALYSIS)
        tracker.complete_phase("abr", MigrationPhase.ANALYSIS)

        pp = tracker.platforms["abr"].phases["analysis"]
        assert pp.status == PhaseStatus.COMPLETED

    def test_block_phase(self, tmp_path):
        tracker = ProgressTracker(checkpoint_dir=tmp_path)
        tracker.init_platform("abr", "ABR Insights")
        tracker.block_phase("abr", MigrationPhase.ANALYSIS, "Waiting for access")

        pp = tracker.platforms["abr"].phases["analysis"]
        assert pp.status == PhaseStatus.BLOCKED
        assert "Waiting for access" in pp.blockers

    def test_fail_phase(self, tmp_path):
        tracker = ProgressTracker(checkpoint_dir=tmp_path)
        tracker.init_platform("abr", "ABR Insights")
        tracker.fail_phase("abr", MigrationPhase.ANALYSIS, "Network error")

        pp = tracker.platforms["abr"].phases["analysis"]
        assert pp.status == PhaseStatus.FAILED

    def test_pass_gate(self, tmp_path):
        tracker = ProgressTracker(checkpoint_dir=tmp_path)
        tracker.init_platform("abr", "ABR Insights")
        tracker.pass_gate(
            "abr", MigrationPhase.ANALYSIS, "schema_report_exists", "Report found"
        )

        gate = next(
            g
            for g in tracker.platforms["abr"].phases["analysis"].quality_gates
            if g.name == "schema_report_exists"
        )
        assert gate.status == QualityGateStatus.PASSED

    def test_fail_gate(self, tmp_path):
        tracker = ProgressTracker(checkpoint_dir=tmp_path)
        tracker.init_platform("abr", "ABR Insights")
        tracker.fail_gate(
            "abr", MigrationPhase.ANALYSIS, "schema_report_exists", "File missing"
        )

        gate = next(
            g
            for g in tracker.platforms["abr"].phases["analysis"].quality_gates
            if g.name == "schema_report_exists"
        )
        assert gate.status == QualityGateStatus.FAILED

    def test_waive_gate(self, tmp_path):
        tracker = ProgressTracker(checkpoint_dir=tmp_path)
        tracker.init_platform("abr", "ABR Insights")
        tracker.waive_gate(
            "abr",
            MigrationPhase.ANALYSIS,
            "schema_report_exists",
            "Not needed for this phase",
        )

        gate = next(
            g
            for g in tracker.platforms["abr"].phases["analysis"].quality_gates
            if g.name == "schema_report_exists"
        )
        assert gate.status == QualityGateStatus.WAIVED

    def test_get_overall_progress(self, tmp_path):
        tracker = ProgressTracker(checkpoint_dir=tmp_path)
        tracker.init_platform("abr", "ABR Insights")
        progress = tracker.get_overall_progress("abr")
        assert progress == 0.0

    def test_get_overall_progress_unknown(self, tmp_path):
        tracker = ProgressTracker(checkpoint_dir=tmp_path)
        assert tracker.get_overall_progress("unknown") == 0.0

    def test_get_current_phase(self, tmp_path):
        tracker = ProgressTracker(checkpoint_dir=tmp_path)
        tracker.init_platform("abr", "ABR Insights")
        assert tracker.get_current_phase("abr") is None

        tracker.start_phase("abr", MigrationPhase.ANALYSIS)
        assert tracker.get_current_phase("abr") == "analysis"

    def test_get_current_phase_unknown(self, tmp_path):
        tracker = ProgressTracker(checkpoint_dir=tmp_path)
        assert tracker.get_current_phase("unknown") is None

    def test_get_blockers(self, tmp_path):
        tracker = ProgressTracker(checkpoint_dir=tmp_path)
        tracker.init_platform("abr", "ABR Insights")
        tracker.block_phase("abr", MigrationPhase.ANALYSIS, "Blocked!")

        blockers = tracker.get_blockers("abr")
        assert len(blockers) == 1
        assert blockers[0]["phase"] == "analysis"
        assert blockers[0]["blocker"] == "Blocked!"

    def test_get_blockers_unknown(self, tmp_path):
        tracker = ProgressTracker(checkpoint_dir=tmp_path)
        assert tracker.get_blockers("unknown") == []

    def test_get_failed_gates(self, tmp_path):
        tracker = ProgressTracker(checkpoint_dir=tmp_path)
        tracker.init_platform("abr", "ABR Insights")
        tracker.fail_gate(
            "abr", MigrationPhase.ANALYSIS, "schema_report_exists", "Missing"
        )

        failed = tracker.get_failed_gates("abr")
        assert len(failed) == 1
        assert failed[0]["gate"] == "schema_report_exists"

    def test_get_failed_gates_unknown(self, tmp_path):
        tracker = ProgressTracker(checkpoint_dir=tmp_path)
        assert tracker.get_failed_gates("unknown") == []

    def test_invalid_platform_raises(self, tmp_path):
        tracker = ProgressTracker(checkpoint_dir=tmp_path)
        with pytest.raises(ValueError, match="not initialized"):
            tracker.start_phase("nonexistent", MigrationPhase.ANALYSIS)

    def test_invalid_gate_raises(self, tmp_path):
        tracker = ProgressTracker(checkpoint_dir=tmp_path)
        tracker.init_platform("abr", "ABR Insights")
        with pytest.raises(ValueError, match="not found"):
            tracker.pass_gate("abr", MigrationPhase.ANALYSIS, "nonexistent_gate")


# ──────────────────────────────────────────
# Persistence
# ──────────────────────────────────────────


@pytest.mark.unit
class TestProgressTrackerPersistence:
    """Test save/load checkpoint cycle."""

    def test_save_creates_file(self, tmp_path):
        tracker = ProgressTracker(checkpoint_dir=tmp_path)
        tracker.init_platform("abr", "ABR Insights")
        # save() is called inside init_platform, check file exists
        assert (tmp_path / "abr_progress.json").exists()

    def test_load_checkpoint(self, tmp_path):
        # Save
        tracker1 = ProgressTracker(checkpoint_dir=tmp_path)
        tracker1.init_platform("abr", "ABR Insights")
        tracker1.start_phase("abr", MigrationPhase.ANALYSIS)
        tracker1.update_phase("abr", MigrationPhase.ANALYSIS, 2, 5)
        tracker1.pass_gate("abr", MigrationPhase.ANALYSIS, "schema_report_exists")
        tracker1.save()

        # Reload
        tracker2 = ProgressTracker(checkpoint_dir=tmp_path)
        assert "abr" in tracker2.platforms
        pp = tracker2.platforms["abr"].phases["analysis"]
        assert pp.status == PhaseStatus.IN_PROGRESS
        assert pp.tasks_completed == 2

    def test_roundtrip_all_statuses(self, tmp_path):
        """Test that all phase statuses survive serialization."""
        tracker = ProgressTracker(checkpoint_dir=tmp_path)
        tracker.init_platform(
            "test",
            "Test",
            phases=[
                MigrationPhase.ANALYSIS,
                MigrationPhase.TESTING,
                MigrationPhase.DEPLOYMENT,
            ],
        )
        tracker.start_phase("test", MigrationPhase.ANALYSIS)
        # Pass gates for analysis
        for gate in tracker.platforms["test"].phases["analysis"].quality_gates:
            gate.pass_gate()
        tracker.complete_phase("test", MigrationPhase.ANALYSIS)
        tracker.block_phase("test", MigrationPhase.TESTING, "Need DB")
        tracker.fail_phase("test", MigrationPhase.DEPLOYMENT, "Docker failed")
        tracker.save()

        tracker2 = ProgressTracker(checkpoint_dir=tmp_path)
        assert (
            tracker2.platforms["test"].phases["analysis"].status
            == PhaseStatus.COMPLETED
        )
        assert (
            tracker2.platforms["test"].phases["testing"].status == PhaseStatus.BLOCKED
        )
        assert (
            tracker2.platforms["test"].phases["deployment"].status == PhaseStatus.FAILED
        )

    def test_corrupt_checkpoint_skipped(self, tmp_path):
        """Test that corrupt JSON is gracefully skipped."""
        (tmp_path / "bad_progress.json").write_text("{invalid json")
        tracker = ProgressTracker(checkpoint_dir=tmp_path)
        assert "bad" not in tracker.platforms


# ──────────────────────────────────────────
# Dashboard / Report
# ──────────────────────────────────────────


@pytest.mark.unit
class TestProgressTrackerDashboard:
    """Test dashboard generation."""

    def test_generate_dashboard(self, tmp_path):
        tracker = ProgressTracker(checkpoint_dir=tmp_path)
        tracker.init_platform("abr", "ABR Insights")
        tracker.start_phase("abr", MigrationPhase.ANALYSIS)

        md = tracker.generate_dashboard()
        assert "Migration Progress Dashboard" in md
        assert "ABR Insights" in md
        assert "analysis" in md

    def test_generate_dashboard_specific_platform(self, tmp_path):
        tracker = ProgressTracker(checkpoint_dir=tmp_path)
        tracker.init_platform("abr", "ABR Insights")
        tracker.init_platform("ue", "UnionEyes")

        md = tracker.generate_dashboard(platform_id="abr")
        assert "ABR Insights" in md

    def test_generate_dashboard_with_blockers(self, tmp_path):
        tracker = ProgressTracker(checkpoint_dir=tmp_path)
        tracker.init_platform("abr", "ABR Insights")
        tracker.block_phase("abr", MigrationPhase.ANALYSIS, "Need credentials")

        md = tracker.generate_dashboard()
        assert "Blockers" in md
        assert "Need credentials" in md

    def test_generate_dashboard_with_failed_gates(self, tmp_path):
        tracker = ProgressTracker(checkpoint_dir=tmp_path)
        tracker.init_platform("abr", "ABR Insights")
        tracker.fail_gate(
            "abr", MigrationPhase.ANALYSIS, "schema_report_exists", "Not found"
        )

        md = tracker.generate_dashboard()
        assert "Failed Quality Gates" in md

    def test_write_dashboard(self, tmp_path):
        tracker = ProgressTracker(checkpoint_dir=tmp_path)
        tracker.init_platform("abr", "ABR Insights")

        output = tmp_path / "reports" / "dashboard.md"
        tracker.write_dashboard(output)

        assert output.exists()
        content = output.read_text()
        assert "ABR Insights" in content


# ──────────────────────────────────────────
# Integration
# ──────────────────────────────────────────


@pytest.mark.integration
class TestProgressTrackerIntegration:
    """Integration tests for full progress lifecycle."""

    def test_full_lifecycle(self, tmp_path):
        """Test complete phase lifecycle: init → start → update → gate → complete."""
        tracker = ProgressTracker(checkpoint_dir=tmp_path)
        tracker.init_platform("abr", "ABR Insights", phases=[MigrationPhase.ANALYSIS])

        # Start
        tracker.start_phase("abr", MigrationPhase.ANALYSIS)
        assert tracker.get_current_phase("abr") == "analysis"

        # Update progress
        tracker.update_phase("abr", MigrationPhase.ANALYSIS, 1, 2)
        assert tracker.get_overall_progress("abr") == 50.0

        # Pass gates
        tracker.pass_gate("abr", MigrationPhase.ANALYSIS, "schema_report_exists")
        tracker.pass_gate("abr", MigrationPhase.ANALYSIS, "tech_stack_identified")

        # Complete
        tracker.complete_phase("abr", MigrationPhase.ANALYSIS)
        assert tracker.get_overall_progress("abr") == 100.0
        assert tracker.get_current_phase("abr") is None

    def test_multi_platform(self, tmp_path):
        """Test tracking multiple platforms simultaneously."""
        tracker = ProgressTracker(checkpoint_dir=tmp_path)
        tracker.init_platform("abr", "ABR Insights")
        tracker.init_platform("ue", "UnionEyes")

        tracker.start_phase("abr", MigrationPhase.ANALYSIS)
        tracker.start_phase("ue", MigrationPhase.SCHEMA_EXTRACTION)

        assert tracker.get_current_phase("abr") == "analysis"
        assert tracker.get_current_phase("ue") == "schema_extraction"

        # Verify separate checkpoint files
        assert (tmp_path / "abr_progress.json").exists()
        assert (tmp_path / "ue_progress.json").exists()


@pytest.mark.unit
class TestProgressTrackerExtended:
    """Extended tests for full coverage of progress_tracker."""

    # ── auto_detect_progress ────────────────────────────────────────────

    def test_auto_detect_schema_report(self, tmp_path):
        """auto_detect_progress marks analysis gate when schema report exists."""
        tracker = ProgressTracker(checkpoint_dir=tmp_path / "progress")
        tracker.init_platform("abr", "ABR Insights")

        workspace = tmp_path / "ws"
        data_dir = workspace / "automation" / "data"
        data_dir.mkdir(parents=True)
        (data_dir / "SCHEMA_EXTRACTION_REPORT.md").write_text("# Schema Report")

        tracker.auto_detect_progress("abr", workspace)
        gate = next(
            g
            for g in tracker.platforms["abr"].phases["analysis"].quality_gates
            if g.name == "schema_report_exists"
        )
        assert gate.status == QualityGateStatus.PASSED

    def test_auto_detect_generated_models(self, tmp_path):
        """auto_detect_progress passes code generation gate when models exist."""
        tracker = ProgressTracker(checkpoint_dir=tmp_path / "progress")
        tracker.init_platform("abr", "ABR Insights")

        workspace = tmp_path / "ws"
        gen_dir = workspace / "automation" / "data" / "generated" / "abr"
        gen_dir.mkdir(parents=True)
        (gen_dir / "models.py").write_text("class Foo: pass")

        tracker.auto_detect_progress("abr", workspace)
        gate = next(
            g
            for g in tracker.platforms["abr"].phases["code_generation"].quality_gates
            if g.name == "models_generated"
        )
        assert gate.status == QualityGateStatus.PASSED

    def test_auto_detect_dependency_report(self, tmp_path):
        """auto_detect_progress passes dep mapping gate when report exists."""
        tracker = ProgressTracker(checkpoint_dir=tmp_path / "progress")
        tracker.init_platform("abr", "ABR Insights")

        workspace = tmp_path / "ws"
        data_dir = workspace / "automation" / "data"
        data_dir.mkdir(parents=True)
        (data_dir / "abr-dependency-report.json").write_text("{}")

        tracker.auto_detect_progress("abr", workspace)
        gate = next(
            g
            for g in tracker.platforms["abr"].phases["dependency_mapping"].quality_gates
            if g.name == "deps_classified"
        )
        assert gate.status == QualityGateStatus.PASSED

    # ── init_tracking ───────────────────────────────────────────────────

    def test_init_tracking(self, tmp_path):
        """init_tracking initializes both platforms and writes a dashboard."""
        from progress_tracker import init_tracking

        workspace = tmp_path / "ws"
        workspace.mkdir()

        tracker = init_tracking(workspace)
        assert "abr" in tracker.platforms
        assert "ue" in tracker.platforms
        dashboard = workspace / "automation" / "data" / "MIGRATION_DASHBOARD.md"
        assert dashboard.exists()

    # ── main() CLI ──────────────────────────────────────────────────────

    def test_main_dashboard(self, tmp_path):
        from progress_tracker import main

        workspace = tmp_path / "ws"
        workspace.mkdir()

        with patch("sys.argv", ["prog", "--workspace", str(workspace), "--dashboard"]):
            main()

    def test_main_no_dashboard(self, tmp_path):
        from progress_tracker import main

        workspace = tmp_path / "ws"
        workspace.mkdir()

        with patch("sys.argv", ["prog", "--workspace", str(workspace)]):
            main()

    def test_main_specific_platform(self, tmp_path):
        from progress_tracker import main

        workspace = tmp_path / "ws"
        workspace.mkdir()

        with patch(
            "sys.argv",
            ["prog", "--workspace", str(workspace), "--dashboard", "--platform", "abr"],
        ):
            main()

    # ── Coverage for line 508: _get_phase with non-existent phase ────

    def test_get_phase_not_found(self, tmp_path):
        """_get_phase raises ValueError when phase doesn't exist for platform."""
        tracker = ProgressTracker(checkpoint_dir=tmp_path)
        tracker.init_platform("plat-a", "Platform A")
        # Remove a phase from the internal dict to force the error
        del tracker.platforms["plat-a"].phases[MigrationPhase.ANALYSIS.value]
        with pytest.raises(ValueError, match="Phase.*not found"):
            tracker._get_phase("plat-a", MigrationPhase.ANALYSIS)
