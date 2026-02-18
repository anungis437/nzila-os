#!/usr/bin/env python3
"""
Progress Tracker — Per-platform migration progress tracking with quality gates,
checkpoints, and reporting. Integrates with code_generator and dependency_analyzer
to provide a unified view of migration status.

Features:
- Per-platform progress tracking (ABR, UE)
- Quality gate validation (tests pass, no regressions, schema parity)
- Checkpoint persistence (JSON files)
- Progress dashboard output (Markdown)
- Integration with migration_executor phase system
"""

import json
import re
from pathlib import Path
from typing import Dict, List, Optional, Any, Set
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum

try:
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from logging_config import MigrationLogger
    logger = MigrationLogger.get_logger(__name__)
except ImportError:
    import logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# Enums
# ──────────────────────────────────────────────

class PhaseStatus(Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    BLOCKED = "blocked"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class QualityGateStatus(Enum):
    PENDING = "pending"
    PASSED = "passed"
    FAILED = "failed"
    WAIVED = "waived"


class MigrationPhase(Enum):
    """End-to-end migration phases"""
    ANALYSIS = "analysis"
    SCHEMA_EXTRACTION = "schema_extraction"
    CODE_GENERATION = "code_generation"
    DEPENDENCY_MAPPING = "dependency_mapping"
    SCAFFOLD_POPULATION = "scaffold_population"
    MODEL_MIGRATION = "model_migration"
    DATA_MIGRATION = "data_migration"
    AUTH_MIGRATION = "auth_migration"
    API_MIGRATION = "api_migration"
    QUEUE_MIGRATION = "queue_migration"
    TESTING = "testing"
    DEPLOYMENT = "deployment"
    CUTOVER = "cutover"


# ──────────────────────────────────────────────
# Data Classes
# ──────────────────────────────────────────────

@dataclass
class QualityGate:
    """A quality gate that must pass before proceeding"""
    name: str
    description: str
    status: QualityGateStatus = QualityGateStatus.PENDING
    checked_at: Optional[str] = None
    message: str = ""
    required: bool = True  # False = advisory only

    def pass_gate(self, message: str = ""):
        self.status = QualityGateStatus.PASSED
        self.checked_at = datetime.now().isoformat()
        self.message = message

    def fail_gate(self, message: str = ""):
        self.status = QualityGateStatus.FAILED
        self.checked_at = datetime.now().isoformat()
        self.message = message

    def waive_gate(self, reason: str = ""):
        self.status = QualityGateStatus.WAIVED
        self.checked_at = datetime.now().isoformat()
        self.message = f"WAIVED: {reason}"


@dataclass
class PhaseProgress:
    """Progress tracking for a single migration phase"""
    phase: str
    status: PhaseStatus = PhaseStatus.NOT_STARTED
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    progress_pct: float = 0.0
    tasks_total: int = 0
    tasks_completed: int = 0
    notes: str = ""
    blockers: List[str] = field(default_factory=list)
    quality_gates: List[QualityGate] = field(default_factory=list)

    def start(self):
        self.status = PhaseStatus.IN_PROGRESS
        self.started_at = datetime.now().isoformat()

    def complete(self):
        self.status = PhaseStatus.COMPLETED
        self.completed_at = datetime.now().isoformat()
        self.progress_pct = 100.0

    def fail(self, reason: str = ""):
        self.status = PhaseStatus.FAILED
        self.notes = reason

    def block(self, blocker: str):
        self.status = PhaseStatus.BLOCKED
        self.blockers.append(blocker)

    def update_progress(self, completed: int, total: int):
        self.tasks_completed = completed
        self.tasks_total = total
        self.progress_pct = (completed / total * 100) if total > 0 else 0

    def all_gates_passed(self) -> bool:
        """Check if all required quality gates are passed or waived"""
        for gate in self.quality_gates:
            if gate.required and gate.status not in (
                QualityGateStatus.PASSED, QualityGateStatus.WAIVED
            ):
                return False
        return True


@dataclass
class PlatformProgress:
    """Full migration progress for a platform"""
    platform_id: str
    platform_name: str
    phases: Dict[str, PhaseProgress] = field(default_factory=dict)
    overall_progress: float = 0.0
    started_at: Optional[str] = None
    last_updated: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def compute_overall(self):
        """Recompute overall progress from phases"""
        if not self.phases:
            self.overall_progress = 0.0
            return
        total = sum(p.progress_pct for p in self.phases.values())
        self.overall_progress = total / len(self.phases)
        self.last_updated = datetime.now().isoformat()


# ──────────────────────────────────────────────
# Default Quality Gates
# ──────────────────────────────────────────────

def _default_quality_gates(phase: MigrationPhase) -> List[QualityGate]:
    """Create default quality gates for each phase"""
    gates_map = {
        MigrationPhase.ANALYSIS: [
            QualityGate("schema_report_exists", "Schema extraction report generated"),
            QualityGate("tech_stack_identified", "Tech stack fully documented"),
        ],
        MigrationPhase.SCHEMA_EXTRACTION: [
            QualityGate("all_tables_extracted", "All database tables captured"),
            QualityGate("relationships_mapped", "Foreign key relationships documented"),
            QualityGate("enums_catalogued", "All enum types catalogued"),
        ],
        MigrationPhase.CODE_GENERATION: [
            QualityGate("models_generated", "Django models generated from schemas"),
            QualityGate("serializers_generated", "DRF serializers generated"),
            QualityGate("views_generated", "DRF viewsets generated"),
            QualityGate("no_syntax_errors", "Generated code has no syntax errors"),
        ],
        MigrationPhase.DEPENDENCY_MAPPING: [
            QualityGate("deps_classified", "All packages classified"),
            QualityGate("python_equivalents", "Python equivalents identified for migrate packages"),
            QualityGate("risk_assessed", "High-risk migrations flagged"),
        ],
        MigrationPhase.MODEL_MIGRATION: [
            QualityGate("migrations_run", "Django makemigrations succeeds"),
            QualityGate("migrate_succeeds", "Django migrate runs cleanly"),
            QualityGate("schema_parity", "Django schema matches source schema"),
        ],
        MigrationPhase.AUTH_MIGRATION: [
            QualityGate("clerk_jwt_works", "Clerk JWT verification implemented"),
            QualityGate("permissions_mapped", "RBAC permissions mapped to Django"),
            QualityGate("auth_tests_pass", "Auth integration tests pass"),
        ],
        MigrationPhase.API_MIGRATION: [
            QualityGate("endpoints_parity", "All API endpoints have DRF equivalents"),
            QualityGate("response_format_match", "Response formats match frontend expectations"),
            QualityGate("api_tests_pass", "API integration tests pass"),
        ],
        MigrationPhase.TESTING: [
            QualityGate("unit_tests_pass", "All unit tests pass"),
            QualityGate("integration_tests", "Integration tests pass"),
            QualityGate("coverage_80pct", "Code coverage >= 80%"),
            QualityGate("no_regressions", "No feature regressions detected"),
        ],
        MigrationPhase.DEPLOYMENT: [
            QualityGate("docker_builds", "Docker image builds successfully"),
            QualityGate("ci_pipeline_green", "CI/CD pipeline passes"),
            QualityGate("staging_healthy", "Staging environment health check passes"),
        ],
    }

    return gates_map.get(phase, [])


# ──────────────────────────────────────────────
# Progress Tracker
# ──────────────────────────────────────────────

class ProgressTracker:
    """
    Manages migration progress for multiple platforms.
    Persists state to JSON checkpoints.

    Usage:
        tracker = ProgressTracker(checkpoint_dir=Path("automation/data/progress/"))
        tracker.init_platform("abr", "ABR Insights")
        tracker.start_phase("abr", MigrationPhase.ANALYSIS)
        tracker.update_phase("abr", MigrationPhase.ANALYSIS, completed=3, total=5)
        tracker.pass_gate("abr", MigrationPhase.ANALYSIS, "schema_report_exists")
        tracker.complete_phase("abr", MigrationPhase.ANALYSIS)
        tracker.save()
    """

    def __init__(self, checkpoint_dir: Path):
        self.checkpoint_dir = Path(checkpoint_dir)
        self.checkpoint_dir.mkdir(parents=True, exist_ok=True)
        self.platforms: Dict[str, PlatformProgress] = {}
        self._load_checkpoints()

    # ──────── Platform Management ────────

    def init_platform(self, platform_id: str, platform_name: str,
                      phases: Optional[List[MigrationPhase]] = None):
        """Initialize progress tracking for a platform"""
        if platform_id in self.platforms:
            logger.info(f"Platform {platform_id} already initialized, skipping")
            return

        if phases is None:
            phases = list(MigrationPhase)

        platform = PlatformProgress(
            platform_id=platform_id,
            platform_name=platform_name,
            started_at=datetime.now().isoformat(),
        )

        for phase in phases:
            gates = _default_quality_gates(phase)
            platform.phases[phase.value] = PhaseProgress(
                phase=phase.value,
                quality_gates=gates,
            )

        self.platforms[platform_id] = platform
        logger.info(f"Initialized {platform_name} with {len(phases)} phases")
        self.save()

    # ──────── Phase Management ────────

    def start_phase(self, platform_id: str, phase: MigrationPhase):
        """Mark a phase as in-progress"""
        pp = self._get_phase(platform_id, phase)
        pp.start()
        self.platforms[platform_id].compute_overall()
        logger.info(f"[{platform_id}] Phase {phase.value} → IN PROGRESS")
        self.save()

    def update_phase(self, platform_id: str, phase: MigrationPhase,
                     completed: int, total: int, notes: str = ""):
        """Update phase progress"""
        pp = self._get_phase(platform_id, phase)
        pp.update_progress(completed, total)
        if notes:
            pp.notes = notes
        self.platforms[platform_id].compute_overall()
        self.save()

    def complete_phase(self, platform_id: str, phase: MigrationPhase):
        """Mark a phase as completed"""
        pp = self._get_phase(platform_id, phase)
        if not pp.all_gates_passed():
            failed_gates = [g.name for g in pp.quality_gates
                          if g.required and g.status not in
                          (QualityGateStatus.PASSED, QualityGateStatus.WAIVED)]
            logger.warning(
                f"[{platform_id}] Phase {phase.value} has unmet quality gates: "
                f"{', '.join(failed_gates)}"
            )
        pp.complete()
        self.platforms[platform_id].compute_overall()
        logger.info(f"[{platform_id}] Phase {phase.value} → COMPLETED")
        self.save()

    def block_phase(self, platform_id: str, phase: MigrationPhase,
                    blocker: str):
        """Mark a phase as blocked"""
        pp = self._get_phase(platform_id, phase)
        pp.block(blocker)
        logger.warning(f"[{platform_id}] Phase {phase.value} → BLOCKED: {blocker}")
        self.save()

    def fail_phase(self, platform_id: str, phase: MigrationPhase,
                   reason: str):
        """Mark a phase as failed"""
        pp = self._get_phase(platform_id, phase)
        pp.fail(reason)
        logger.error(f"[{platform_id}] Phase {phase.value} → FAILED: {reason}")
        self.save()

    # ──────── Quality Gates ────────

    def pass_gate(self, platform_id: str, phase: MigrationPhase,
                  gate_name: str, message: str = ""):
        """Mark a quality gate as passed"""
        gate = self._get_gate(platform_id, phase, gate_name)
        gate.pass_gate(message)
        logger.info(f"[{platform_id}] Gate {gate_name} → PASSED")
        self.save()

    def fail_gate(self, platform_id: str, phase: MigrationPhase,
                  gate_name: str, message: str = ""):
        """Mark a quality gate as failed"""
        gate = self._get_gate(platform_id, phase, gate_name)
        gate.fail_gate(message)
        logger.warning(f"[{platform_id}] Gate {gate_name} → FAILED: {message}")
        self.save()

    def waive_gate(self, platform_id: str, phase: MigrationPhase,
                   gate_name: str, reason: str):
        """Waive a quality gate with documented reason"""
        gate = self._get_gate(platform_id, phase, gate_name)
        gate.waive_gate(reason)
        logger.info(f"[{platform_id}] Gate {gate_name} → WAIVED: {reason}")
        self.save()

    # ──────── Progress Queries ────────

    def get_overall_progress(self, platform_id: str) -> float:
        """Get overall migration progress percentage"""
        if platform_id not in self.platforms:
            return 0.0
        self.platforms[platform_id].compute_overall()
        return self.platforms[platform_id].overall_progress

    def get_current_phase(self, platform_id: str) -> Optional[str]:
        """Get the currently active phase"""
        if platform_id not in self.platforms:
            return None
        for phase_name, pp in self.platforms[platform_id].phases.items():
            if pp.status == PhaseStatus.IN_PROGRESS:
                return phase_name
        return None

    def get_blockers(self, platform_id: str) -> List[Dict[str, Any]]:
        """Get all current blockers across phases"""
        blockers = []
        if platform_id not in self.platforms:
            return blockers
        for phase_name, pp in self.platforms[platform_id].phases.items():
            for blocker in pp.blockers:
                blockers.append({"phase": phase_name, "blocker": blocker})
        return blockers

    def get_failed_gates(self, platform_id: str) -> List[Dict[str, str]]:
        """Get all failed quality gates"""
        failed = []
        if platform_id not in self.platforms:
            return failed
        for phase_name, pp in self.platforms[platform_id].phases.items():
            for gate in pp.quality_gates:
                if gate.status == QualityGateStatus.FAILED:
                    failed.append({
                        "phase": phase_name,
                        "gate": gate.name,
                        "message": gate.message,
                    })
        return failed

    # ──────── Persistence ────────

    def save(self):
        """Save all progress to checkpoint files"""
        for platform_id, platform in self.platforms.items():
            checkpoint_path = self.checkpoint_dir / f"{platform_id}_progress.json"
            data = self._serialize_platform(platform)
            with open(checkpoint_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, default=str)

    def _load_checkpoints(self):
        """Load existing checkpoints"""
        for checkpoint_file in self.checkpoint_dir.glob("*_progress.json"):
            try:
                with open(checkpoint_file, encoding="utf-8") as f:
                    data = json.load(f)
                platform = self._deserialize_platform(data)
                self.platforms[platform.platform_id] = platform
                logger.info(f"Loaded checkpoint: {checkpoint_file.name}")
            except (json.JSONDecodeError, KeyError) as e:
                logger.warning(f"Could not load checkpoint {checkpoint_file}: {e}")

    def _serialize_platform(self, platform: PlatformProgress) -> Dict:
        """Serialize platform progress to dict"""
        phases = {}
        for name, pp in platform.phases.items():
            gates = []
            for g in pp.quality_gates:
                gates.append({
                    "name": g.name,
                    "description": g.description,
                    "status": g.status.value,
                    "checked_at": g.checked_at,
                    "message": g.message,
                    "required": g.required,
                })
            phases[name] = {
                "phase": pp.phase,
                "status": pp.status.value,
                "started_at": pp.started_at,
                "completed_at": pp.completed_at,
                "progress_pct": pp.progress_pct,
                "tasks_total": pp.tasks_total,
                "tasks_completed": pp.tasks_completed,
                "notes": pp.notes,
                "blockers": pp.blockers,
                "quality_gates": gates,
            }

        return {
            "platform_id": platform.platform_id,
            "platform_name": platform.platform_name,
            "overall_progress": platform.overall_progress,
            "started_at": platform.started_at,
            "last_updated": platform.last_updated,
            "metadata": platform.metadata,
            "phases": phases,
        }

    def _deserialize_platform(self, data: Dict) -> PlatformProgress:
        """Deserialize platform progress from dict"""
        platform = PlatformProgress(
            platform_id=data["platform_id"],
            platform_name=data["platform_name"],
            overall_progress=data.get("overall_progress", 0.0),
            started_at=data.get("started_at"),
            last_updated=data.get("last_updated"),
            metadata=data.get("metadata", {}),
        )

        for name, pp_data in data.get("phases", {}).items():
            gates = []
            for g_data in pp_data.get("quality_gates", []):
                gate = QualityGate(
                    name=g_data["name"],
                    description=g_data.get("description", ""),
                    status=QualityGateStatus(g_data.get("status", "pending")),
                    checked_at=g_data.get("checked_at"),
                    message=g_data.get("message", ""),
                    required=g_data.get("required", True),
                )
                gates.append(gate)

            pp = PhaseProgress(
                phase=pp_data["phase"],
                status=PhaseStatus(pp_data.get("status", "not_started")),
                started_at=pp_data.get("started_at"),
                completed_at=pp_data.get("completed_at"),
                progress_pct=pp_data.get("progress_pct", 0.0),
                tasks_total=pp_data.get("tasks_total", 0),
                tasks_completed=pp_data.get("tasks_completed", 0),
                notes=pp_data.get("notes", ""),
                blockers=pp_data.get("blockers", []),
                quality_gates=gates,
            )
            platform.phases[name] = pp

        return platform

    # ──────── Helpers ────────

    def _get_phase(self, platform_id: str, phase: MigrationPhase) -> PhaseProgress:
        """Get a phase progress object, raising if not found"""
        if platform_id not in self.platforms:
            raise ValueError(f"Platform {platform_id} not initialized")
        phase_name = phase.value
        if phase_name not in self.platforms[platform_id].phases:
            raise ValueError(f"Phase {phase_name} not found for {platform_id}")
        return self.platforms[platform_id].phases[phase_name]

    def _get_gate(self, platform_id: str, phase: MigrationPhase,
                  gate_name: str) -> QualityGate:
        """Get a quality gate object"""
        pp = self._get_phase(platform_id, phase)
        for gate in pp.quality_gates:
            if gate.name == gate_name:
                return gate
        raise ValueError(f"Gate {gate_name} not found in phase {phase.value}")

    # ──────── Markdown Dashboard ────────

    def generate_dashboard(self, platform_id: Optional[str] = None) -> str:
        """Generate a Markdown progress dashboard"""
        lines = [
            "# Migration Progress Dashboard",
            f"*Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}*",
            "",
        ]

        platforms = ([self.platforms[platform_id]] if platform_id
                     else list(self.platforms.values()))

        for platform in platforms:
            platform.compute_overall()
            lines.extend([
                f"## {platform.platform_name}",
                f"**Overall Progress: {platform.overall_progress:.1f}%**",
                f"Started: {platform.started_at or 'N/A'} | "
                f"Last Updated: {platform.last_updated or 'N/A'}",
                "",
                "| Phase | Status | Progress | Tasks | Gates |",
                "|-------|--------|----------|-------|-------|",
            ])

            for phase_name, pp in platform.phases.items():
                status_icon = {
                    PhaseStatus.NOT_STARTED: "⬜",
                    PhaseStatus.IN_PROGRESS: "🔄",
                    PhaseStatus.COMPLETED: "✅",
                    PhaseStatus.BLOCKED: "🚫",
                    PhaseStatus.FAILED: "❌",
                    PhaseStatus.SKIPPED: "⏭️",
                }.get(pp.status, "❓")

                tasks_str = (f"{pp.tasks_completed}/{pp.tasks_total}"
                           if pp.tasks_total > 0 else "—")

                gates_passed = sum(1 for g in pp.quality_gates
                                 if g.status in (QualityGateStatus.PASSED,
                                                QualityGateStatus.WAIVED))
                gates_total = len(pp.quality_gates)
                gates_str = f"{gates_passed}/{gates_total}" if gates_total else "—"

                lines.append(
                    f"| {phase_name} | {status_icon} {pp.status.value} | "
                    f"{pp.progress_pct:.0f}% | {tasks_str} | {gates_str} |"
                )

            # Blockers section
            blockers = self.get_blockers(platform.platform_id)
            if blockers:
                lines.extend(["", "### Blockers"])
                for b in blockers:
                    lines.append(f"- **{b['phase']}**: {b['blocker']}")

            # Failed gates
            failed = self.get_failed_gates(platform.platform_id)
            if failed:
                lines.extend(["", "### Failed Quality Gates"])
                for f_item in failed:
                    lines.append(
                        f"- **{f_item['phase']}** → {f_item['gate']}: {f_item['message']}"
                    )

            lines.append("")

        return "\n".join(lines)

    def write_dashboard(self, output_path: Path,
                        platform_id: Optional[str] = None):
        """Write dashboard to Markdown file"""
        md = self.generate_dashboard(platform_id)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(md, encoding="utf-8")
        logger.info(f"Dashboard written: {output_path}")

    # ──────── Auto-Detection ────────

    def auto_detect_progress(self, platform_id: str,
                              workspace_root: Path):
        """Auto-detect progress by checking file existence and outputs"""
        data_dir = workspace_root / "automation" / "data"

        # Analysis phase
        schema_report = data_dir / "SCHEMA_EXTRACTION_REPORT.md"
        if schema_report.exists():
            self.pass_gate(platform_id, MigrationPhase.ANALYSIS,
                          "schema_report_exists", "File exists")
            self.update_phase(platform_id, MigrationPhase.ANALYSIS, 1, 2)

        # Check for generation output
        gen_dir = data_dir / "generated" / platform_id
        if gen_dir.exists():
            model_files = list(gen_dir.rglob("models.py"))
            if model_files:
                self.pass_gate(platform_id, MigrationPhase.CODE_GENERATION,
                              "models_generated", f"{len(model_files)} model files")

        # Check dependency report
        dep_report = data_dir / f"{platform_id}-dependency-report.json"
        if dep_report.exists():
            self.pass_gate(platform_id, MigrationPhase.DEPENDENCY_MAPPING,
                          "deps_classified", "Report generated")

        self.save()


# ──────────────────────────────────────────────
# CLI Entry Point
# ──────────────────────────────────────────────

def init_tracking(workspace_root: Path) -> ProgressTracker:
    """Initialize tracking for both flagship platforms"""
    checkpoint_dir = workspace_root / "automation" / "data" / "progress"
    tracker = ProgressTracker(checkpoint_dir=checkpoint_dir)

    tracker.init_platform("abr", "ABR Insights")
    tracker.init_platform("ue", "Union Eyes")

    # Auto-detect existing progress
    tracker.auto_detect_progress("abr", workspace_root)
    tracker.auto_detect_progress("ue", workspace_root)

    # Write dashboard
    dashboard_path = workspace_root / "automation" / "data" / "MIGRATION_DASHBOARD.md"
    tracker.write_dashboard(dashboard_path)

    return tracker


def main():
    """CLI entry point"""
    import argparse
    parser = argparse.ArgumentParser(description="Nzila Progress Tracker")
    parser.add_argument("--workspace", type=Path,
                        default=Path(__file__).parent.parent.parent)
    parser.add_argument("--dashboard", action="store_true",
                        help="Generate dashboard only")
    parser.add_argument("--platform", choices=["abr", "ue"],
                        help="Filter to specific platform")
    args = parser.parse_args()

    tracker = init_tracking(args.workspace)

    if args.dashboard:
        platform_filter = args.platform if args.platform else None
        print(tracker.generate_dashboard(platform_filter))
    else:
        for pid, p in tracker.platforms.items():
            p.compute_overall()
            logger.info(f"{p.platform_name}: {p.overall_progress:.1f}% overall")


if __name__ == "__main__":
    main()
