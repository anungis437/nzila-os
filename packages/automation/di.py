"""
Dependency Injection Container for Nzila Automation

Provides a simple dependency injection container to reduce tight coupling
between modules. This allows for easier testing and mocking of dependencies.
"""

from typing import TypeVar, Type, Callable, Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum


T = TypeVar('T')


class Lifetime(Enum):
    """Dependency lifetime."""
    TRANSIENT = "transient"  # New instance each time
    SINGLETON = "singleton"  # Same instance each time


@dataclass
class Dependency:
    """Represents a registered dependency."""
    factory: Callable[..., Any]
    lifetime: Lifetime = Lifetime.TRANSIENT
    instance: Optional[Any] = None  # For singletons


class Container:
    """
    Simple dependency injection container.
    
    Usage:
        container = Container()
        
        # Register a dependency
        container.register(StripeClient, lambda: StripeClient(api_key))
        
        # Register a singleton
        container.register_singleton(ConfigService, ConfigService())
        
        # Resolve a dependency
        client = container.resolve(StripeClient)
    """
    
    def __init__(self):
        self._dependencies: Dict[Type, Dependency] = {}
        self._parent: Optional["Container"] = None
    
    def register(
        self, 
        interface: Type[T], 
        factory: Callable[..., T],
        lifetime: Lifetime = Lifetime.TRANSIENT
    ) -> None:
        """Register a dependency with a factory function."""
        self._dependencies[interface] = Dependency(
            factory=factory,
            lifetime=lifetime
        )
    
    def register_singleton(self, interface: Type[T], instance: T) -> None:
        """Register a singleton instance."""
        self._dependencies[interface] = Dependency(
            factory=lambda: instance,
            lifetime=Lifetime.SINGLETON,
            instance=instance
        )
    
    def register_instance(self, interface: Type[T], instance: T) -> None:
        """Register an existing instance (alias for register_singleton)."""
        self.register_singleton(interface, instance)
    
    def resolve(self, interface: Type[T]) -> T:
        """Resolve a dependency."""
        if interface not in self._dependencies:
            # Try parent container
            if self._parent:
                return self._parent.resolve(interface)
            raise KeyError(f"Dependency not registered: {interface}")
        
        dep = self._dependencies[interface]
        
        if dep.lifetime == Lifetime.SINGLETON:
            if dep.instance is None:
                dep.instance = dep.factory()
            return dep.instance
        
        return dep.factory()
    
    def create_scope(self) -> "Container":
        """Create a new scoped container."""
        scope = Container()
        scope._parent = self
        return scope
    
    def clear(self) -> None:
        """Clear all registered dependencies."""
        self._dependencies.clear()


# ──────────────────────────────────────────────────────────────────
# Global container instance
# ──────────────────────────────────────────────────────────────────

_container: Optional[Container] = None


def get_container() -> Container:
    """Get the global container instance."""
    global _container
    if _container is None:
        _container = Container()
    return _container


def reset_container() -> None:
    """Reset the global container (useful for testing)."""
    global _container
    _container = None


# ──────────────────────────────────────────────────────────────────
# Decorator for injecting dependencies
# ──────────────────────────────────────────────────────────────────

def inject(interface: Type[T]) -> T:
    """
    Resolve a dependency from the global container.

    Use as a default parameter value to achieve constructor-style injection::

        def my_function(
            stripe_client: StripeClient = inject(StripeClient),
        ) -> None:
            ...
    """
    return get_container().resolve(interface)


def provides(interface: Type[T], lifetime: Lifetime = Lifetime.SINGLETON):
    """
    Class / function decorator that registers the decorated callable as the
    factory for *interface* in the global container.

    Usage::

        @provides(IEmailSender)
        class SmtpEmailSender:
            ...
    """
    def decorator(factory):
        get_container().register(interface, factory, lifetime=lifetime)
        return factory
    return decorator


# ──────────────────────────────────────────────────────────────────
# Example: Register common dependencies
# ──────────────────────────────────────────────────────────────────

def register_default_dependencies():
    """Register default dependencies in the global container."""
    from config import get_config, PathConfig

    container = get_container()

    # Register PathConfig singleton — resolved by callers via inject(PathConfig)
    container.register_singleton(PathConfig, get_config())

    # Note: register additional singletons here as the system grows:
    # from analyzers.platform_analyzer import PlatformAnalyzer
    # container.register(PlatformAnalyzer, PlatformAnalyzer, lifetime=Lifetime.SINGLETON)


# Convenience function for setting up the container
def setup_dependencies():
    """Initialize the dependency container with defaults."""
    register_default_dependencies()
