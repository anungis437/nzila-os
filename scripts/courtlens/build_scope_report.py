"""Build ``reports/phase0/scope-report.json`` for the CourtLens Phase 0 branch.

The scope report reconciles three views of "what this planning branch changes":

* ``gitDiffFileCount`` — the local ``git diff --name-only <base>...HEAD`` count.
* ``githubPrFileCount`` — the file count reported by the GitHub PR API (once
  the PR exists). Passed in via ``--github-pr-file-count``; may be ``None``
  when the PR has not been opened yet, in which case reconciliation defers.
* ``controlledExclusions`` — paths that intentionally do NOT appear in the
  diff (for example this scope report itself, which is regenerated *after*
  the diff is measured to break a self-referential cycle).

The verdict is ``RECONCILED`` iff every diffed path is either present in the
GitHub PR file list or explicitly listed in ``controlledExclusions``.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

SCHEMA_VERSION = 1


def _run_git(args: list[str], repo_root: Path) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=repo_root,
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout


def resolve_head(repo_root: Path) -> str:
    return _run_git(["rev-parse", "HEAD"], repo_root).strip()


def resolve_ref(ref: str, repo_root: Path) -> str:
    return _run_git(["rev-parse", ref], repo_root).strip()


def diff_file_list(base: str, head: str, repo_root: Path) -> list[str]:
    raw = _run_git(["diff", "--name-only", f"{base}...{head}"], repo_root)
    return sorted(p for p in raw.splitlines() if p)


def reconcile(
    diff_files: Iterable[str],
    github_files: Iterable[str] | None,
    controlled_exclusions: Iterable[str],
) -> dict[str, object]:
    diff_set = set(diff_files)
    excl_set = set(controlled_exclusions)
    if github_files is None:
        return {
            "verdict": "DEFERRED_PR_NOT_OPEN",
            "unmatchedInDiff": [],
            "unmatchedInGitHub": [],
            "notes": (
                "GitHub PR file list not provided. Re-run with "
                "--github-pr-file-count and --github-pr-files after the "
                "PR is opened to close the reconciliation."
            ),
        }
    gh_set = set(github_files)
    unmatched_in_diff = sorted(
        p for p in diff_set if p not in gh_set and p not in excl_set
    )
    unmatched_in_gh = sorted(p for p in gh_set if p not in diff_set)
    verdict = (
        "RECONCILED" if not (unmatched_in_diff or unmatched_in_gh) else "DIVERGENT"
    )
    return {
        "verdict": verdict,
        "unmatchedInDiff": unmatched_in_diff,
        "unmatchedInGitHub": unmatched_in_gh,
        "notes": (
            "diffed files fully accounted for by GitHub PR + controlledExclusions."
            if verdict == "RECONCILED"
            else "See unmatched arrays for the deltas that must be resolved."
        ),
    }


def build(
    repo_root: Path,
    base_ref: str,
    controlled_exclusions: list[str],
    github_pr_number: int | None,
    github_pr_file_count: int | None,
    github_pr_files: list[str] | None,
    generated_at: str,
) -> dict[str, object]:
    head_sha = resolve_head(repo_root)
    base_sha = resolve_ref(base_ref, repo_root)
    diff_files = diff_file_list(base_sha, head_sha, repo_root)

    diff_file_count = len(diff_files)
    reconciliation = reconcile(diff_files, github_pr_files, controlled_exclusions)

    return {
        "schemaVersion": SCHEMA_VERSION,
        "generatedAt": generated_at,
        "planningBranchHead": head_sha,
        "baseRef": base_ref,
        "baseSha": base_sha,
        "gitDiffFileCount": diff_file_count,
        "gitDiffFiles": diff_files,
        "githubPr": {
            "number": github_pr_number,
            "fileCount": github_pr_file_count,
            "files": github_pr_files if github_pr_files is not None else [],
        },
        "githubPrFileCount": github_pr_file_count,
        "controlledExclusions": sorted(controlled_exclusions),
        "reconciliation": reconciliation,
    }


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", type=Path, default=Path.cwd())
    parser.add_argument(
        "--base-ref", required=True, help="e.g. main or an integration branch"
    )
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument(
        "--controlled-exclusion",
        action="append",
        default=[],
        help="Path that must NOT appear in the diff (repeatable).",
    )
    parser.add_argument("--github-pr-number", type=int)
    parser.add_argument("--github-pr-file-count", type=int)
    parser.add_argument(
        "--github-pr-files",
        type=Path,
        help="Path to a newline-delimited file list from the GitHub PR API.",
    )
    parser.add_argument(
        "--generated-at",
        default=datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(list(sys.argv[1:]) if argv is None else argv)
    gh_files: list[str] | None = None
    if args.github_pr_files is not None:
        gh_files = sorted(
            line.strip()
            for line in args.github_pr_files.read_text(encoding="utf-8").splitlines()
            if line.strip()
        )
    report = build(
        repo_root=args.repo_root,
        base_ref=args.base_ref,
        controlled_exclusions=list(args.controlled_exclusion),
        github_pr_number=args.github_pr_number,
        github_pr_file_count=args.github_pr_file_count,
        github_pr_files=gh_files,
        generated_at=args.generated_at,
    )
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(
        json.dumps(report, indent=2, sort_keys=False) + "\n",
        encoding="utf-8",
    )
    print(
        f"Wrote {args.out} (diffFileCount={report['gitDiffFileCount']}, "
        f"verdict={report['reconciliation']['verdict']})."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
