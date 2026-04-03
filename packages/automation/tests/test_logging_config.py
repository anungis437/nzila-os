"""
Unit tests for logging_config.py
"""

import logging
import sys
import time
from pathlib import Path
from unittest.mock import Mock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from logging_config import LogOperation, LogRetry, MigrationLogger


@pytest.mark.unit
class TestMigrationLogger:
    """Test MigrationLogger class."""

    def setup_method(self):
        """Reset logger state between tests."""
        MigrationLogger._loggers = {}
        MigrationLogger._log_dir = None
        MigrationLogger._log_level = logging.INFO

    def test_setup_default(self):
        MigrationLogger.setup()
        assert MigrationLogger._log_level == logging.INFO
        assert MigrationLogger._log_dir is None

    def test_setup_with_log_dir(self, tmp_path):
        log_dir = tmp_path / "logs"
        MigrationLogger.setup(log_level="DEBUG", log_dir=log_dir)
        assert MigrationLogger._log_level == logging.DEBUG
        assert log_dir.exists()

    def test_get_logger_creates_new(self):
        logger = MigrationLogger.get_logger("test_module")
        assert isinstance(logger, logging.Logger)
        assert logger.name == "test_module"
        assert "test_module" in MigrationLogger._loggers

    def test_get_logger_returns_cached(self):
        logger1 = MigrationLogger.get_logger("cached")
        logger2 = MigrationLogger.get_logger("cached")
        assert logger1 is logger2

    def test_get_logger_with_file_handler(self, tmp_path):
        log_dir = tmp_path / "logs"
        MigrationLogger.setup(log_level="INFO", log_dir=log_dir)
        logger = MigrationLogger.get_logger("file_test")
        assert any(isinstance(h, logging.FileHandler) for h in logger.handlers)

    def test_get_logger_no_file_handler_without_dir(self):
        MigrationLogger.setup()
        logger = MigrationLogger.get_logger("no_file")
        assert not any(isinstance(h, logging.FileHandler) for h in logger.handlers)


@pytest.mark.unit
class TestLogOperation:
    """Test LogOperation context manager."""

    def test_successful_operation(self):
        mock_logger = Mock()
        with LogOperation(mock_logger, "test_op", key="value"):
            pass
        assert mock_logger.info.call_count == 2  # start + complete
        start_msg = mock_logger.info.call_args_list[0][0][0]
        assert "Starting: test_op" in start_msg
        complete_msg = mock_logger.info.call_args_list[1][0][0]
        assert "Completed: test_op" in complete_msg

    def test_failed_operation(self):
        mock_logger = Mock()
        with pytest.raises(ValueError):
            with LogOperation(mock_logger, "fail_op"):
                raise ValueError("boom")
        mock_logger.error.assert_called_once()
        error_msg = mock_logger.error.call_args[0][0]
        assert "Failed: fail_op" in error_msg
        assert "ValueError" in error_msg

    def test_exit_returns_false(self):
        """LogOperation does not suppress exceptions."""
        op = LogOperation(Mock(), "op")
        op.__enter__()  # sets start_time
        result = op.__exit__(None, None, None)
        assert result is False


@pytest.mark.unit
class TestLogRetry:
    """Test LogRetry decorator."""

    def test_successful_first_attempt(self):
        mock_logger = Mock()

        @LogRetry(mock_logger, max_retries=3, delay=0)
        def succeeds():
            return 42

        assert succeeds() == 42

    def test_retry_then_succeed(self):
        mock_logger = Mock()
        call_count = 0

        @LogRetry(mock_logger, max_retries=3, delay=0)
        def fails_twice():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise RuntimeError("not yet")
            return "ok"

        result = fails_twice()
        assert result == "ok"
        assert mock_logger.warning.call_count == 2

    def test_all_retries_fail(self):
        mock_logger = Mock()

        @LogRetry(mock_logger, max_retries=2, delay=0)
        def always_fails():
            raise RuntimeError("permanent failure")

        with pytest.raises(RuntimeError, match="permanent failure"):
            always_fails()

        mock_logger.error.assert_called_once()
        error_msg = mock_logger.error.call_args[0][0]
        assert "All 2 retries failed" in error_msg
