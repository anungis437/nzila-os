"""
GitHub Integration Module

Provides integration with GitHub for:
- Repository management
- Pull request automation
- Issue tracking
- Branch protection
- Release management
"""

import os
import json
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional


class GitHubIntegration:
    """GitHub integration for Nzila platform management."""
    
    def __init__(self, token: Optional[str] = None, owner: str = "anungis437"):
        """
        Initialize GitHub integration.
        
        Args:
            token: GitHub personal access token (or GITHUB_TOKEN env var)
            owner: GitHub organization/owner name
        """
        self.token = token or os.environ.get("GITHUB_TOKEN")
        self.owner = owner
        self.api_base = "https://api.github.com"
        
    def _make_request(self, endpoint: str, method: str = "GET", 
                     data: Optional[Dict] = None) -> Dict[str, Any]:
        """Make authenticated GitHub API request."""
        import urllib.request
        import urllib.error
        
        url = f"{self.api_base}{endpoint}"
        headers = {
            "Authorization": f"token {self.token}",
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json"
        }
        
        req = urllib.request.Request(url, headers=headers, method=method)
        if data:
            req.data = json.dumps(data).encode('utf-8')
            
        try:
            with urllib.request.urlopen(req) as response:
                return json.loads(response.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            return {"error": f"HTTP {e.code}: {e.reason}", "details": e.read().decode('utf-8')}
    
    def list_repos(self) -> List[Dict[str, Any]]:
        """List all repositories for the owner."""
        if not self.token:
            return self._list_local_repos()
        
        repos = self._make_request(f"/orgs/{self.owner}/repos")
        return repos if isinstance(repos, list) else []
    
    def _list_local_repos(self) -> List[Dict[str, Any]]:
        """List repositories from local filesystem."""
        workspace = Path.cwd()
        repos = []
        
        for item in workspace.iterdir():
            if item.is_dir() and (item / ".git").exists():
                repos.append({
                    "name": item.name,
                    "path": str(item),
                    "type": "local"
                })
        return repos
    
    def create_pull_request(self, repo: str, title: str, body: str,
                           head: str, base: str = "main") -> Dict[str, Any]:
        """
        Create a pull request.
        
        Args:
            repo: Repository name
            title: PR title
            body: PR description
            head: Source branch
            base: Target branch
            
        Returns:
            PR details or error
        """
        data = {
            "title": title,
            "body": body,
            "head": head,
            "base": base
        }
        return self._make_request(f"/repos/{self.owner}/{repo}/pulls", "POST", data)
    
    def get_pull_requests(self, repo: str, state: str = "open") -> List[Dict[str, Any]]:
        """
        Get pull requests for a repository.
        
        Args:
            repo: Repository name
            state: PR state (open, closed, all)
            
        Returns:
            List of pull requests
        """
        prs = self._make_request(f"/repos/{self.owner}/{repo}/pulls?state={state}")
        return prs if isinstance(prs, list) else []
    
    def create_issue(self, repo: str, title: str, body: str,
                    labels: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Create an issue.
        
        Args:
            repo: Repository name
            title: Issue title
            body: Issue description
            labels: Issue labels
            
        Returns:
            Issue details or error
        """
        data = {"title": title, "body": body}
        if labels:
            data["labels"] = labels
            
        return self._make_request(f"/repos/{self.owner}/{repo}/issues", "POST", data)
    
    def list_issues(self, repo: str, state: str = "open") -> List[Dict[str, Any]]:
        """List issues for a repository."""
        issues = self._make_request(f"/repos/{self.owner}/{repo}/issues?state={state}")
        return issues if isinstance(issues, list) else []
    
    def create_release(self, repo: str, tag: str, name: str, 
                      body: str, draft: bool = False) -> Dict[str, Any]:
        """Create a new release."""
        data = {
            "tag_name": tag,
            "name": name,
            "body": body,
            "draft": draft
        }
        return self._make_request(f"/repos/{self.owner}/{repo}/releases", "POST", data)
    
    def get_latest_release(self, repo: str) -> Optional[Dict[str, Any]]:
        """Get the latest release for a repository."""
        release = self._make_request(f"/repos/{self.owner}/{repo}/releases/latest")
        return release if "error" not in release else None
    
    def setup_branch_protection(self, repo: str, branch: str = "main",
                               require_reviews: bool = True,
                               required_approvals: int = 2) -> Dict[str, Any]:
        """Setup branch protection rules."""
        data = {
            "required_status_checks": {
                "strict": True,
                "contexts": ["ci/test", "ci/build"]
            },
            "required_review_requested_reviews": {
                "required_approving_review_count": required_approvals
            },
            "enforce_admins": True,
            "allow_force_pushes": False,
            "allow_deletions": False
        }
        return self._make_request(
            f"/repos/{self.owner}/{repo}/branches/{branch}/protection",
            "PUT", data
        )
    
    def sync_with_local(self, repo_path: Path) -> Dict[str, Any]:
        """
        Sync local repository with GitHub.
        
        Args:
            repo_path: Path to local repository
            
        Returns:
            Sync status
        """
        if not repo_path.exists():
            return {"error": "Repository not found", "path": str(repo_path)}
        
        # Get git status
        try:
            result = subprocess.run(
                ["git", "status", "--porcelain"],
                cwd=repo_path,
                capture_output=True,
                text=True
            )
            
            staged = len([l for l in result.stdout.split('\n') if l.startswith('M') or l.startswith('A')])
            unstaged = len([l for l in result.stdout.split('\n') if l.startswith('??')])
            
            return {
                "repo": repo_path.name,
                "path": str(repo_path),
                "staged_changes": staged,
                "untracked_files": unstaged,
                "status": "ready" if staged > 0 else "clean"
            }
        except Exception as e:
            return {"error": str(e), "path": str(repo_path)}
    
    def get_commit_history(self, repo: str, path: str = "",
                          since: Optional[datetime] = None) -> List[Dict[str, Any]]:
        """Get commit history for a repository or path."""
        endpoint = f"/repos/{self.owner}/{repo}/commits"
        params = []
        if path:
            params.append(f"path={path}")
        if since:
            params.append(f"since={since.isoformat()}")
        
        if params:
            endpoint += "?" + "&".join(params)
            
        commits = self._make_request(endpoint)
        return commits if isinstance(commits, list) else []


def create_github_workflow(platform_name: str, framework: str = "nextjs") -> str:
    """
    Generate a GitHub Actions workflow file.
    
    Args:
        platform_name: Name of the platform
        framework: Framework type (nextjs, react, node, python)
        
    Returns:
        YAML workflow content
    """
    workflows = {
        "nextjs": """name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '18'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      
      - name: Setup Node.js
        uses: actions/setup-node@v5
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test -- --coverage
      
      - name: Build
        run: npm run build

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      
      - name: Deploy to Azure
        uses: azure/webapps-deploy@v3
        with:
          app-name: {platform}
          publish-profile: ${{ secrets.AZURE_PUBLISH_PROFILE }}
""".format(platform=platform_name),
        
        "python": """name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt
      
      - name: Run tests
        run: pytest --cov=. --cov-report=xml
      
      - name: Build
        run: python -m build
""",
        
        "react": """name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '18'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      
      - name: Setup Node.js
        uses: actions/setup-node@v5
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Build
        run: npm run build
"""
    }
    
    return workflows.get(framework, workflows["nextjs"])
