import json, sys

path = sys.argv[1]
with open(path) as f:
    data = json.load(f)

issues = data if isinstance(data, list) else data.get("issues", [])

for i in issues:
    raw_labels = i.get("labels", [])
    if isinstance(raw_labels, dict):
        raw_labels = raw_labels.get("nodes", [])
    labels = ", ".join(l.get("name", "") if isinstance(l, dict) else str(l) for l in raw_labels)
    num = i["number"]
    title = i["title"][:80]
    print(f"  #{num:<4} [{labels:>20}]  {title}")

print(f"\nTotal open: {len(issues)}")
