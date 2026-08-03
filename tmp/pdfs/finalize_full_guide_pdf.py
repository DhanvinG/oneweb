import os
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.generic import BooleanObject, DictionaryObject, NameObject

pdf = Path(
    os.environ.get(
        "FULL_GUIDE_PDF_PATH",
        "output/pdf/OneWeb_Digital_Accessibility_in_Practice_Full_Guide.pdf",
    )
)
temporary = pdf.with_suffix(".metadata.pdf")

reader = PdfReader(pdf)
writer = PdfWriter()
writer.clone_document_from_reader(reader)
writer.add_metadata(
    {
        "/Title": "Digital Accessibility in Practice",
        "/Author": "OneWeb Movement",
        "/Subject": "A practical digital accessibility resource guide for businesses and organizations",
        "/Keywords": "digital accessibility, WCAG, inclusive design, OneWeb, accessibility testing",
        "/Creator": "OneWeb Movement",
    }
)

# Screen readers announce the document title (not the filename) only when
# /ViewerPreferences /DisplayDocTitle is true.
root = writer._root_object
preferences = root.get("/ViewerPreferences")
if preferences is None:
    preferences = DictionaryObject()
    root[NameObject("/ViewerPreferences")] = preferences
else:
    preferences = preferences.get_object()
preferences[NameObject("/DisplayDocTitle")] = BooleanObject(True)

try:
    with temporary.open("wb") as stream:
        writer.write(stream)
    temporary.replace(pdf)
except BaseException:
    temporary.unlink(missing_ok=True)
    raise
