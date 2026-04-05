#!/usr/bin/env python3
"""
Nzila Vertical App Scaffold Generator

Creates a new vertical app from template with:
- Django backend
- Next.js frontend
- GitHub Actions CI/CD
- Docker configuration
- Environment templates
"""

import argparse
import os
import re
import shutil
import sys
from pathlib import Path
from typing import Dict, List

TEMPLATE_DIR = Path(__file__).parent


def to_kebab_case(text: str) -> str:
    """Convert text to kebab-case."""
    text = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1-\2", text)
    text = re.sub(r"([a-z\d])([A-Z])", r"\1-\2", text)
    return text.lower().replace(" ", "-")


def to_snake_case(text: str) -> str:
    """Convert text to snake_case."""
    text = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1_\2", text)
    text = re.sub(r"([a-z\d])([A-Z])", r"\1_\2", text)
    return text.lower().replace(" ", "_")


def to_pascal_case(text: str) -> str:
    """Convert text to PascalCase."""
    return "".join(word.capitalize() for word in re.split(r"[-_\s]+", text))


def replace_in_file(file_path: Path, replacements: Dict[str, str]) -> None:
    """Replace placeholders in a file."""
    if not file_path.exists():
        return

    content = file_path.read_text(encoding="utf-8")

    for placeholder, value in replacements.items():
        content = content.replace(placeholder, value)

    file_path.write_text(content, encoding="utf-8")


def copy_template(src: Path, dst: Path, replacements: Dict[str, str]) -> None:
    """Copy template directory with replacements."""
    if src.is_dir():
        dst.mkdir(parents=True, exist_ok=True)

        # Copy all files and subdirectories
        for item in src.iterdir():
            if item.name == "__pycache__":
                continue

            new_dst = dst / item.name

            if item.is_dir():
                copy_template(item, new_dst, replacements)
            else:
                shutil.copy2(item, new_dst)

                # Replace placeholders in certain file types
                if item.suffix in [
                    ".py",
                    ".js",
                    ".ts",
                    ".json",
                    ".yml",
                    ".yaml",
                    ".txt",
                    ".md",
                    ".example",
                ]:
                    replace_in_file(new_dst, replacements)
    else:
        shutil.copy2(src, dst)


def scaffold_vertical(
    product_name: str, repo_name: str, vertical: str, output_dir: Path = None
) -> Path:
    """Create a new vertical app from template."""

    # Calculate names
    kebab_name = to_kebab_case(product_name)
    snake_name = to_snake_case(product_name)
    pascal_name = to_pascal_case(product_name)
    repo_name_kebab = to_kebab_case(repo_name)

    replacements = {
        "{{product_name}}": product_name,
        "{{project_name}}": snake_name,
        "{{PascalName}}": pascal_name,
        "{{kebab-name}}": kebab_name,
        "{{repo_name}}": repo_name_kebab,
        "{{vertical}}": vertical,
    }

    # Determine output directory
    if output_dir is None:
        output_dir = Path.cwd()

    target = output_dir / repo_name_kebab

    # Get template source
    template_dir = TEMPLATE_DIR

    print(f"� Scaffold: {product_name} ({vertical})")
    print(f"   Output: {target}")

    # Copy template
    copy_template(template_dir / "backend", target / "backend", replacements)
    copy_template(template_dir / "frontend", target / "frontend", replacements)
    copy_template(template_dir / ".github", target / ".github", replacements)

    # Create additional files
    (target / "README.md").write_text(
        f"""# {product_name}

{vertical} platform built on Nzila infrastructure.

## Quick Start

```bash
# Setup
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Development
docker-compose -f backend/docker-compose.yml up -d

# Frontend
cd frontend && pnpm install && pnpm dev
```

## Architecture

- **Frontend:** Next.js 14 with TypeScript
- **Backend:** Django 5.1 with DRF
- **Auth:** OIDC (Microsoft Entra External ID)
- **Infrastructure:** Azure

## CI/CD

GitHub Actions workflows in `.github/workflows/`

## License

Proprietary - Nzila Ventures
""",
        encoding="utf-8",
    )

    print(f"✅ Scaffold complete: {target}")
    return target


def main():
    parser = argparse.ArgumentParser(description="Scaffold a new Nzila vertical app")
    parser.add_argument(
        "--product-name", required=True, help='Product name (e.g., "CongoWave")'
    )
    parser.add_argument(
        "--repo-name", required=True, help='Repository name (e.g., "congowave-app")'
    )
    parser.add_argument(
        "--vertical",
        required=True,
        choices=[
            "fintech",
            "agrotech",
            "healthtech",
            "edtech",
            "legaltech",
            "entertainment",
            "tradetech",
            "uniontech",
        ],
        help="Business vertical",
    )
    parser.add_argument(
        "--output", type=Path, help="Output directory (default: current directory)"
    )

    args = parser.parse_args()

    scaffold_vertical(
        product_name=args.product_name,
        repo_name=args.repo_name,
        vertical=args.vertical,
        output_dir=args.output,
    )


if __name__ == "__main__":
    main()
