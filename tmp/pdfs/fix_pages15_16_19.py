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

# Page 16 contains the illustration and the OneWeb logo. Select the larger image.
page_16 = reader.pages[15]
keyboard_image = max(
    (pdf_image.image.convert("RGB") for pdf_image in page_16.images),
    key=lambda image: image.width * image.height,
)

# Crop vertically to the frame ratio so the art fills the width without stretching.
target_width = 542
target_height = 267
target_ratio = target_width / target_height
crop_height = round(keyboard_image.width / target_ratio)
top = (keyboard_image.height - crop_height) // 2
keyboard_image = keyboard_image.crop(
    (0, top, keyboard_image.width, top + crop_height)
)

for page_number, page in enumerate(reader.pages, start=1):
    if page_number in (15, 16, 19):
        packet = BytesIO()
        layer = canvas.Canvas(packet, pagesize=(612, 792))

        if page_number == 15:
            # Replace the text abbreviation with a universally recognizable eye.
            lime = (0.75, 1.0, 0.0)
            center_x, center_y, radius = 78, 602, 24
            layer.setFillColorRGB(*lime)
            layer.setStrokeColorRGB(0, 0, 0)
            layer.setLineWidth(1.5)
            layer.circle(center_x, center_y, radius, stroke=1, fill=1)

            eye = layer.beginPath()
            eye.moveTo(65, center_y)
            eye.curveTo(71, center_y + 9, 85, center_y + 9, 91, center_y)
            eye.curveTo(85, center_y - 9, 71, center_y - 9, 65, center_y)
            eye.close()
            layer.setFillColorRGB(1, 1, 1)
            layer.setStrokeColorRGB(0, 0, 0)
            layer.setLineWidth(2)
            layer.drawPath(eye, stroke=1, fill=1)
            layer.setFillColorRGB(0, 0, 0)
            layer.circle(center_x, center_y, 4.2, stroke=0, fill=1)

        elif page_number == 16:
            # Fill the complete inner edge of the existing black image frame.
            layer.drawImage(
                ImageReader(keyboard_image),
                35,
                377,
                width=target_width,
                height=target_height,
                preserveAspectRatio=False,
                mask="auto",
            )

        elif page_number == 19:
            # Remove the heavy lime stripe and restore a standard aligned border.
            layer.setFillColorRGB(1, 1, 1)
            layer.rect(317, 425, 8, 226, stroke=0, fill=1)
            layer.setStrokeColorRGB(0, 0, 0)
            layer.setLineWidth(2)
            layer.line(316, 424, 316, 652)
            layer.line(316, 652, 579, 652)
            layer.line(316, 424, 579, 424)

        layer.save()
        packet.seek(0)
        page.merge_page(PdfReader(packet).pages[0])
    writer.add_page(page)

with OUTPUT.open("wb") as stream:
    writer.write(stream)
