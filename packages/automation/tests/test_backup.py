"""Tests for backup package – BackupManager & RecoveryManager."""

import json
from pathlib import Path

import pytest
from backup import (
    BackupManager,
    RecoveryManager,
    create_backup,
    perform_recovery,
    restore_backup,
)
from backup.recovery import create_dr_plan

# ── BackupManager ───────────────────────────────────────────────────────────


class TestBackupManager:
    def test_init_default_dir(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        mgr = BackupManager()
        assert mgr.backup_dir.exists()

    def test_init_custom_dir(self, tmp_path):
        d = tmp_path / "custom_backups"
        mgr = BackupManager(backup_dir=d)
        assert d.exists()

    def test_backup_database(self, tmp_path):
        mgr = BackupManager(backup_dir=tmp_path)
        result = mgr.backup_database("mydb")
        assert result["type"] == "database"
        assert result["database"] == "mydb"
        assert result["status"] == "simulated"
        assert Path(result["path"]).exists()

    def test_backup_database_custom_name(self, tmp_path):
        mgr = BackupManager(backup_dir=tmp_path)
        result = mgr.backup_database("mydb", backup_name="custom")
        assert result["name"] == "custom"
        assert Path(result["path"]).name == "custom.sql"

    def test_backup_files_source_exists(self, tmp_path):
        src = tmp_path / "source"
        src.mkdir()
        mgr = BackupManager(backup_dir=tmp_path / "backups")
        result = mgr.backup_files(src)
        assert result["type"] == "files"
        assert result["status"] == "simulated"

    def test_backup_files_source_missing(self, tmp_path):
        mgr = BackupManager(backup_dir=tmp_path / "backups")
        result = mgr.backup_files(tmp_path / "nope")
        assert "error" in result

    def test_backup_files_custom_name(self, tmp_path):
        src = tmp_path / "source"
        src.mkdir()
        mgr = BackupManager(backup_dir=tmp_path / "backups")
        result = mgr.backup_files(src, backup_name="my_files")
        assert result["name"] == "my_files"

    def test_list_backups_empty(self, tmp_path):
        mgr = BackupManager(backup_dir=tmp_path)
        assert mgr.list_backups() == []

    def test_list_backups_after_create(self, tmp_path):
        mgr = BackupManager(backup_dir=tmp_path)
        mgr.backup_database("db1")
        backups = mgr.list_backups()
        assert len(backups) == 1

    def test_list_backups_with_type_filter(self, tmp_path):
        mgr = BackupManager(backup_dir=tmp_path)
        mgr.backup_database("db1")
        # Type filter is a no-op but shouldn't break
        backups = mgr.list_backups(backup_type="database")
        assert len(backups) == 1

    def test_get_backup_found(self, tmp_path):
        mgr = BackupManager(backup_dir=tmp_path)
        result = mgr.backup_database("db1", backup_name="snap")
        backup = mgr.get_backup("snap.sql")
        assert backup is not None
        assert backup["name"] == "snap"

    def test_get_backup_not_found(self, tmp_path):
        mgr = BackupManager(backup_dir=tmp_path)
        assert mgr.get_backup("nope.sql") is None

    def test_delete_backup(self, tmp_path):
        mgr = BackupManager(backup_dir=tmp_path)
        mgr.backup_database("db1", backup_name="del_me")
        assert mgr.delete_backup("del_me.sql") is True
        assert mgr.get_backup("del_me.sql") is None

    def test_delete_backup_not_found(self, tmp_path):
        mgr = BackupManager(backup_dir=tmp_path)
        assert mgr.delete_backup("nope.sql") is False

    def test_schedule_backup(self, tmp_path):
        mgr = BackupManager(backup_dir=tmp_path)
        sched = mgr.schedule_backup("0 2 * * *", "database")
        assert sched["schedule"] == "0 2 * * *"
        assert sched["enabled"] is True
        assert sched["retention_days"] == 30


# ── create_backup / restore_backup convenience ─────────────────────────────


class TestConvenienceFunctions:
    def test_create_backup_database(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        result = create_backup("database", database="test_db")
        assert result["type"] == "database"

    def test_create_backup_files(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        result = create_backup("files")
        assert result["type"] == "files"

    def test_create_backup_full(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        result = create_backup("full")
        assert "database" in result
        assert "files" in result

    def test_restore_backup_not_found(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        result = restore_backup("nonexistent.sql")
        assert "error" in result

    def test_restore_backup_found(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        mgr = BackupManager()
        mgr.backup_database("db", backup_name="to_restore")
        result = restore_backup("to_restore.sql")
        assert result.get("status") == "simulated" or "error" not in result


# ── RecoveryManager ─────────────────────────────────────────────────────────


class TestRecoveryManager:
    def test_perform_recovery_full(self, tmp_path):
        mgr = RecoveryManager(backup_dir=tmp_path)
        result = mgr.perform_recovery("CongoWave", "full")
        assert result["status"] == "success"
        assert result["platform"] == "CongoWave"
        assert len(result["steps"]) >= 4

    def test_perform_recovery_database_only(self, tmp_path):
        mgr = RecoveryManager(backup_dir=tmp_path)
        result = mgr.perform_recovery("Web", "database")
        assert result["status"] == "success"
        step_names = [s["step"] for s in result["steps"]]
        assert "restore_database" in step_names

    def test_perform_recovery_files_only(self, tmp_path):
        mgr = RecoveryManager(backup_dir=tmp_path)
        result = mgr.perform_recovery("Web", "files")
        step_names = [s["step"] for s in result["steps"]]
        assert "restore_files" in step_names

    def test_perform_recovery_with_backup_name(self, tmp_path):
        mgr = RecoveryManager(backup_dir=tmp_path)
        # Create a backup first
        mgr.backup_manager.backup_database("db", backup_name="snap")
        result = mgr.perform_recovery("Web", backup_name="snap.sql")
        assert result["status"] == "success"

    def test_perform_recovery_backup_not_found(self, tmp_path):
        mgr = RecoveryManager(backup_dir=tmp_path)
        result = mgr.perform_recovery("Web", backup_name="missing.sql")
        assert result["status"] == "failed"
        assert "not found" in result["error"]

    def test_create_recovery_plan(self, tmp_path):
        mgr = RecoveryManager(backup_dir=tmp_path)
        plan = mgr.create_recovery_plan("CongoWave")
        assert plan["platform"] == "CongoWave"
        assert plan["rto_minutes"] == 60
        assert plan["rpo_hours"] == 24
        assert len(plan["steps"]) == 7
        assert "contacts" in plan

    def test_test_recovery(self, tmp_path):
        mgr = RecoveryManager(backup_dir=tmp_path)
        result = mgr.test_recovery("CongoWave")
        assert result["status"] == "completed"
        assert result["platform"] == "CongoWave"
        assert result["results"]["rto_achieved"] is True

    def test_get_recovery_history_empty(self, tmp_path):
        mgr = RecoveryManager(backup_dir=tmp_path)
        assert mgr.get_recovery_history() == []

    def test_get_recovery_history_filtered(self, tmp_path):
        mgr = RecoveryManager(backup_dir=tmp_path)
        mgr.perform_recovery("A")
        mgr.perform_recovery("B")
        assert len(mgr.get_recovery_history("A")) == 1
        assert len(mgr.get_recovery_history()) == 2


# ── Convenience functions ───────────────────────────────────────────────────


class TestRecoveryConvenience:
    def test_perform_recovery_fn(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        result = perform_recovery("TestPlatform")
        assert result["status"] == "success"

    def test_create_dr_plan_fn(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        plan = create_dr_plan("TestPlatform")
        assert plan["platform"] == "TestPlatform"
        assert len(plan["steps"]) == 7
