#!/usr/bin/env python3
"""
Pattern Extractor — Identifies reusable code patterns across platforms

This module analyzes codebases to extract:
- Common authentication patterns
- Shared database utilities
- Reusable API clients
- Common UI components
- Utility functions
- Configuration patterns

Goal: Achieve >60% code reuse across platform migrations
"""

import json
import re
from pathlib import Path
from typing import Dict, List, Set, Optional, Any
from dataclasses import dataclass, asdict
from collections import defaultdict
import hashlib

try:
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from logging_config import MigrationLogger, LogOperation
    logger = MigrationLogger.get_logger(__name__)
except ImportError:
    import logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)
    class LogOperation:
        def __init__(self, *args, **kwargs): pass
        def __enter__(self): return self
        def __exit__(self, *args): pass


@dataclass
class CodePattern:
    """Represents a reusable code pattern"""
    pattern_id: str
    category: str  # auth, database, api-client, ui-component, utility, config
    name: str
    description: str
    language: str  # TypeScript, Python, JavaScript
    code_snippet: str
    hash: str
    occurrences: int = 0
    platforms: List[str] = None
    file_paths: List[str] = None
    complexity: str = "SIMPLE"  # SIMPLE, MODERATE, COMPLEX
    reusability_score: float = 0.0  # 0.0-1.0
    
    def __post_init__(self):
        if self.platforms is None:
            self.platforms = []
        if self.file_paths is None:
            self.file_paths = []


@dataclass
class PatternLibrary:
    """Collection of extracted patterns"""
    patterns: List[CodePattern]
    total_platforms: int
    reuse_percentage: float
    categories: Dict[str, int]
    
    def get_by_category(self, category: str) -> List[CodePattern]:
        """Get all patterns in a category"""
        return [p for p in self.patterns if p.category == category]
    
    def get_high_value_patterns(self, min_reusability: float = 0.7) -> List[CodePattern]:
        """Get patterns with high reusability scores"""
        return [p for p in self.patterns if p.reusability_score >= min_reusability]


class PatternExtractor:
    """Extracts reusable code patterns from platforms"""
    
    def __init__(self, legacy_root: Path = None, platforms_dir: Path = None):
        """Initialize pattern extractor
        
        Args:
            legacy_root: Root directory containing legacy platforms
            platforms_dir: Alias for legacy_root (for compatibility)
        """
        if platforms_dir is not None:
            self.legacy_root = Path(platforms_dir)
        elif legacy_root is not None:
            self.legacy_root = Path(legacy_root)
        else:
            # Default for testing
            import tempfile
            self.legacy_root = Path(tempfile.gettempdir()) / "pattern_extractor_test"
            self.legacy_root.mkdir(exist_ok=True)
        
        self.platforms_dir = self.legacy_root  # Alias for compatibility
        self.patterns: Dict[str, CodePattern] = {}
        self.pattern_hashes: Dict[str, str] = {}  # hash -> pattern_id
        logger.info(f"Initialized PatternExtractor for: {self.legacy_root}")
    
    def extract_all(self, platform_dirs: List[Path]) -> PatternLibrary:
        """Extract patterns from all platforms"""
        with LogOperation(logger, "extract_patterns", platforms=len(platform_dirs)):
            # Extract patterns from each platform
            for platform_dir in platform_dirs:
                try:
                    logger.info(f"Extracting patterns from {platform_dir.name}")
                    self._extract_from_platform(platform_dir)
                except Exception as e:
                    logger.error(f"Failed to extract from {platform_dir.name}: {e}")
            
            # Calculate reusability scores
            self._calculate_reusability_scores(len(platform_dirs))
            
            # Build library
            library = self._build_library(len(platform_dirs))
            
            logger.info(
                f"Extracted {len(library.patterns)} patterns with "
                f"{library.reuse_percentage:.1f}% reusability"
            )
            return library
    
    def _extract_from_platform(self, platform_dir: Path):
        """Extract patterns from a single platform"""
        platform_id = platform_dir.name
        
        # Extract different pattern types
        self._extract_auth_patterns(platform_dir, platform_id)
        self._extract_database_patterns(platform_dir, platform_id)
        self._extract_api_client_patterns(platform_dir, platform_id)
        self._extract_utility_patterns(platform_dir, platform_id)
        self._extract_config_patterns(platform_dir, platform_id)
    
    def _extract_auth_patterns(self, platform_dir: Path, platform_id: str):
        """Extract authentication patterns"""
        
        # Clerk auth patterns
        clerk_files = list(platform_dir.glob("**/middleware.ts"))[:5]
        for file_path in clerk_files:
            if self._is_ignored(file_path):
                continue
            
            try:
                content = file_path.read_text(encoding='utf-8', errors='ignore')
                
                # Clerk middleware pattern
                if "clerkMiddleware" in content or "authMiddleware" in content:
                    pattern = self._create_pattern(
                        category="auth",
                        name="Clerk Middleware",
                        description="Standard Clerk authentication middleware for Next.js",
                        language="TypeScript",
                        code_snippet=self._extract_function(content, "clerkMiddleware|authMiddleware"),
                        platform_id=platform_id,
                        file_path=str(file_path.relative_to(platform_dir))
                    )
                    self._add_pattern(pattern)
            
            except Exception as e:
                logger.debug(f"Error extracting auth patterns from {file_path}: {e}")
        
        # Clerk hooks patterns
        clerk_hook_files = list(platform_dir.glob("**/use-*.ts"))[:10]
        for file_path in clerk_hook_files:
            if self._is_ignored(file_path) or "node_modules" in str(file_path):
                continue
            
            try:
                content = file_path.read_text(encoding='utf-8', errors='ignore')
                
                if "useUser" in content or "useAuth" in content:
                    pattern = self._create_pattern(
                        category="auth",
                        name="Clerk Auth Hooks",
                        description="React hooks for Clerk authentication state",
                        language="TypeScript",
                        code_snippet=self._extract_hook(content, "useUser|useAuth"),
                        platform_id=platform_id,
                        file_path=str(file_path.relative_to(platform_dir))
                    )
                    self._add_pattern(pattern)
            
            except Exception as e:
                logger.debug(f"Error extracting hook patterns from {file_path}: {e}")
    
    def _extract_database_patterns(self, platform_dir: Path, platform_id: str):
        """Extract database utility patterns"""
        
        # Drizzle connection patterns
        db_files = list(platform_dir.glob("**/db.ts")) + list(platform_dir.glob("**/database.ts"))
        for file_path in db_files[:5]:
            if self._is_ignored(file_path):
                continue
            
            try:
                content = file_path.read_text(encoding='utf-8', errors='ignore')
                
                # Drizzle client initialization
                if "drizzle" in content.lower():
                    pattern = self._create_pattern(
                        category="database",
                        name="Drizzle Database Client",
                        description="PostgreSQL client initialization with Drizzle ORM",
                        language="TypeScript",
                        code_snippet=self._extract_function(content, "drizzle"),
                        platform_id=platform_id,
                        file_path=str(file_path.relative_to(platform_dir))
                    )
                    self._add_pattern(pattern)
            
            except Exception as e:
                logger.debug(f"Error extracting database patterns from {file_path}: {e}")
        
        # Django database utilities
        utils_files = list(platform_dir.glob("**/utils.py")) + list(platform_dir.glob("**/db_utils.py"))
        for file_path in utils_files[:5]:
            if self._is_ignored(file_path):
                continue
            
            try:
                content = file_path.read_text(encoding='utf-8', errors='ignore')
                
                # Transaction management
                if "transaction.atomic" in content:
                    pattern = self._create_pattern(
                        category="database",
                        name="Django Transaction Utility",
                        description="Database transaction management helper",
                        language="Python",
                        code_snippet=self._extract_function(content, "transaction"),
                        platform_id=platform_id,
                        file_path=str(file_path.relative_to(platform_dir))
                    )
                    self._add_pattern(pattern)
            
            except Exception as e:
                logger.debug(f"Error extracting Django utils from {file_path}: {e}")
    
    def _extract_api_client_patterns(self, platform_dir: Path, platform_id: str):
        """Extract API client patterns"""
        
        # Fetch wrappers
        api_files = list(platform_dir.glob("**/api/**/*.ts")) + list(platform_dir.glob("**/services/**/*.ts"))
        for file_path in api_files[:10]:
            if self._is_ignored(file_path):
                continue
            
            try:
                content = file_path.read_text(encoding='utf-8', errors='ignore')
                
                # Fetch wrapper with error handling
                if re.search(r'async\s+function\s+\w+\s*\([^)]*\)\s*{[^}]*fetch\(', content):
                    pattern = self._create_pattern(
                        category="api-client",
                        name="Fetch API Wrapper",
                        description="Typed fetch wrapper with error handling",
                        language="TypeScript",
                        code_snippet=self._extract_function(content, "fetch"),
                        platform_id=platform_id,
                        file_path=str(file_path.relative_to(platform_dir))
                    )
                    self._add_pattern(pattern)
            
            except Exception as e:
                logger.debug(f"Error extracting API patterns from {file_path}: {e}")
    
    def _extract_utility_patterns(self, platform_dir: Path, platform_id: str):
        """Extract utility function patterns"""
        
        # Common utilities
        util_patterns = {
            "formatDate": ("Date Formatter", "Date formatting utility", "TypeScript"),
            "formatCurrency": ("Currency Formatter", "Currency formatting utility", "TypeScript"),
            "debounce": ("Debounce Function", "Input debouncing utility", "TypeScript"),
            "throttle": ("Throttle Function", "Function throttling utility", "TypeScript"),
            "cn": ("Class Name Merger", "Tailwind class name merger (cn)", "TypeScript"),
        }
        
        util_files = list(platform_dir.glob("**/utils/**/*.ts")) + list(platform_dir.glob("**/lib/**/*.ts"))
        for file_path in util_files[:15]:
            if self._is_ignored(file_path):
                continue
            
            try:
                content = file_path.read_text(encoding='utf-8', errors='ignore')
                
                for func_name, (name, desc, lang) in util_patterns.items():
                    if func_name in content:
                        pattern = self._create_pattern(
                            category="utility",
                            name=name,
                            description=desc,
                            language=lang,
                            code_snippet=self._extract_function(content, func_name),
                            platform_id=platform_id,
                            file_path=str(file_path.relative_to(platform_dir))
                        )
                        self._add_pattern(pattern)
            
            except Exception as e:
                logger.debug(f"Error extracting utility patterns from {file_path}: {e}")
    
    def _extract_config_patterns(self, platform_dir: Path, platform_id: str):
        """Extract configuration patterns"""
        
        # Environment config
        env_example = platform_dir / ".env.example"
        if env_example.exists():
            try:
                content = env_example.read_text(encoding='utf-8', errors='ignore')
                
                pattern = self._create_pattern(
                    category="config",
                    name="Environment Configuration Template",
                    description="Standard environment variables template",
                    language="Shell",
                    code_snippet=content[:500],  # First 500 chars
                    platform_id=platform_id,
                    file_path=".env.example"
                )
                self._add_pattern(pattern)
            
            except Exception as e:
                logger.debug(f"Error extracting config from .env.example: {e}")
        
        # Tailwind config
        tailwind_config = platform_dir / "tailwind.config.ts"
        if tailwind_config.exists():
            try:
                content = tailwind_config.read_text(encoding='utf-8', errors='ignore')
                
                pattern = self._create_pattern(
                    category="config",
                    name="Tailwind CSS Configuration",
                    description="Tailwind CSS theme and plugin configuration",
                    language="TypeScript",
                    code_snippet=content[:800],
                    platform_id=platform_id,
                    file_path="tailwind.config.ts"
                )
                self._add_pattern(pattern)
            
            except Exception as e:
                logger.debug(f"Error extracting Tailwind config: {e}")
    
    def _create_pattern(
        self,
        category: str,
        name: str,
        description: str,
        language: str,
        code_snippet: str,
        platform_id: str,
        file_path: str
    ) -> CodePattern:
        """Create a code pattern"""
        # Generate hash from code (normalize whitespace first)
        normalized_code = re.sub(r'\s+', ' ', code_snippet.strip())
        code_hash = hashlib.sha256(normalized_code.encode()).hexdigest()[:12]
        
        pattern_id = f"{category}_{name.lower().replace(' ', '_')}_{code_hash[:6]}"
        
        pattern = CodePattern(
            pattern_id=pattern_id,
            category=category,
            name=name,
            description=description,
            language=language,
            code_snippet=code_snippet[:1000],  # Limit snippet length
            hash=code_hash,
            platforms=[platform_id],
            file_paths=[file_path]
        )
        
        # Assess complexity
        pattern.complexity = self._assess_complexity(code_snippet)
        
        return pattern
    
    def _add_pattern(self, pattern: CodePattern):
        """Add pattern to collection (deduplicate by hash)"""
        if pattern.hash in self.pattern_hashes:
            # Pattern already exists, increment occurrence
            existing_id = self.pattern_hashes[pattern.hash]
            existing = self.patterns[existing_id]
            existing.occurrences += 1
            if pattern.platforms[0] not in existing.platforms:
                existing.platforms.append(pattern.platforms[0])
            if pattern.file_paths[0] not in existing.file_paths:
                existing.file_paths.append(pattern.file_paths[0])
        else:
            # New pattern
            pattern.occurrences = 1
            self.patterns[pattern.pattern_id] = pattern
            self.pattern_hashes[pattern.hash] = pattern.pattern_id
    
    def _extract_function(self, content: str, func_pattern: str) -> str:
        """Extract function code by pattern"""
        # Simple extraction (could be more sophisticated with AST parsing)
        match = re.search(
            rf'(export\s+)?(async\s+)?function\s+({func_pattern})[^{{]*\{{',
            content,
            re.IGNORECASE
        )
        if match:
            start = match.start()
            # Find matching closing brace (simplified)
            snippet = content[start:start+500]
            return snippet.strip()
        return content[:300]  # Fallback
    
    def _extract_hook(self, content: str, hook_pattern: str) -> str:
        """Extract React hook code"""
        match = re.search(
            rf'export\s+(const|function)\s+({hook_pattern})[^{{]*\{{',
            content,
            re.IGNORECASE
        )
        if match:
            start = match.start()
            snippet = content[start:start+400]
            return snippet.strip()
        return content[:300]
    
    def _assess_complexity(self, code: str) -> str:
        """Assess pattern complexity"""
        lines = len(code.split('\n'))
        
        if lines > 50:
            return "COMPLEX"
        elif lines > 20:
            return "MODERATE"
        else:
            return "SIMPLE"
    
    def _calculate_reusability_scores(self, total_platforms: int):
        """Calculate reusability score for each pattern"""
        for pattern in self.patterns.values():
            # Score based on:
            # 1. Number of platforms using it (40%)
            # 2. Number of occurrences (30%)
            # 3. Simplicity (30%)
            
            platform_score = len(pattern.platforms) / total_platforms
            occurrence_score = min(pattern.occurrences / 10, 1.0)
            
            complexity_scores = {"SIMPLE": 1.0, "MODERATE": 0.7, "COMPLEX": 0.4}
            complexity_score = complexity_scores[pattern.complexity]
            
            pattern.reusability_score = (
                platform_score * 0.4 +
                occurrence_score * 0.3 +
                complexity_score * 0.3
            )
    
    def _build_library(self, total_platforms: int) -> PatternLibrary:
        """Build pattern library from extracted patterns"""
        patterns_list = list(self.patterns.values())
        
        # Calculate category distribution
        categories = defaultdict(int)
        for pattern in patterns_list:
            categories[pattern.category] += 1
        
        # Calculate reuse percentage
        total_occurrences = sum(p.occurrences for p in patterns_list)
        reusable_occurrences = sum(p.occurrences for p in patterns_list if p.occurrences > 1)
        reuse_percentage = (reusable_occurrences / total_occurrences * 100) if total_occurrences > 0 else 0
        
        return PatternLibrary(
            patterns=patterns_list,
            total_platforms=total_platforms,
            reuse_percentage=reuse_percentage,
            categories=dict(categories)
        )
    
    def _is_ignored(self, path: Path) -> bool:
        """Check if path should be ignored"""
        ignore_patterns = [
            "node_modules", "__pycache__", ".git", "dist", "build",
            ".next", ".turbo", "venv", "env", ".venv", "test", "spec"
        ]
        return any(pattern in str(path) for pattern in ignore_patterns)
    
    def export_library(self, library: PatternLibrary, output_path: Path):
        """Export pattern library to JSON"""
        data = asdict(library)
        with open(output_path, "w", encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        logger.info(f"Exported pattern library to {output_path}")
        print(f"\n✓ Exported {len(library.patterns)} patterns to {output_path}")
    
    def generate_report(self, library: PatternLibrary) -> str:
        """Generate human-readable pattern report"""
        report = []
        report.append("="*80)
        report.append("PATTERN LIBRARY REPORT")
        report.append("="*80)
        report.append(f"Total Patterns: {len(library.patterns)}")
        report.append(f"Reuse Percentage: {library.reuse_percentage:.1f}%")
        report.append(f"Total Platforms: {library.total_platforms}")
        report.append("")
        
        report.append("CATEGORY DISTRIBUTION:")
        for category, count in library.categories.items():
            report.append(f"  {category}: {count} patterns")
        report.append("")
        
        report.append("TOP 10 HIGH-VALUE PATTERNS:")
        high_value = sorted(
            library.patterns,
            key=lambda p: p.reusability_score,
            reverse=True
        )[:10]
        
        for i, pattern in enumerate(high_value, 1):
            report.append(
                f"{i}. {pattern.name} ({pattern.category})"
            )
            report.append(f"   Reusability: {pattern.reusability_score:.2f}")
            report.append(f"   Platforms: {len(pattern.platforms)} ({', '.join(pattern.platforms[:3])}...)")
            report.append(f"   Occurrences: {pattern.occurrences}")
            report.append("")
        
        return "\n".join(report)


def main():
    """Main entry point"""
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python pattern_extractor.py <legacy-root-path> [output.json]")
        sys.exit(1)
    
    legacy_root = Path(sys.argv[1])
    output_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("pattern_library.json")
    
    # Set up logging
    log_dir = Path(__file__).parent.parent / "logs"
    MigrationLogger.setup(log_level="INFO", log_dir=log_dir)
    
    # Get all platform directories
    platform_dirs = [d for d in legacy_root.iterdir() if d.is_dir() and not d.name.startswith(".")]
    
    logger.info(f"Extracting patterns from {len(platform_dirs)} platforms")
    
    extractor = PatternExtractor(legacy_root)
    library = extractor.extract_all(platform_dirs)
    
    # Export library
    extractor.export_library(library, output_path)
    
    # Generate and print report
    report = extractor.generate_report(library)
    print(report)
    
    # Save report
    report_path = output_path.parent / "pattern_library_report.md"
    with open(report_path, "w", encoding='utf-8') as f:
        f.write(report)
    print(f"\n✓ Saved report to {report_path}")


if __name__ == "__main__":
    main()
