"""
Result Pattern Implementation for Nzila Automation

Provides a Result type similar to Rust's Result or Haskell's Either.
Helps eliminate silent failures and makes error handling explicit.
"""

from typing import TypeVar, Generic, Optional, Callable, Union
from dataclasses import dataclass
from enum import Enum


T = TypeVar('T')
U = TypeVar('U')


class ResultState(Enum):
    """Represents the state of a Result."""
    OK = "ok"
    ERROR = "error"


@dataclass(frozen=True)
class Ok(Generic[T]):
    """Represents a successful result containing a value."""
    value: T
    state: ResultState = ResultState.OK
    
    def is_ok(self) -> bool:
        return True
    
    def is_err(self) -> bool:
        return False
    
    def unwrap(self) -> T:
        return self.value
    
    def unwrap_or(self, default: T) -> T:
        return self.value
    
    def unwrap_err(self) -> None:
        return None
    
    def map(self, fn: Callable[[T], U]) -> "Ok[U]":
        return Ok(fn(self.value))
    
    def flat_map(self, fn: Callable[[T], "Result[U]"]) -> "Result[U]":
        return fn(self.value)


@dataclass(frozen=True)
class Err(Generic[T]):
    """Represents an erroneous result containing an error message."""
    error: str
    state: ResultState = ResultState.ERROR
    
    def is_ok(self) -> bool:
        return False
    
    def is_err(self) -> bool:
        return True
    
    def unwrap(self) -> T:
        raise ValueError(f"Cannot unwrap Err: {self.error}")
    
    def unwrap_or(self, default: T) -> T:
        return default
    
    def unwrap_err(self) -> str:
        return self.error
    
    def map(self, fn: Callable) -> "Err[T]":
        return self
    
    def flat_map(self, fn: Callable) -> "Err[T]":
        return self


# Type alias for Result
Result = Union[Ok[T], Err[T]]


def ok(value: T) -> Ok[T]:
    """Create a successful Result."""
    return Ok(value)


def err(error: str) -> Err[T]:
    """Create an error Result."""
    return Err(error)


def from_optional(value: Optional[T], error_msg: str = "Value is None") -> Result[T]:
    """Convert an Optional to a Result."""
    if value is None:
        return err(error_msg)
    return ok(value)


# ──────────────────────────────────────────────────────────────────
# Integration Helpers
# ──────────────────────────────────────────────────────────────────

def safe_execute(fn: Callable[[], T], error_prefix: str = "Operation failed") -> Result[T]:
    """
    Execute a function and wrap the result in a Result type.
    
    Usage:
        result = safe_execute(lambda: some_function())
        if result.is_ok():
            print(result.value)
        else:
            print(result.error)
    """
    try:
        return ok(fn())
    except Exception as e:
        return err(f"{error_prefix}: {type(e).__name__}: {e}")


# ──────────────────────────────────────────────────────────────────
# Example Usage in Notion Integration
# ──────────────────────────────────────────────────────────────────

class NotionResult:
    """
    Example of how to use Result pattern in Notion integration.
    Replace silent failures with explicit error handling.
    """
    
    def _make_request(self, endpoint: str, method: str = "GET",
                     data: Optional[dict] = None) -> Result[dict]:
        """Make authenticated Notion API request with proper error handling."""
        import urllib.request
        import urllib.error
        import json
        
        token = self.token
        if not token:
            return err("Notion token not configured. Set NOTION_TOKEN environment variable.")
        
        url = f"{self.api_base}{endpoint}"
        headers = {
            "Authorization": f"Bearer {token}",
            "Notion-Version": self.api_version,
            "Content-Type": "application/json"
        }
        
        req = urllib.request.Request(url, headers=headers, method=method)
        if data:
            req.data = json.dumps(data).encode('utf-8')
            
        try:
            with urllib.request.urlopen(req) as response:
                return ok(json.loads(response.read().decode('utf-8')))
        except urllib.error.HTTPError as e:
            return err(f"HTTP {e.code}: {e.read().decode('utf-8')}")
        except urllib.error.URLError as e:
            return err(f"URL Error: {e.reason}")
        except Exception as e:
            return err(f"Unexpected error: {type(e).__name__}: {e}")
    
    def list_databases(self) -> Result[list]:
        """List all accessible databases."""
        result = self._make_request("/databases")
        if result.is_ok():
            return ok(result.value.get("results", []))
        return result
