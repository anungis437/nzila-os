"""PostgreSQL literals as the catalog prints them (``pg_get_expr`` for a column default, ``pg_get_constraintdef`` for a CHECK).

Shared by the model generator (``ue_converge_models``), which turns them into Python source, and by the parity
measurement (``ue_physical_parity``), which compares them with what the models write.
"""
import json
import re
from decimal import Decimal, InvalidOperation

NUMBER = re.compile(r"^\(?(-?\d+(?:\.\d+)?)\)?(?:::[\w ]+)?$")
QUOTED = re.compile(r"^'((?:[^']|'')*)'::([\w\. ]+(?:\(\d+(?:,\s*\d+)?\))?)(\[\])?$")
ARRAY_LITERAL = re.compile(r"^ARRAY\[(.*?)\](?:::[\w\. ]+(?:\(\d+\))?\[\])?$", re.S)
UNQUOTED_ELEMENT = re.compile(r"^\(?(-?\d+(?:\.\d+)?)\)?(?:::[\w ]+)?$")
QUOTED_ELEMENT = re.compile(r"^'((?:[^']|'')*)'(?:::[\w\. ]+)?$")


def split_arguments(text):
    """Split call arguments on top-level commas."""
    parts, depth, current, quote = [], 0, "", None
    for ch in text:
        if quote:
            current += ch
            if ch == quote:
                quote = None
            continue
        if ch in "'\"":
            quote = ch
        elif ch in "([{":
            depth += 1
        elif ch in ")]}":
            depth -= 1
        elif ch == "," and depth == 0:
            parts.append(current.strip())
            current = ""
            continue
        current += ch
    if current.strip():
        parts.append(current.strip())
    return parts


def parse_pg_array(text):
    """The elements of a one-dimensional PostgreSQL array literal such as ``{a,"b c"}``; ValueError for anything else."""
    body = text.strip()
    if not (body.startswith("{") and body.endswith("}")):
        raise ValueError(text)
    body = body[1:-1]
    if not body:
        return []
    items, current, quoted, escaped = [], "", False, False
    for ch in body:
        if escaped:
            current += ch
            escaped = False
        elif ch == "\\" and quoted:
            escaped = True
        elif ch == '"':
            quoted = not quoted
        elif ch == "," and not quoted:
            items.append(current)
            current = ""
        else:
            current += ch
    items.append(current)
    return items


def constant_default(expression):
    """``(True, value)`` for a column default that is a constant, ``(False, None)`` for one PostgreSQL computes (now(), nextval, ...)."""
    if expression is None:
        return False, None
    e = expression.strip()
    if e in ("true", "false"):
        return True, e == "true"
    m = NUMBER.match(e)
    if m:
        return True, Decimal(m.group(1))
    m = QUOTED.match(e)
    if m:
        text, cast, is_array = m.group(1).replace("''", "'"), m.group(2), m.group(3)
        try:
            if is_array:
                return True, parse_pg_array(text)
            if cast in ("jsonb", "json"):
                return True, json.loads(text)
            if cast.startswith("numeric"):
                return True, Decimal(text)
        except (ValueError, InvalidOperation):
            return False, None
        return True, text
    m = ARRAY_LITERAL.match(e)
    if m:
        values = []
        for element in split_arguments(m.group(1)):
            quoted = QUOTED_ELEMENT.match(element)
            if not quoted:
                return False, None
            values.append(quoted.group(1).replace("''", "'"))
        return True, values
    return False, None


CHECK_PREFIX = re.compile(r"^CHECK \(+(?:\(*(?P<col>\w+)\)* IS NULL\)* OR \(*)?$")


def check_list_values(definition, column):
    """The values a CHECK allows for ``column`` when the whole constraint is that column in a literal list, else None.

    ``CHECK ((status = ANY (ARRAY['a'::text, 'b'::text])))`` allows {'a', 'b'}. A constraint that says anything else
    (another column, an AND, an OR) is not a list over the column and returns None, so it is never read as one.
    """
    start = re.search(rf"\b{re.escape(column)}\)*(?:::[\w ]+)? = ANY \(\(?ARRAY\[", definition)
    if not start:
        return None
    prefix = definition[: start.start()]
    prefix_match = CHECK_PREFIX.match(prefix)
    if not prefix_match or prefix_match.group("col") not in (None, column):
        return None
    body_start = start.end()
    depth, quote, end = 1, None, None
    for index in range(body_start, len(definition)):
        ch = definition[index]
        if quote:
            if ch == quote:
                quote = None
            continue
        if ch == "'":
            quote = ch
        elif ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                end = index
                break
    if end is None or not re.match(r"^\)*(?:::[\w ]+\[\])?\)*$", definition[end + 1 :]):
        return None
    values = set()
    for element in split_arguments(definition[body_start:end]):
        quoted = QUOTED_ELEMENT.match(element)
        number = UNQUOTED_ELEMENT.match(element)
        if quoted:
            values.add(quoted.group(1).replace("''", "'"))
        elif number:
            values.add(number.group(1))
        else:
            return None
    return values
