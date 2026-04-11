#!/usr/bin/env python3
"""Find PDF and bylaw links in the CUPE 3906 page."""
import re

with open("content/internal/cupe3906-bylaws-raw.html", encoding="utf-8") as f:
    html = f.read()

# Find all links
links = re.findall(r'href="([^"]*)"', html)
for link in links:
    if any(
        kw in link.lower()
        for kw in ["pdf", "bylaw", "bylaws", "constitution", "policy"]
    ):
        print(link)
