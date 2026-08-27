import os
from pathlib import Path
from pypdf import PdfReader

PDF = Path(
    os.environ.get(
        "FULL_GUIDE_PDF_PATH",
        "output/pdf/OneWeb_Digital_Accessibility_in_Practice_Full_Guide.pdf",
    )
)

reader = PdfReader(PDF)
root = reader.trailer["/Root"]
metadata = reader.metadata or {}


def dereference(value):
    try:
        return value.get_object()
    except AttributeError:
        return value


def walk_structure(value, visited, stats):
    value = dereference(value)
    object_id = getattr(value, "indirect_reference", None)
    key = None
    if object_id is not None:
        key = (object_id.idnum, object_id.generation)
        if key in visited:
            return
        visited.add(key)

    if isinstance(value, dict):
        if "/Alt" in value:
            stats["alt"] += 1
        if "/ActualText" in value:
            stats["actual_text"] += 1
        if "/S" in value:
            stats["structure_elements"] += 1
        if "/K" in value:
            walk_structure(value["/K"], visited, stats)
    elif isinstance(value, list):
        for item in value:
            walk_structure(item, visited, stats)


def count_outline(entries):
    """Count every outline entry, including nested children."""
    total = 0
    for entry in entries or []:
        if isinstance(entry, list):
            total += count_outline(entry)
        else:
            total += 1
    return total


stats = {"alt": 0, "actual_text": 0, "structure_elements": 0}
if "/StructTreeRoot" in root:
    walk_structure(root["/StructTreeRoot"], set(), stats)

links = 0
uri_links = []
for page in reader.pages:
    for annotation_ref in page.get("/Annots", []):
        annotation = dereference(annotation_ref)
        if annotation.get("/Subtype") == "/Link":
            links += 1
            action = dereference(annotation.get("/A", {}))
            uri = action.get("/URI")
            if uri:
                uri_links.append(str(uri))

text_lengths = [len((page.extract_text() or "").strip()) for page in reader.pages]
page_sizes = [
    (round(float(page.mediabox.width), 2), round(float(page.mediabox.height), 2))
    for page in reader.pages
]

report = {
    "pages": len(reader.pages),
    "title": metadata.get("/Title"),
    "author": metadata.get("/Author"),
    "subject": metadata.get("/Subject"),
    "lang": root.get("/Lang"),
    "marked": dereference(root.get("/MarkInfo", {})).get("/Marked"),
    "struct_tree": "/StructTreeRoot" in root,
    "outline_items": count_outline(reader.outline),
    "display_doc_title": dereference(root.get("/ViewerPreferences", {})).get("/DisplayDocTitle"),
    "structure": stats,
    "link_annotations": links,
    "uri_links": uri_links,
    "minimum_text_length": min(text_lengths),
    "pages_with_low_text": [i + 1 for i, value in enumerate(text_lengths) if value < 120],
    "unique_page_sizes": sorted(set(page_sizes)),
}

for key, value in report.items():
    print(f"{key}: {value}")

assert report["pages"] == 30
assert report["lang"] in ("/en", "en", "en-US", "/en-US")
assert bool(report["marked"]) is True
assert report["struct_tree"] is True
assert report["structure"]["alt"] >= 5, "expected alt text for the 5 informative illustrations"
assert report["outline_items"] >= 25, "bookmark outline should cover the whole 30-page guide"
assert report["link_annotations"] >= 16, "TOC internal links + external resource links"
assert len(report["uri_links"]) >= 7
assert all(uri.startswith("https://") for uri in report["uri_links"])
assert report["unique_page_sizes"] == [(612.0, 792.0)]
assert not report["pages_with_low_text"]
assert report["title"] == "Digital Accessibility in Practice"
assert report["author"] == "OneWeb Movement"
assert report["subject"]
assert bool(report["display_doc_title"]) is True, "finalizer must set /DisplayDocTitle"
