"""
Core Pipeline Modules
======================
Schema parsing, code generation, dependency analysis, platform analysis,
and progress tracking for the Nzila migration pipeline.
"""

from .code_generator import (
    CodeGenerator,
    SQLSchemaParser,
    DrizzleSchemaParser,
    DjangoCodeTemplates,
    ColumnDef,
    TableDef,
    run_abr_generation,
    run_ue_generation,
)

from .dependency_analyzer import (
    DependencyAnalyzer,
    DependencyCategory,
    MigrationTarget,
    PackageInfo,
    DependencyReport,
    analyze_abr_dependencies,
    analyze_ue_dependencies,
)

from .progress_tracker import (
    ProgressTracker,
    MigrationPhase,
    PhaseStatus,
    QualityGateStatus,
    PhaseProgress,
    PlatformProgress,
    init_tracking,
)

__all__ = [
    "CodeGenerator",
    "SQLSchemaParser",
    "DrizzleSchemaParser",
    "DjangoCodeTemplates",
    "ColumnDef",
    "TableDef",
    "run_abr_generation",
    "run_ue_generation",
    "DependencyAnalyzer",
    "DependencyCategory",
    "MigrationTarget",
    "PackageInfo",
    "DependencyReport",
    "analyze_abr_dependencies",
    "analyze_ue_dependencies",
    "ProgressTracker",
    "MigrationPhase",
    "PhaseStatus",
    "QualityGateStatus",
    "PhaseProgress",
    "PlatformProgress",
    "init_tracking",
]
