"""Tests for di.py – Dependency injection container."""

import pytest
from di import (
    Container,
    Dependency,
    Lifetime,
    get_container,
    inject,
    provides,
    register_default_dependencies,
    reset_container,
    setup_dependencies,
)


@pytest.fixture(autouse=True)
def _clean_container():
    """Ensure a fresh global container for every test."""
    reset_container()
    yield
    reset_container()


# ── Lifetime enum ───────────────────────────────────────────────────────────


class TestLifetime:
    def test_transient(self):
        assert Lifetime.TRANSIENT.value == "transient"

    def test_singleton(self):
        assert Lifetime.SINGLETON.value == "singleton"


# ── Dependency dataclass ────────────────────────────────────────────────────


class TestDependency:
    def test_defaults(self):
        d = Dependency(factory=int)
        assert d.lifetime == Lifetime.TRANSIENT
        assert d.instance is None

    def test_singleton_instance(self):
        d = Dependency(factory=int, lifetime=Lifetime.SINGLETON, instance=42)
        assert d.instance == 42


# ── Container ───────────────────────────────────────────────────────────────


class TestContainer:
    def test_register_and_resolve_transient(self):
        c = Container()
        counter = {"n": 0}

        def factory():
            counter["n"] += 1
            return counter["n"]

        c.register(int, factory, Lifetime.TRANSIENT)
        assert c.resolve(int) == 1
        assert c.resolve(int) == 2  # new instance each time

    def test_register_singleton(self):
        c = Container()
        obj = {"key": "value"}
        c.register_singleton(dict, obj)
        assert c.resolve(dict) is obj  # same object

    def test_register_instance(self):
        c = Container()
        obj = [1, 2, 3]
        c.register_instance(list, obj)
        assert c.resolve(list) is obj

    def test_register_with_singleton_lifetime_lazy(self):
        c = Container()
        calls = []

        def factory():
            calls.append(1)
            return "singleton_val"

        c.register(str, factory, Lifetime.SINGLETON)
        first = c.resolve(str)
        second = c.resolve(str)
        assert first == second == "singleton_val"
        assert len(calls) == 1  # factory called only once

    def test_resolve_unknown_raises(self):
        c = Container()
        with pytest.raises(KeyError, match="Dependency not registered"):
            c.resolve(float)

    def test_create_scope(self):
        parent = Container()
        parent.register_singleton(str, "parent_value")

        child = parent.create_scope()
        # child inherits from parent
        assert child.resolve(str) == "parent_value"

    def test_scope_override(self):
        parent = Container()
        parent.register_singleton(str, "parent")

        child = parent.create_scope()
        child.register_singleton(str, "child")
        assert child.resolve(str) == "child"

    def test_clear(self):
        c = Container()
        c.register_singleton(str, "val")
        c.clear()
        with pytest.raises(KeyError):
            c.resolve(str)


# ── Global helpers ──────────────────────────────────────────────────────────


class TestGlobalHelpers:
    def test_get_container_returns_same_instance(self):
        c1 = get_container()
        c2 = get_container()
        assert c1 is c2

    def test_reset_container(self):
        c1 = get_container()
        reset_container()
        c2 = get_container()
        assert c1 is not c2

    def test_inject(self):
        get_container().register_singleton(str, "injected")
        assert inject(str) == "injected"

    def test_inject_not_registered(self):
        with pytest.raises(KeyError):
            inject(float)

    def test_provides_decorator(self):
        @provides(int)
        def make_int():
            return 999

        assert get_container().resolve(int) == 999

    def test_provides_with_transient(self):
        calls = []

        @provides(list, lifetime=Lifetime.TRANSIENT)
        def make_list():
            calls.append(1)
            return [len(calls)]

        a = get_container().resolve(list)
        b = get_container().resolve(list)
        assert a != b

    def test_register_default_dependencies(self, monkeypatch):
        # Mock config module imports
        fake_config = type("PathConfig", (), {})
        fake_instance = fake_config()

        import sys

        mod = type(sys)("config")
        mod.get_config = lambda: fake_instance
        mod.PathConfig = fake_config
        monkeypatch.setitem(sys.modules, "config", mod)

        register_default_dependencies()
        assert get_container().resolve(fake_config) is fake_instance

    def test_setup_dependencies(self, monkeypatch):
        fake_config = type("PathConfig", (), {})
        fake_instance = fake_config()

        import sys

        mod = type(sys)("config")
        mod.get_config = lambda: fake_instance
        mod.PathConfig = fake_config
        monkeypatch.setitem(sys.modules, "config", mod)

        setup_dependencies()
        assert get_container().resolve(fake_config) is fake_instance
