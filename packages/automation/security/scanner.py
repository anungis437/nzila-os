"""
Security Scanner Module

Provides security scanning for Nzila platforms.
"""

import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional


class SecurityScanner:
    """Security scanner for code and configurations."""

    # Common secret patterns
    SECRET_PATTERNS = {
        "AWS_KEY": r"AKIA[0-9A-Z]{16}",
        "AWS_SECRET": r"(?i:aws)(.{0,20})?['\"][0-9a-zA-Z/+]{40}['\"]",
        "PRIVATE_KEY": r"-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----",
        "GITHUB_TOKEN": r"(?i)github[_-]?token['\"]?\s*[:=]\s*['\"][a-zA-Z0-9]{36}['\"]",
        "AZURE_TOKEN": r"(?i)azure[_-]?token['\"]?\s*[:=]\s*['\"][a-zA-Z0-9\-_]{52,}['\"]",
        "SLACK_TOKEN": r"xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}",
        "STRIPE_KEY": r"(?:sk|pk)_(?:test|live)_[0-9a-zA-Z]{24,}",
        "JWT_SECRET": r"(?i)jwt[_-]?secret['\"]?\s*[:=]\s*['\"][a-zA-Z0-9\-_]{32,}['\"]",
        "DATABASE_URL": r"(?i)(?:db|database|postgres|mysql|mongodb)[_-]?url['\"]?\s*[:=]\s*['\"][^\s'\"]{20,}['\"]",
        "API_KEY": r"(?i)api[_-]?key['\"]?\s*[:=]\s*['\"][a-zA-Z0-9\-_]{20,}['\"]",
    }

    # Vulnerability patterns
    VULNERABILITY_PATTERNS = {
        "SQL_INJECTION": r"(?:execute|query|cursor\.execute)\s*\(\s*['\"].*\%s.*['\"]",
        "HARDCODE_CREDENTIALS": r"password\s*=\s*['\"][^'\"]+['\"]",
        "INSECURE_RANDOM": r"random\.(?:random|randint)\s*\(",
        "DEBUG_MODE": r"DEBUG\s*=\s*True",
        "SSL_DISABLED": r"(?:verify_ssl|ssl_verify|ssl)\s*=\s*False",
    }

    def __init__(self, base_path: Optional[Path] = None):
        """Initialize security scanner."""
        self.base_path = base_path or Path.cwd()

    def scan_file(self, file_path: Path) -> Dict[str, Any]:
        """Scan a single file for security issues."""
        issues = []

        try:
            content = file_path.read_text(encoding="utf-8", errors="ignore")

            # Check for secrets
            for secret_type, pattern in self.SECRET_PATTERNS.items():
                matches = re.finditer(pattern, content)
                for match in matches:
                    # Don't flag if it's in a test file or example
                    if not any(
                        x in str(file_path) for x in ["test", "example", "mock"]
                    ):
                        issues.append(
                            {
                                "type": "secret",
                                "severity": "critical",
                                "pattern": secret_type,
                                "line": content[: match.start()].count("\n") + 1,
                                "message": f"Potential secret detected: {secret_type}",
                            }
                        )

            # Check for vulnerabilities
            for vuln_type, pattern in self.VULNERABILITY_PATTERNS.items():
                matches = re.finditer(pattern, content)
                for match in matches:
                    issues.append(
                        {
                            "type": "vulnerability",
                            "severity": "high",
                            "pattern": vuln_type,
                            "line": content[: match.start()].count("\n") + 1,
                            "message": f"Potential vulnerability: {vuln_type}",
                        }
                    )

        except Exception as e:
            issues.append(
                {
                    "type": "error",
                    "severity": "info",
                    "message": f"Could not scan file: {str(e)}",
                }
            )

        return {"file": str(file_path), "issues": issues, "issue_count": len(issues)}

    def scan_directory(
        self, directory: Path, extensions: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Scan a directory for security issues."""
        if extensions is None:
            extensions = [
                ".py",
                ".js",
                ".ts",
                ".tsx",
                ".jsx",
                ".env",
                ".json",
                ".yaml",
                ".yml",
            ]

        results = {
            "directory": str(directory),
            "timestamp": datetime.now().isoformat(),
            "files_scanned": 0,
            "total_issues": 0,
            "by_severity": {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0},
            "files": [],
        }

        for ext in extensions:
            for file_path in directory.rglob(f"*{ext}"):
                # Skip node_modules, .git, etc.
                if any(
                    x in str(file_path)
                    for x in ["node_modules", ".git", "__pycache__", ".venv", "venv"]
                ):
                    continue

                file_result = self.scan_file(file_path)
                results["files_scanned"] += 1
                results["total_issues"] += file_result["issue_count"]

                for issue in file_result["issues"]:
                    results["by_severity"][issue["severity"]] = (
                        results["by_severity"].get(issue["severity"], 0) + 1
                    )

                if file_result["issue_count"] > 0:
                    results["files"].append(file_result)

        return results

    def scan_platform(self, platform_name: str) -> Dict[str, Any]:
        """Scan a specific platform."""
        # Look for platform in common locations
        possible_paths = [
            self.base_path / "nzila-website" / "app" / platform_name,
            self.base_path / "platforms" / platform_name,
            self.base_path / platform_name,
        ]

        for path in possible_paths:
            if path.exists():
                return self.scan_directory(path)

        return {"error": f"Platform not found: {platform_name}"}


def scan_all_platforms(base_path: Optional[Path] = None) -> Dict[str, Any]:
    """Convenience function to scan all platforms."""
    scanner = SecurityScanner(base_path)

    # Scan main directories
    results = {"timestamp": datetime.now().isoformat(), "scans": []}

    # Scan nzila-website if exists
    website = base_path / "nzila-website" if base_path else Path.cwd() / "nzila-website"
    if website.exists():
        results["scans"].append(
            {"target": "nzila-website", "result": scanner.scan_directory(website)}
        )

    # Scan automation if exists
    automation = base_path / "automation" if base_path else Path.cwd() / "automation"
    if automation.exists():
        results["scans"].append(
            {"target": "automation", "result": scanner.scan_directory(automation)}
        )

    # Calculate totals
    total_issues = sum(s["result"].get("total_issues", 0) for s in results["scans"])
    results["total_issues"] = total_issues

    return results


# ==================== Standalone Execution ====================

if __name__ == "__main__":
    import sys

    scanner = SecurityScanner()

    if len(sys.argv) > 1:
        # Scan specific path
        path = Path(sys.argv[1])
        results = scanner.scan_directory(path)
    else:
        # Scan all
        results = scan_all_platforms()

    print(json.dumps(results, indent=2))
