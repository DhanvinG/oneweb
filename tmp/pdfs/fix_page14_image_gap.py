from io import BytesIO
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "public" / "OneWeb_Digital_Accessibility_in_Practice_Full_Guide.pdf"
OUTPUT = ROOT / "tmp" / "pdfs" / "OneWeb_Digital_Accessibility_in_Practice_Full_Guide.pdf"

reader = PdfReader(str(SOURCE))
writer = PdfWriter()

# Page 14 contains the illustration plus the OneWeb logo. Use the larger image.
page_14 = reader.pages[13]
illustration = max(
    (pdf_image.image.convert("RGB") for pdf_image in page_14.images),
    key=lambda image: image.width * image.height,
)

# The frame is slightly wider than the placed image. Crop a few pixels from the
# top and bottom, then fill the complete inner frame without stretching.
target_width = 542
target_height = 303
target_ratio = target_width / target_height
crop_height = round(illustration.width / target_ratio)
top = (illustration.height - crop_height) // 2
illustration = illustration.crop((0, top, illustration.width, top + crop_height))

for page_number, page in enumerate(reader.pages, start=1):
    if page_number == 14:
        packet = BytesIO()
        layer = canvas.Canvas(packet, pagesize=(612, 792))
        layer.drawImage(
            ImageReader(illustration),
            35,
            347,
            width=target_width,
            height=target_height,
            preserveAspectRatio=False,
            mask="auto",
        )
        layer.save()
        packet.seek(0)
        page.merge_page(PdfReader(packet).pages[0])
    writer.add_page(page)

with OUTPUT.open("wb") as stream:
    writer.write(stream)
