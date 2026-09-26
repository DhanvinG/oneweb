from io import BytesIO
from pathlib import Path

from PIL import Image
from pypdf import PdfReader, PdfWriter
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "public" / "OneWeb_Digital_Accessibility_in_Practice_Full_Guide.pdf"
OUTPUT = ROOT / "tmp" / "pdfs" / "OneWeb_Digital_Accessibility_in_Practice_Full_Guide.pdf"

reader = PdfReader(str(SOURCE))
writer = PdfWriter()

# Page 7 contains the illustration plus the OneWeb logo. Select the largest image.
source_page = reader.pages[6]
illustration = max(
    (pdf_image.image.convert("RGB") for pdf_image in source_page.images),
    key=lambda image: image.width * image.height,
)

# Crop only enough from the top and bottom to fill the wide frame without
# stretching the artwork. The crop is centered to preserve all three people.
target_ratio = 542 / 349
crop_height = round(illustration.width / target_ratio)
top = (illustration.height - crop_height) // 2
illustration = illustration.crop((0, top, illustration.width, top + crop_height))

for page_number, page in enumerate(reader.pages, start=1):
    if page_number == 7:
        packet = BytesIO()
        layer = canvas.Canvas(packet, pagesize=(612, 792))
        # Fill the complete inner edge of the existing 2 pt black frame.
        layer.drawImage(
            ImageReader(illustration),
            35,
            301,
            width=542,
            height=349,
            preserveAspectRatio=False,
            mask="auto",
        )
        layer.save()
        packet.seek(0)
        page.merge_page(PdfReader(packet).pages[0])
    writer.add_page(page)

with OUTPUT.open("wb") as stream:
    writer.write(stream)
