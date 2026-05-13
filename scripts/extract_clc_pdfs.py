"""Extract text from CLC PDFs into infotech/CLC/_extracted/."""

from pathlib import Path

from pypdf import PdfReader

src = Path("infotech/CLC")
out = src / "_extracted"
out.mkdir(exist_ok=True)

for pdf in sorted(src.glob("*.pdf")):
    print(f"Reading {pdf.name}...")
    reader = PdfReader(str(pdf))
    parts = []
    for i, page in enumerate(reader.pages):
        try:
            parts.append(f"\n\n===== PAGE {i+1} =====\n" + (page.extract_text() or ""))
        except Exception as e:
            parts.append(f"\n\n===== PAGE {i+1} (ERROR: {e}) =====\n")
    target = out / (pdf.stem + ".txt")
    target.write_text("".join(parts), encoding="utf-8")
    print(f"  -> {target} ({target.stat().st_size} bytes, {len(reader.pages)} pages)")
