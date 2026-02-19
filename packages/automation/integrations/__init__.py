"""
Nzila Integrations Module

Provides integrations with external services:
- GitHub (repository management, PR automation)
- Azure DevOps (pipeline management, work items)
- Notion (documentation sync)
- Slack (notifications)

Dependency Injection
--------------------
Use ``register_integrations(container)`` to wire all four clients as lazy
singletons into any :class:`~di.Container`, decoupling call-sites from
construction details::

    from di import get_container
    from integrations import register_integrations

    container = get_container()
    register_integrations(container)

    slack = container.resolve(SlackIntegration)   # created once; reused
    github = container.resolve(GitHubIntegration)

Or use the convenience helper that returns a pre-wired container::

    from integrations import get_integration_container
    slack = get_integration_container().resolve(SlackIntegration)
"""

from .github import GitHubIntegration
from .azure import AzureDevOpsIntegration
from .notion import NotionIntegration
from .slack import SlackIntegration

# ── DI wiring ──────────────────────────────────────────────────────────────

_integration_container = None


def register_integrations(container: "Container") -> "Container":
    """Register all integrations as lazy singletons in *container*.

    Each integration reads its credentials from environment variables on first
    resolve (e.g. ``SLACK_TOKEN``, ``GITHUB_TOKEN``, ``NOTION_TOKEN``).

    Args:
        container: A :class:`~di.Container` instance to register into.

    Returns:
        The same container (for chaining).
    """
    # Import here to avoid a hard dependency if di.py is not on sys.path
    try:
        from di import Lifetime  # type: ignore[import]
    except ImportError:
        from ..di import Lifetime  # type: ignore[import]

    container.register(SlackIntegration, SlackIntegration, Lifetime.SINGLETON)
    container.register(GitHubIntegration, GitHubIntegration, Lifetime.SINGLETON)
    container.register(NotionIntegration, NotionIntegration, Lifetime.SINGLETON)
    container.register(AzureDevOpsIntegration, AzureDevOpsIntegration, Lifetime.SINGLETON)
    return container


def get_integration_container() -> "Container":
    """Return the module-level singleton integration container.

    Instantiated lazily on first call; subsequent calls return the same
    pre-wired container.
    """
    global _integration_container
    if _integration_container is None:
        try:
            from di import Container  # type: ignore[import]
        except ImportError:
            from ..di import Container  # type: ignore[import]
        _integration_container = register_integrations(Container())
    return _integration_container


# ── Public API ──────────────────────────────────────────────────────────────

__all__ = [
    "GitHubIntegration",
    "AzureDevOpsIntegration",
    "NotionIntegration",
    "SlackIntegration",
    "register_integrations",
    "get_integration_container",
]
