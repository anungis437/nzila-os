"""
Notion Integration Module

Provides integration with Notion for:
- Documentation sync
- Database management
- Page creation and updates
- Property management
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional


class NotionIntegration:
    """Notion integration for Nzila documentation management."""

    def __init__(self, token: Optional[str] = None):
        """
        Initialize Notion integration.

        Args:
            token: Notion integration token (or NOTION_TOKEN env var)
        """
        self.token = token or os.environ.get("NOTION_TOKEN")
        self.api_base = "https://api.notion.com/v1"
        self.api_version = "2022-06-28"

    def _make_request(
        self, endpoint: str, method: str = "GET", data: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Make authenticated Notion API request."""
        import urllib.error
        import urllib.request

        if not self.token:
            return {"error": "Notion token not configured", "local_mode": True}

        url = f"{self.api_base}{endpoint}"
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Notion-Version": self.api_version,
            "Content-Type": "application/json",
        }

        req = urllib.request.Request(url, headers=headers, method=method)
        if data:
            req.data = json.dumps(data).encode("utf-8")

        try:
            with urllib.request.urlopen(req) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            return {"error": f"HTTP {e.code}", "details": e.read().decode("utf-8")}

    # ==================== Database Operations ====================

    def list_databases(self) -> List[Dict[str, Any]]:
        """List all accessible databases."""
        result = self._make_request("/databases")
        return result.get("results", [])

    def create_database(
        self, parent_page_id: str, title: str, properties: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create a new database."""
        data = {
            "parent": {"page_id": parent_page_id},
            "title": [{"type": "text", "text": {"content": title}}],
            "properties": properties,
        }
        return self._make_request("/databases", "POST", data)

    def query_database(
        self,
        database_id: str,
        filter: Optional[Dict] = None,
        sorts: Optional[List[Dict]] = None,
    ) -> List[Dict[str, Any]]:
        """Query a database."""
        data = {}
        if filter:
            data["filter"] = filter
        if sorts:
            data["sorts"] = sorts

        endpoint = f"/databases/{database_id}/query"
        if data:
            result = self._make_request(endpoint, "POST", data)
        else:
            result = self._make_request(endpoint, "POST", {"page_size": 100})

        return result.get("results", [])

    # ==================== Page Operations ====================

    def create_page(
        self,
        parent: str,
        title: str,
        content: Optional[List[Dict]] = None,
        properties: Optional[Dict] = None,
        is_database: bool = False,
    ) -> Dict[str, Any]:
        """Create a new page."""
        data = {
            "parent": (
                {"page_id": parent} if not is_database else {"database_id": parent}
            ),
            "properties": properties
            or {"Name": {"title": [{"text": {"content": title}}]}},
        }

        if content:
            data["children"] = content

        return self._make_request("/pages", "POST", data)

    def get_page(self, page_id: str) -> Dict[str, Any]:
        """Get page details."""
        return self._make_request(f"/pages/{page_id}")

    def update_page(
        self, page_id: str, properties: Optional[Dict] = None, archived: bool = False
    ) -> Dict[str, Any]:
        """Update page properties."""
        data = {"archived": archived}
        if properties:
            data["properties"] = properties

        return self._make_request(f"/pages/{page_id}", "PATCH", data)

    def append_children(self, page_id: str, children: List[Dict]) -> Dict[str, Any]:
        """Add blocks to a page."""
        data = {"children": children}
        return self._make_request(f"/blocks/{page_id}/children", "PATCH", data)

    # ==================== Block Operations ====================

    def get_block_children(self, block_id: str) -> List[Dict[str, Any]]:
        """Get children of a block."""
        result = self._make_request(f"/blocks/{block_id}/children?page_size=100")
        return result.get("results", [])

    def update_block(self, block_id: str, content: Dict[str, Any]) -> Dict[str, Any]:
        """Update a block."""
        return self._make_request(f"/blocks/{block_id}", "PATCH", content)

    def delete_block(self, block_id: str) -> Dict[str, Any]:
        """Delete a block."""
        return self._make_request(f"/blocks/{block_id}", "DELETE")

    # ==================== Sync Operations ====================

    def sync_from_local(
        self,
        local_path: Path,
        parent_page_id: str,
        file_extensions: List[str] = [".md", ".txt"],
    ) -> Dict[str, Any]:
        """
        Sync local files to Notion.

        Args:
            local_path: Local directory path
            parent_page_id: Notion parent page ID
            file_extensions: File extensions to include

        Returns:
            Sync status report
        """
        if not local_path.exists():
            return {"error": "Local path not found", "path": str(local_path)}

        synced = []
        skipped = []

        for ext in file_extensions:
            for file in local_path.rglob(f"*{ext}"):
                try:
                    content = file.read_text(encoding="utf-8")

                    # Convert markdown to Notion blocks
                    blocks = self._markdown_to_blocks(content)

                    # Create page in Notion
                    page = self.create_page(
                        parent=parent_page_id, title=file.stem, content=blocks
                    )

                    synced.append(
                        {
                            "file": str(file),
                            "page_id": page.get("id"),
                            "status": "success",
                        }
                    )
                except Exception as e:
                    skipped.append({"file": str(file), "error": str(e)})

        return {
            "synced": len(synced),
            "skipped": len(skipped),
            "details": {"synced": synced, "skipped": skipped},
        }

    def _markdown_to_blocks(self, markdown: str) -> List[Dict[str, Any]]:
        """Convert markdown to Notion blocks."""
        blocks = []
        lines = markdown.split("\n")

        for line in lines:
            line = line.strip()
            if not line:
                continue

            if line.startswith("# "):
                blocks.append(
                    {
                        "object": "block",
                        "type": "heading_1",
                        "heading_1": {
                            "rich_text": [
                                {"type": "text", "text": {"content": line[2:]}}
                            ]
                        },
                    }
                )
            elif line.startswith("## "):
                blocks.append(
                    {
                        "object": "block",
                        "type": "heading_2",
                        "heading_2": {
                            "rich_text": [
                                {"type": "text", "text": {"content": line[3:]}}
                            ]
                        },
                    }
                )
            elif line.startswith("### "):
                blocks.append(
                    {
                        "object": "block",
                        "type": "heading_3",
                        "heading_3": {
                            "rich_text": [
                                {"type": "text", "text": {"content": line[4:]}}
                            ]
                        },
                    }
                )
            elif line.startswith("- "):
                blocks.append(
                    {
                        "object": "block",
                        "type": "bulleted_list_item",
                        "bulleted_list_item": {
                            "rich_text": [
                                {"type": "text", "text": {"content": line[2:]}}
                            ]
                        },
                    }
                )
            elif line.startswith("```"):
                # Code block - simplified
                continue
            else:
                blocks.append(
                    {
                        "object": "block",
                        "type": "paragraph",
                        "paragraph": {
                            "rich_text": [{"type": "text", "text": {"content": line}}]
                        },
                    }
                )

        return blocks

    def export_to_markdown(self, page_id: str) -> str:
        """Export a Notion page to markdown."""
        page = self.get_page(page_id)
        blocks = self.get_block_children(page_id)

        markdown = f"# {self._get_title(page)}\n\n"

        for block in blocks:
            block_type = block.get("type")
            content = block.get(block_type, {})

            if block_type == "heading_1":
                markdown += f"# {self._get_rich_text(content)}\n\n"
            elif block_type == "heading_2":
                markdown += f"## {self._get_rich_text(content)}\n\n"
            elif block_type == "heading_3":
                markdown += f"### {self._get_rich_text(content)}\n\n"
            elif block_type == "paragraph":
                markdown += f"{self._get_rich_text(content)}\n\n"
            elif block_type == "bulleted_list_item":
                markdown += f"- {self._get_rich_text(content)}\n"
            elif block_type == "numbered_list_item":
                markdown += f"1. {self._get_rich_text(content)}\n"
            elif block_type == "code":
                lang = content.get("language", "text")
                code = self._get_rich_text(content)
                markdown += f"```{lang}\n{code}\n```\n\n"

        return markdown

    def _get_title(self, page: Dict) -> str:
        """Extract title from page."""
        props = page.get("properties", {})
        for key, val in props.items():
            if val.get("type") == "title":
                title_arr = val.get("title", [])
                if title_arr:
                    return title_arr[0].get("plain_text", "Untitled")
        return "Untitled"

    def _get_rich_text(self, content: Dict) -> str:
        """Extract text from rich_text array."""
        rich_text = content.get("rich_text", [])
        if isinstance(rich_text, list):
            return "".join([t.get("plain_text", "") for t in rich_text])
        return str(rich_text)


# ==================== Helper Functions ====================


def create_platform_template(database_id: str, platform_data: Dict) -> Dict[str, Any]:
    """
    Create a Notion page template for a platform.

    Args:
        database_id: Database ID to create page in
        platform_data: Platform information

    Returns:
        Created page data
    """
    notion = NotionIntegration()

    properties = {
        "Platform": {
            "title": [{"text": {"content": platform_data.get("name", "Untitled")}}]
        },
        "Status": {"select": {"name": platform_data.get("status", "Planning")}},
        "Vertical": {"select": {"name": platform_data.get("vertical", "General")}},
        "Complexity": {"select": {"name": platform_data.get("complexity", "Medium")}},
        "Production Readiness": {
            "number": platform_data.get("production_readiness", 0)
        },
        "TAM": {"number": platform_data.get("tam", 0)},
    }

    # Add content blocks
    children = [
        {
            "object": "block",
            "type": "heading_2",
            "heading_2": {
                "rich_text": [{"type": "text", "text": {"content": "Overview"}}]
            },
        },
        {
            "object": "block",
            "type": "paragraph",
            "paragraph": {
                "rich_text": [
                    {
                        "type": "text",
                        "text": {"content": platform_data.get("description", "")},
                    }
                ]
            },
        },
        {
            "object": "block",
            "type": "heading_2",
            "heading_2": {
                "rich_text": [
                    {"type": "text", "text": {"content": "Technical Details"}}
                ]
            },
        },
        {
            "object": "block",
            "type": "paragraph",
            "paragraph": {
                "rich_text": [
                    {
                        "type": "text",
                        "text": {
                            "content": f"Framework: {platform_data.get('framework', 'Unknown')}"
                        },
                    }
                ]
            },
        },
    ]

    return notion.create_page(
        parent=database_id,
        title=platform_data.get("name", "New Platform"),
        properties=properties,
        content=children,
    )
