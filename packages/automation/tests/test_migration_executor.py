"""
Unit tests for migration_executor.py
"""

import json
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock, Mock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "generators"))

from migration_executor import (
    MigrationCheckpoint,
    MigrationExecutor,
    MigrationPhase,
    MigrationResult,
)


@pytest.mark.unit
@pytest.mark.executor
class TestMigrationExecutor:
    """Test MigrationExecutor class"""

    def test_initialization(self, temp_dir):
        """Test executor initialization"""
        executor = MigrationExecutor(
            template_dir=temp_dir / "template",
            output_dir=temp_dir / "output",
            checkpoint_dir=temp_dir / "checkpoints",
        )

        assert executor.template_dir == temp_dir / "template"
        assert executor.output_dir == temp_dir / "output"
        assert executor.checkpoint_dir == temp_dir / "checkpoints"
        assert executor.dry_run is False

        # Directories should be created
        assert executor.output_dir.exists()
        assert executor.checkpoint_dir.exists()

    def test_create_checkpoint(self, temp_dir, mock_manifest):
        """Test checkpoint creation"""
        manifest_path = temp_dir / "manifest.json"
        with open(manifest_path, "w") as f:
            json.dump(mock_manifest, f)

        executor = MigrationExecutor(
            template_dir=temp_dir,
            output_dir=temp_dir / "output",
            checkpoint_dir=temp_dir / "checkpoints",
        )

        checkpoint = executor._create_checkpoint("test-platform", manifest_path)

        assert checkpoint.platform_id == "test-platform"
        assert checkpoint.platform_name == "Mock Platform"
        assert checkpoint.phase == MigrationPhase.NOT_STARTED.value
        assert len(checkpoint.completed_phases) == 0
        assert len(checkpoint.failed_phases) == 0

    def test_save_and_load_checkpoint(self, temp_dir):
        """Test checkpoint persistence"""
        executor = MigrationExecutor(
            template_dir=temp_dir,
            output_dir=temp_dir / "output",
            checkpoint_dir=temp_dir / "checkpoints",
        )

        checkpoint = MigrationCheckpoint(
            platform_id="test-platform",
            platform_name="Test Platform",
            phase=MigrationPhase.ANALYSIS.value,
            started_at=datetime.now().isoformat(),
            last_updated=datetime.now().isoformat(),
            completed_phases=[],
            failed_phases=[],
        )

        # Save checkpoint
        executor._save_checkpoint(checkpoint)

        # Load checkpoint
        loaded = executor._load_checkpoint("test-platform")

        assert loaded is not None
        assert loaded.platform_id == "test-platform"
        assert loaded.phase == MigrationPhase.ANALYSIS.value

    def test_phase_analysis_success(self, temp_dir, mock_manifest):
        """Test successful analysis phase"""
        manifest_path = temp_dir / "manifest.json"
        with open(manifest_path, "w") as f:
            json.dump(mock_manifest, f)

        executor = MigrationExecutor(
            template_dir=temp_dir,
            output_dir=temp_dir / "output",
            checkpoint_dir=temp_dir / "checkpoints",
        )

        checkpoint = executor._create_checkpoint("test-platform", manifest_path)
        result = executor._phase_analysis("test-platform", manifest_path, checkpoint)

        assert "manifest" in result
        assert checkpoint.metadata["manifest_validated"] is True
        assert checkpoint.metadata["profile"] == "nextjs-app-router"

    def test_phase_analysis_missing_manifest(self, temp_dir):
        """Test analysis phase with missing manifest"""
        executor = MigrationExecutor(
            template_dir=temp_dir,
            output_dir=temp_dir / "output",
            checkpoint_dir=temp_dir / "checkpoints",
        )

        manifest_path = temp_dir / "nonexistent.json"
        checkpoint = MigrationCheckpoint(
            platform_id="test",
            platform_name="Test",
            phase=MigrationPhase.NOT_STARTED.value,
            started_at=datetime.now().isoformat(),
            last_updated=datetime.now().isoformat(),
            completed_phases=[],
            failed_phases=[],
        )

        with pytest.raises(FileNotFoundError):
            executor._phase_analysis("test", manifest_path, checkpoint)

    def test_phase_analysis_invalid_manifest(self, temp_dir):
        """Test analysis phase with invalid manifest"""
        manifest_path = temp_dir / "invalid.json"
        with open(manifest_path, "w") as f:
            json.dump({"invalid": "manifest"}, f)  # Missing required fields

        executor = MigrationExecutor(
            template_dir=temp_dir,
            output_dir=temp_dir / "output",
            checkpoint_dir=temp_dir / "checkpoints",
        )

        checkpoint = executor._create_checkpoint("test", manifest_path)

        with pytest.raises(ValueError):
            executor._phase_analysis("test", manifest_path, checkpoint)

    def test_dry_run_mode(self, temp_dir, mock_manifest):
        """Test dry run mode"""
        manifest_path = temp_dir / "manifest.json"
        with open(manifest_path, "w") as f:
            json.dump(mock_manifest, f)

        executor = MigrationExecutor(
            template_dir=temp_dir,
            output_dir=temp_dir / "output",
            checkpoint_dir=temp_dir / "checkpoints",
            dry_run=True,
        )

        checkpoint = executor._create_checkpoint("test-platform", manifest_path)

        # All phases should succeed without actual execution
        result = executor._phase_apply_template("test", manifest_path, checkpoint)
        assert result == {}  # Dry run returns empty dict

        result = executor._phase_generate_code("test", manifest_path, checkpoint)
        assert result == {}

        result = executor._phase_provision_infrastructure(
            "test", manifest_path, checkpoint
        )
        assert result == {}

    def test_get_next_phase(self, temp_dir):
        """Test determining next phase from checkpoint"""
        executor = MigrationExecutor(
            template_dir=temp_dir,
            output_dir=temp_dir / "output",
            checkpoint_dir=temp_dir / "checkpoints",
        )

        checkpoint = MigrationCheckpoint(
            platform_id="test",
            platform_name="Test",
            phase=MigrationPhase.TEMPLATE_APPLIED.value,
            started_at=datetime.now().isoformat(),
            last_updated=datetime.now().isoformat(),
            completed_phases=[
                MigrationPhase.ANALYSIS.value,
                MigrationPhase.TEMPLATE_APPLIED.value,
            ],
            failed_phases=[],
        )

        next_phase = executor._get_next_phase(checkpoint)
        assert next_phase == MigrationPhase.CODE_GENERATED

    def test_execute_phase_with_retry_success(self, temp_dir, mock_manifest):
        """Test phase execution with retry on success"""
        manifest_path = temp_dir / "manifest.json"
        with open(manifest_path, "w") as f:
            json.dump(mock_manifest, f)

        executor = MigrationExecutor(
            template_dir=temp_dir,
            output_dir=temp_dir / "output",
            checkpoint_dir=temp_dir / "checkpoints",
        )

        checkpoint = executor._create_checkpoint("test", manifest_path)

        # Mock phase function that succeeds
        def mock_phase_func(platform_id, manifest_path, checkpoint):
            return {"data": "success"}

        result = executor._execute_phase_with_retry(
            mock_phase_func, "test", manifest_path, checkpoint
        )

        assert result["success"] is True
        assert result["data"] == "success"

    def test_execute_phase_with_retry_failure(self, temp_dir, mock_manifest):
        """Test phase execution with retry on failure"""
        manifest_path = temp_dir / "manifest.json"
        with open(manifest_path, "w") as f:
            json.dump(mock_manifest, f)

        executor = MigrationExecutor(
            template_dir=temp_dir,
            output_dir=temp_dir / "output",
            checkpoint_dir=temp_dir / "checkpoints",
        )
        executor.MAX_RETRIES = 2  # Reduce retries for faster test
        executor.RETRY_DELAY = 0.1  # Reduce delay for faster test

        checkpoint = executor._create_checkpoint("test", manifest_path)

        # Mock phase function that always fails
        def mock_phase_func(platform_id, manifest_path, checkpoint):
            raise Exception("Simulated failure")

        result = executor._execute_phase_with_retry(
            mock_phase_func, "test", manifest_path, checkpoint
        )

        assert result["success"] is False
        assert "error" in result
        assert (
            checkpoint.retry_count == 1
        )  # retry_count tracks retries performed, not total failures

    def test_execute_migration_success(self, temp_dir, mock_manifest):
        """Test successful migration execution"""
        manifest_path = temp_dir / "manifest.json"
        with open(manifest_path, "w") as f:
            json.dump(mock_manifest, f)

        executor = MigrationExecutor(
            template_dir=temp_dir,
            output_dir=temp_dir / "output",
            checkpoint_dir=temp_dir / "checkpoints",
            dry_run=True,  # Use dry run to skip actual execution
        )

        result = executor.execute_migration("test-platform", manifest_path)

        assert result.success is True
        assert result.platform_id == "test-platform"
        assert result.phase_reached == MigrationPhase.COMPLETED.value
        assert result.duration_seconds > 0
        assert len(result.errors) == 0

    def test_execute_migration_with_failure(self, temp_dir, mock_manifest):
        """Test migration execution with failure"""
        manifest_path = temp_dir / "manifest.json"
        with open(manifest_path, "w") as f:
            json.dump({"name": "Test"}, f)  # Invalid, missing required fields

        executor = MigrationExecutor(
            template_dir=temp_dir,
            output_dir=temp_dir / "output",
            checkpoint_dir=temp_dir / "checkpoints",
        )

        result = executor.execute_migration("test-platform", manifest_path)

        assert result.success is False
        assert result.phase_reached == MigrationPhase.ANALYSIS.value
        assert len(result.errors) > 0

    def test_resume_migration(self, temp_dir, mock_manifest):
        """Test resuming migration from checkpoint"""
        manifest_path = temp_dir / "manifest.json"
        with open(manifest_path, "w") as f:
            json.dump(mock_manifest, f)

        executor = MigrationExecutor(
            template_dir=temp_dir,
            output_dir=temp_dir / "output",
            checkpoint_dir=temp_dir / "checkpoints",
            dry_run=True,
        )

        # Create checkpoint at TEMPLATE_APPLIED phase
        checkpoint = MigrationCheckpoint(
            platform_id="test-platform",
            platform_name="Test Platform",
            phase=MigrationPhase.TEMPLATE_APPLIED.value,
            started_at=datetime.now().isoformat(),
            last_updated=datetime.now().isoformat(),
            completed_phases=[
                MigrationPhase.ANALYSIS.value,
                MigrationPhase.TEMPLATE_APPLIED.value,
            ],
            failed_phases=[],
        )
        executor._save_checkpoint(checkpoint)

        # Resume migration
        result = executor.execute_migration("test-platform", manifest_path, resume=True)

        assert result.success is True
        # Should have skipped completed phases
        assert MigrationPhase.ANALYSIS.value in result.checkpoint.completed_phases

    def test_rollback_migration(self, temp_dir, mock_manifest):
        """Test rolling back failed migration"""
        manifest_path = temp_dir / "manifest.json"
        with open(manifest_path, "w") as f:
            json.dump(mock_manifest, f)

        executor = MigrationExecutor(
            template_dir=temp_dir,
            output_dir=temp_dir / "output",
            checkpoint_dir=temp_dir / "checkpoints",
            dry_run=True,
        )

        # Execute migration
        result = executor.execute_migration("test-platform", manifest_path)

        # Create some output files
        platform_output = executor.output_dir / "test-platform"
        platform_output.mkdir(parents=True, exist_ok=True)
        (platform_output / "file.txt").write_text("test")

        # Rollback
        success = executor.rollback_migration("test-platform")

        assert success is True
        assert not platform_output.exists()  # Output should be deleted

        # Checkpoint should reflect rollback
        checkpoint = executor._load_checkpoint("test-platform")
        assert checkpoint.phase == MigrationPhase.ROLLED_BACK.value

    def test_get_migration_status(self, temp_dir, mock_manifest):
        """Test getting migration status"""
        manifest_path = temp_dir / "manifest.json"
        with open(manifest_path, "w") as f:
            json.dump(mock_manifest, f)

        executor = MigrationExecutor(
            template_dir=temp_dir,
            output_dir=temp_dir / "output",
            checkpoint_dir=temp_dir / "checkpoints",
            dry_run=True,
        )

        # Execute migration
        executor.execute_migration("test-platform", manifest_path)

        # Get status
        status = executor.get_migration_status("test-platform")

        assert status is not None
        assert status["platform_id"] == "test-platform"
        assert status["phase"] == MigrationPhase.COMPLETED.value
        assert len(status["completed_phases"]) > 0

    def test_checkpoint_metadata_persistence(self, temp_dir, mock_manifest):
        """Test checkpoint metadata is preserved"""
        manifest_path = temp_dir / "manifest.json"
        with open(manifest_path, "w") as f:
            json.dump(mock_manifest, f)

        executor = MigrationExecutor(
            template_dir=temp_dir,
            output_dir=temp_dir / "output",
            checkpoint_dir=temp_dir / "checkpoints",
            dry_run=True,
        )

        # Execute migration
        executor.execute_migration("test-platform", manifest_path)

        # Load checkpoint
        checkpoint = executor._load_checkpoint("test-platform")

        # Verify metadata from analysis phase
        assert checkpoint.metadata["manifest_validated"] is True
        assert checkpoint.metadata["profile"] == "nextjs-app-router"
        assert checkpoint.metadata["modules_count"] == 3


@pytest.mark.integration
@pytest.mark.executor
class TestMigrationExecutorIntegration:
    """Integration tests for Migration Executor"""

    def test_full_migration_workflow(self, temp_dir, mock_manifest):
        """Test complete migration workflow"""
        # Setup
        manifest_path = temp_dir / "manifest.json"
        with open(manifest_path, "w") as f:
            json.dump(mock_manifest, f)

        template_dir = temp_dir / "template"
        template_dir.mkdir()

        executor = MigrationExecutor(
            template_dir=template_dir,
            output_dir=temp_dir / "output",
            checkpoint_dir=temp_dir / "checkpoints",
            dry_run=True,  # Dry run for integration test
        )

        # Execute migration
        result = executor.execute_migration("integration-platform", manifest_path)

        # Verify result
        assert result.success is True
        assert result.phase_reached == MigrationPhase.COMPLETED.value

        # Verify checkpoint exists
        status = executor.get_migration_status("integration-platform")
        assert status is not None
        assert status["phase"] == MigrationPhase.COMPLETED.value

        # Verify all phases completed
        expected_phases = [
            MigrationPhase.ANALYSIS.value,
            MigrationPhase.TEMPLATE_APPLIED.value,
            MigrationPhase.CODE_GENERATED.value,
            MigrationPhase.INFRASTRUCTURE_PROVISIONED.value,
            MigrationPhase.DATABASE_MIGRATED.value,
            MigrationPhase.TESTED.value,
        ]

        for phase in expected_phases:
            assert phase in status["completed_phases"]

    def test_failure_and_retry_workflow(self, temp_dir, mock_manifest):
        """Test failure recovery and retry workflow"""
        manifest_path = temp_dir / "manifest.json"
        with open(manifest_path, "w") as f:
            json.dump(mock_manifest, f)

        executor = MigrationExecutor(
            template_dir=temp_dir / "template",
            output_dir=temp_dir / "output",
            checkpoint_dir=temp_dir / "checkpoints",
            dry_run=True,
        )

        # Execute first migration (success)
        result1 = executor.execute_migration("retry-platform", manifest_path)
        assert result1.success is True

        # Simulate partial failure by creating checkpoint at intermediate phase
        checkpoint = MigrationCheckpoint(
            platform_id="retry-platform-2",
            platform_name="Retry Platform 2",
            phase=MigrationPhase.CODE_GENERATED.value,
            started_at=datetime.now().isoformat(),
            last_updated=datetime.now().isoformat(),
            completed_phases=[
                MigrationPhase.ANALYSIS.value,
                MigrationPhase.TEMPLATE_APPLIED.value,
                MigrationPhase.CODE_GENERATED.value,
            ],
            failed_phases=[],
        )
        executor._save_checkpoint(checkpoint)

        # Resume from checkpoint
        result2 = executor.execute_migration(
            "retry-platform-2", manifest_path, resume=True
        )
        assert result2.success is True

        # Should have skipped completed phases
        assert MigrationPhase.ANALYSIS.value in result2.checkpoint.completed_phases


@pytest.mark.unit
@pytest.mark.executor
class TestMigrationExecutorExtended:
    """Extended tests for full coverage of migration_executor."""

    # ── _phase_apply_template (non-dry-run) ─────────────────────────────

    def test_apply_template_subprocess_success(self, temp_dir, mock_manifest):
        """Non-dry-run template application via subprocess."""
        manifest_path = temp_dir / "manifest.json"
        with open(manifest_path, "w") as f:
            json.dump(mock_manifest, f)

        template_dir = temp_dir / "template"
        template_dir.mkdir()

        executor = MigrationExecutor(
            template_dir=template_dir,
            output_dir=temp_dir / "output",
            checkpoint_dir=temp_dir / "checkpoints",
            dry_run=False,
        )

        checkpoint = MigrationCheckpoint(
            platform_id="p1",
            platform_name="P1",
            phase="analysis",
            started_at="",
            last_updated="",
            completed_phases=[],
            failed_phases=[],
        )

        with patch("migration_executor.subprocess") as mock_sub:
            mock_sub.run.return_value = Mock(returncode=0, stdout="ok")
            mock_sub.CalledProcessError = subprocess.CalledProcessError
            mock_sub.TimeoutExpired = subprocess.TimeoutExpired
            result = executor._phase_apply_template("p1", manifest_path, checkpoint)
            assert result["output"] == "ok"
            assert checkpoint.metadata["template_applied"] is True

    def test_apply_template_subprocess_failure(self, temp_dir, mock_manifest):
        """Non-dry-run template application raises on subprocess error."""
        import subprocess as _sp

        manifest_path = temp_dir / "manifest.json"
        with open(manifest_path, "w") as f:
            json.dump(mock_manifest, f)

        template_dir = temp_dir / "template"
        template_dir.mkdir()

        executor = MigrationExecutor(
            template_dir=template_dir,
            output_dir=temp_dir / "output",
            checkpoint_dir=temp_dir / "checkpoints",
            dry_run=False,
        )

        checkpoint = MigrationCheckpoint(
            platform_id="p1",
            platform_name="P1",
            phase="analysis",
            started_at="",
            last_updated="",
            completed_phases=[],
            failed_phases=[],
        )

        with patch("migration_executor.subprocess") as mock_sub:
            mock_sub.run.return_value = Mock(
                returncode=1, stdout="", stderr="fail", args=["pnpm"]
            )
            mock_sub.CalledProcessError = _sp.CalledProcessError
            mock_sub.TimeoutExpired = _sp.TimeoutExpired
            with pytest.raises(_sp.CalledProcessError):
                executor._phase_apply_template("p1", manifest_path, checkpoint)

    def test_apply_template_timeout(self, temp_dir, mock_manifest):
        """Template application raises TimeoutError on subprocess timeout."""
        import subprocess as _sp

        manifest_path = temp_dir / "manifest.json"
        with open(manifest_path, "w") as f:
            json.dump(mock_manifest, f)

        template_dir = temp_dir / "template"
        template_dir.mkdir()

        executor = MigrationExecutor(
            template_dir=template_dir,
            output_dir=temp_dir / "output",
            checkpoint_dir=temp_dir / "checkpoints",
            dry_run=False,
        )

        checkpoint = MigrationCheckpoint(
            platform_id="p1",
            platform_name="P1",
            phase="analysis",
            started_at="",
            last_updated="",
            completed_phases=[],
            failed_phases=[],
        )

        with patch("migration_executor.subprocess") as mock_sub:
            mock_sub.run.side_effect = _sp.TimeoutExpired("pnpm", 300)
            mock_sub.TimeoutExpired = _sp.TimeoutExpired
            mock_sub.CalledProcessError = _sp.CalledProcessError
            with pytest.raises(TimeoutError, match="timed out"):
                executor._phase_apply_template("p1", manifest_path, checkpoint)

    def test_apply_template_fallback_manual(self, temp_dir, mock_manifest):
        """FileNotFoundError triggers manual copy fallback."""
        manifest_path = temp_dir / "manifest.json"
        with open(manifest_path, "w") as f:
            json.dump(mock_manifest, f)

        template_dir = temp_dir / "template"
        template_dir.mkdir()
        # Create profile and module dirs for copying
        profile_dir = (
            template_dir / "profiles" / mock_manifest.get("profile", "nextjs-saas")
        )
        profile_dir.mkdir(parents=True)
        (profile_dir / "base.ts").write_text("export default {}")

        executor = MigrationExecutor(
            template_dir=template_dir,
            output_dir=temp_dir / "output",
            checkpoint_dir=temp_dir / "checkpoints",
            dry_run=False,
        )

        checkpoint = MigrationCheckpoint(
            platform_id="p1",
            platform_name="P1",
            phase="analysis",
            started_at="",
            last_updated="",
            completed_phases=[],
            failed_phases=[],
        )

        with patch("migration_executor.subprocess") as mock_sub:
            mock_sub.run.side_effect = FileNotFoundError("pnpm not found")
            mock_sub.TimeoutExpired = subprocess.TimeoutExpired
            mock_sub.CalledProcessError = subprocess.CalledProcessError
            result = executor._phase_apply_template("p1", manifest_path, checkpoint)
            assert "Manual template copy" in result["output"]

    # ── _copy_template_manually ─────────────────────────────────────────

    def test_copy_template_manually_with_modules(self, temp_dir):
        """Manual template copy includes module directories."""
        manifest = {
            "profile": "django-monolith",
            "modules": [{"name": "auth"}, "billing"],
        }
        manifest_path = temp_dir / "manifest.json"
        with open(manifest_path, "w") as f:
            json.dump(manifest, f)

        template_dir = temp_dir / "template"
        profile_dir = template_dir / "profiles" / "django-monolith"
        profile_dir.mkdir(parents=True)
        (profile_dir / "settings.py").write_text("INSTALLED_APPS = []")

        auth_mod = template_dir / "modules" / "auth"
        auth_mod.mkdir(parents=True)
        (auth_mod / "views.py").write_text("# auth views")

        output_dir = temp_dir / "output"
        output_dir.mkdir()

        executor = MigrationExecutor(
            template_dir=template_dir,
            output_dir=output_dir,
            checkpoint_dir=temp_dir / "checkpoints",
        )
        executor._copy_template_manually(manifest_path, output_dir)

        assert (output_dir / "settings.py").exists()
        assert (output_dir / "views.py").exists()

    # ── Non-dry-run code generation et al. ──────────────────────────────

    def test_phase_generate_code_non_dry(self, temp_dir, mock_manifest):
        """Code generation succeeds in non-dry-run mode."""
        manifest_path = temp_dir / "manifest.json"
        with open(manifest_path, "w") as f:
            json.dump(mock_manifest, f)

        executor = MigrationExecutor(
            template_dir=temp_dir,
            output_dir=temp_dir / "output",
            checkpoint_dir=temp_dir / "checkpoints",
            dry_run=False,
        )
        checkpoint = MigrationCheckpoint(
            platform_id="p1",
            platform_name="P1",
            phase="template_applied",
            started_at="",
            last_updated="",
            completed_phases=[],
            failed_phases=[],
        )

        result = executor._phase_generate_code("p1", manifest_path, checkpoint)
        assert checkpoint.metadata["code_generated"] is True

    def test_phase_provision_non_dry(self, temp_dir, mock_manifest):
        executor = MigrationExecutor(
            template_dir=temp_dir,
            output_dir=temp_dir / "output",
            checkpoint_dir=temp_dir / "checkpoints",
            dry_run=False,
        )
        checkpoint = MigrationCheckpoint(
            platform_id="p1",
            platform_name="P1",
            phase="code_generated",
            started_at="",
            last_updated="",
            completed_phases=[],
            failed_phases=[],
        )
        manifest_path = temp_dir / "m.json"
        manifest_path.write_text(json.dumps(mock_manifest))
        result = executor._phase_provision_infrastructure(
            "p1", manifest_path, checkpoint
        )
        assert checkpoint.metadata.get("infrastructure_provisioned") is True

    def test_phase_migrate_db_non_dry(self, temp_dir, mock_manifest):
        executor = MigrationExecutor(
            template_dir=temp_dir,
            output_dir=temp_dir / "output",
            checkpoint_dir=temp_dir / "checkpoints",
            dry_run=False,
        )
        checkpoint = MigrationCheckpoint(
            platform_id="p1",
            platform_name="P1",
            phase="infra",
            started_at="",
            last_updated="",
            completed_phases=[],
            failed_phases=[],
        )
        manifest_path = temp_dir / "m.json"
        manifest_path.write_text(json.dumps(mock_manifest))
        result = executor._phase_migrate_database("p1", manifest_path, checkpoint)
        assert checkpoint.metadata.get("database_migrated") is True

    def test_phase_smoke_test_non_dry(self, temp_dir, mock_manifest):
        executor = MigrationExecutor(
            template_dir=temp_dir,
            output_dir=temp_dir / "output",
            checkpoint_dir=temp_dir / "checkpoints",
            dry_run=False,
        )
        checkpoint = MigrationCheckpoint(
            platform_id="p1",
            platform_name="P1",
            phase="db",
            started_at="",
            last_updated="",
            completed_phases=[],
            failed_phases=[],
        )
        manifest_path = temp_dir / "m.json"
        manifest_path.write_text(json.dumps(mock_manifest))
        result = executor._phase_smoke_test("p1", manifest_path, checkpoint)
        assert checkpoint.metadata.get("smoke_tested") is True

    # ── Checkpoint edge cases ───────────────────────────────────────────

    def test_load_checkpoint_corrupt(self, temp_dir):
        """Corrupted checkpoint file returns None."""
        executor = MigrationExecutor(
            template_dir=temp_dir,
            output_dir=temp_dir / "output",
            checkpoint_dir=temp_dir / "checkpoints",
        )
        cp = executor.checkpoint_dir / "bad.checkpoint.json"
        cp.write_text("NOT JSON {{{")
        result = executor._load_checkpoint("bad")
        assert result is None

    # ── _get_next_phase completed ───────────────────────────────────────

    def test_get_next_phase_all_done(self, temp_dir):
        """When all phases done, returns COMPLETED."""
        executor = MigrationExecutor(
            template_dir=temp_dir,
            output_dir=temp_dir / "output",
            checkpoint_dir=temp_dir / "checkpoints",
        )
        checkpoint = MigrationCheckpoint(
            platform_id="p",
            platform_name="P",
            phase="tested",
            started_at="",
            last_updated="",
            completed_phases=[
                "analysis",
                "template_applied",
                "code_generated",
                "infrastructure_provisioned",
                "database_migrated",
                "tested",
            ],
            failed_phases=[],
        )
        assert executor._get_next_phase(checkpoint) == MigrationPhase.COMPLETED

    # ── Rollback edge cases ─────────────────────────────────────────────

    def test_rollback_no_checkpoint(self, temp_dir):
        """Rollback returns False when no checkpoint exists."""
        executor = MigrationExecutor(
            template_dir=temp_dir,
            output_dir=temp_dir / "output",
            checkpoint_dir=temp_dir / "checkpoints",
        )
        assert executor.rollback_migration("nonexistent") is False

    def test_rollback_exception_during_cleanup(self, temp_dir, mock_manifest):
        """Rollback returns False when rmtree raises."""
        executor = MigrationExecutor(
            template_dir=temp_dir,
            output_dir=temp_dir / "output",
            checkpoint_dir=temp_dir / "checkpoints",
            dry_run=True,
        )
        manifest_path = temp_dir / "m.json"
        manifest_path.write_text(json.dumps(mock_manifest))
        executor.execute_migration("ex", manifest_path)

        # Create output dir so rm gets attempted
        out = executor.output_dir / "ex"
        out.mkdir(parents=True, exist_ok=True)

        with patch(
            "migration_executor.shutil.rmtree", side_effect=PermissionError("denied")
        ):
            result = executor.rollback_migration("ex")
            assert result is False

    # ── get_migration_status no checkpoint ──────────────────────────────

    def test_get_migration_status_no_checkpoint(self, temp_dir):
        executor = MigrationExecutor(
            template_dir=temp_dir,
            output_dir=temp_dir / "output",
            checkpoint_dir=temp_dir / "checkpoints",
        )
        assert executor.get_migration_status("nope") is None

    # ── main() CLI ──────────────────────────────────────────────────────

    def test_main_no_args(self, temp_dir):
        """main() with insufficient args exits with code 1."""
        from migration_executor import main

        with patch("sys.argv", ["migration_executor.py"]):
            with pytest.raises(SystemExit) as exc_info:
                main()
            assert exc_info.value.code == 1

    def test_main_full_run(self, temp_dir, mock_manifest):
        """main() with valid args runs a migration."""
        manifest_path = temp_dir / "manifest.json"
        manifest_path.write_text(json.dumps(mock_manifest))

        with patch(
            "sys.argv",
            [
                "migration_executor.py",
                "test-platform",
                str(manifest_path),
                "--dry-run",
            ],
        ):
            with patch("migration_executor.MigrationLogger") as mock_logger:
                mock_logger.get_logger.return_value = Mock()
                with patch("migration_executor.Path") as mock_path_cls:
                    # We just need main() to not crash — use real Path for manifest
                    mock_path_cls.side_effect = Path
                    from migration_executor import main

                    with pytest.raises(SystemExit) as exc_info:
                        main()
                    assert exc_info.value.code == 0

    def test_main_resume_flag(self, temp_dir, mock_manifest):
        """main() passes resume=True when --resume flag is present."""
        manifest_path = temp_dir / "manifest.json"
        manifest_path.write_text(json.dumps(mock_manifest))

        from migration_executor import main

        with patch("migration_executor.MigrationExecutor") as mock_cls:
            mock_executor = Mock()
            mock_executor.execute_migration.return_value = MigrationResult(
                platform_id="p",
                success=True,
                phase_reached="completed",
                duration_seconds=1.0,
                checkpoint=None,
            )
            mock_cls.return_value = mock_executor
            with patch("migration_executor.MigrationLogger"):
                with patch(
                    "sys.argv",
                    [
                        "prog",
                        "my-plat",
                        str(manifest_path),
                        "--resume",
                    ],
                ):
                    with pytest.raises(SystemExit) as exc_info:
                        main()
                    assert exc_info.value.code == 0
                    mock_executor.execute_migration.assert_called_once_with(
                        "my-plat",
                        manifest_path,
                        resume=True,
                    )

    # ── Coverage for remaining uncovered lines ───────────────────────

    def test_phase_with_warnings(self, temp_dir, mock_manifest):
        """Phase returning warnings extends the warnings list (line 179)."""
        manifest_path = temp_dir / "manifest.json"
        manifest_path.write_text(json.dumps(mock_manifest))
        executor = MigrationExecutor(
            template_dir=temp_dir / "template",
            output_dir=temp_dir / "output",
            checkpoint_dir=temp_dir / "checkpoints",
            dry_run=True,
        )
        # Patch all phase functions to succeed, one with warnings
        with patch.object(
            executor,
            "_phase_analysis",
            return_value={"success": True, "warnings": ["watch out"]},
        ):
            with patch.object(
                executor, "_phase_apply_template", return_value={"success": True}
            ):
                with patch.object(
                    executor, "_phase_generate_code", return_value={"success": True}
                ):
                    with patch.object(
                        executor,
                        "_phase_provision_infrastructure",
                        return_value={"success": True},
                    ):
                        with patch.object(
                            executor,
                            "_phase_migrate_database",
                            return_value={"success": True},
                        ):
                            with patch.object(
                                executor,
                                "_phase_smoke_test",
                                return_value={"success": True},
                            ):
                                result = executor.execute_migration(
                                    "test-plat", manifest_path
                                )
        assert "watch out" in result.warnings

    def test_max_retries_exceeded(self, temp_dir, mock_manifest):
        """_execute_phase_with_retry returns error after all retries fail (line 249)."""
        executor = MigrationExecutor(
            template_dir=temp_dir / "template",
            output_dir=temp_dir / "output",
            checkpoint_dir=temp_dir / "checkpoints",
            dry_run=True,
        )
        executor.RETRY_DELAY = 0  # no wait
        failing_fn = Mock(side_effect=RuntimeError("boom"))
        from migration_executor import MigrationCheckpoint

        cp = MigrationCheckpoint(
            platform_id="x",
            platform_name="X",
            phase="analysis",
            started_at="2026-01-01",
            last_updated="2026-01-01",
            completed_phases=[],
            failed_phases=[],
        )
        result = executor._execute_phase_with_retry(failing_fn, "x", Path("m"), cp)
        assert result["success"] is False
        assert "Max retries" in result["error"] or "boom" in result["error"]

    def test_template_dir_not_found(self, temp_dir, mock_manifest):
        """_phase_apply_template raises FileNotFoundError when template_dir missing (line 301)."""
        manifest_path = temp_dir / "manifest.json"
        manifest_path.write_text(json.dumps(mock_manifest))
        executor = MigrationExecutor(
            template_dir=temp_dir / "nonexistent-template",
            output_dir=temp_dir / "output",
            checkpoint_dir=temp_dir / "checkpoints",
            dry_run=False,
        )
        from migration_executor import MigrationCheckpoint

        cp = MigrationCheckpoint(
            platform_id="p",
            platform_name="P",
            phase="apply_template",
            started_at="2026-01-01",
            last_updated="2026-01-01",
            completed_phases=[],
            failed_phases=[],
        )
        with pytest.raises(FileNotFoundError, match="Template directory not found"):
            executor._phase_apply_template("p", manifest_path, cp)

    def test_main_with_errors_and_warnings(self, temp_dir, mock_manifest, capsys):
        """main() prints errors and warnings sections (lines 604-611)."""
        manifest_path = temp_dir / "manifest.json"
        manifest_path.write_text(json.dumps(mock_manifest))
        from migration_executor import main

        with patch("migration_executor.MigrationExecutor") as mock_cls:
            mock_executor = Mock()
            mock_executor.execute_migration.return_value = MigrationResult(
                platform_id="p",
                success=False,
                phase_reached="analysis",
                duration_seconds=1.0,
                checkpoint=None,
                errors=["something failed"],
                warnings=["be careful"],
            )
            mock_cls.return_value = mock_executor
            with patch("migration_executor.MigrationLogger"):
                with patch("sys.argv", ["prog", "p", str(manifest_path)]):
                    with pytest.raises(SystemExit) as exc_info:
                        main()
                    assert exc_info.value.code == 1
        captured = capsys.readouterr()
        assert "something failed" in captured.out
        assert "be careful" in captured.out
