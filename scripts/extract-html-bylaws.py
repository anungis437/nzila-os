#!/usr/bin/env python3
"""Extract bylaws text from CUPE 3906 HTML page."""
import re

with open("content/internal/cupe3906-bylaws-raw.html", encoding="utf-8") as f:
    html = f.read()

# Look for entry-content div (WordPress)
match = re.search(
    r'<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>(.*?)</div>\s*(?:</article|<footer)',
    html,
    re.DOTALL,
)
if not match:
    # Try article tag
    match = re.search(r"<article[^>]*>(.*?)</article>", html, re.DOTALL)

if match:
    content = match.group(1)
    print(f"Content block: {len(content)} chars")
    # Strip HTML tags
    clean = re.sub(r"<[^>]+>", "\n", content)
    clean = re.sub(r"\n{3,}", "\n\n", clean).strip()
    # Remove empty lines
    lines = [l.strip() for l in clean.split("\n") if l.strip()]
    text = "\n".join(lines)
    print(f"Clean text: {len(text)} chars")
    print(text[:5000])
    print("\n--- END PREVIEW ---")

    with open("content/internal/cupe3906-bylaws.txt", "w", encoding="utf-8") as f:
        f.write(text)
    print(f"Saved to content/internal/cupe3906-bylaws.txt")
else:
    print("No content block found")
    # Search for Article patterns
    articles = re.findall(r"Article\s+\d+", html, re.IGNORECASE)
    print(f"Article mentions: {articles[:20]}")
