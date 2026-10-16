"""Observe CSE terminal status without changing deployment behavior."""

import re
from typing import Literal, TypedDict


class Status(TypedDict):
    code: str


class Terminal(TypedDict):
    state: Literal["succeeded", "failed"]
    code: str


def parse_terminal(statuses: list[Status]) -> Terminal:
    terminal: list[Terminal] = []
    for status in statuses:
        code = status["code"]
        match = re.fullmatch(r"ProvisioningState/(succeeded|failed)(?:/([0-9]+))?", code)
        if match:
            state: Literal["succeeded", "failed"] = "succeeded" if match[1] == "succeeded" else "failed"
            terminal.append({"state": state, "code": code})
        elif code.startswith(("ProvisioningState/succeeded", "ProvisioningState/failed")):
            raise ValueError("UNSUPPORTED_CSE_TERMINAL_STATUS_SUFFIX: " + code)
    if len(terminal) != 1:
        raise ValueError("CSE_TERMINAL_STATUS_UNRESOLVED: expected exactly one terminal status")
    return terminal[0]
