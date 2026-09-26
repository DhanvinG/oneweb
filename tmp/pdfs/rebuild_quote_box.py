from io import BytesIO
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "public" / "OneWeb_Digital_Accessibility_in_Practice_Full_Guide.pdf"
OUTPUT = ROOT / "tmp" / "pdfs" / "OneWeb_Digital_Accessibility_in_Practice_Full_Guide.pdf"

pdfmetrics.registerFont(TTFont("Arial", r"C:\Windows\Fonts\arial.ttf"))
pdfmetrics.registerFont(TTFont("Arial-Bold", r"C:\Windows\Fonts\arialbd.ttf"))

reader = PdfReader(str(SOURCE))
writer = PdfWriter()

for page_number, page in enumerate(reader.pages, start=1):
    if page_number == 3:
        packet = BytesIO()
        layer = canvas.Canvas(packet, pagesize=(612, 792))

        # Rebuild the card from the background up, covering the previous layout.
        layer.setFillColorRGB(0, 0, 0)
        layer.rect(33, 45, 546, 77, stroke=0, fill=1)

        lime = (0.76, 1.0, 0.0)
        # Opening quote, body copy, and closing quote form one visual unit.
        layer.setFillColorRGB(*lime)
        layer.setFont("Arial-Bold", 24)
        layer.drawString(53, 90, "“")

        layer.setFillColorRGB(1, 1, 1)
        layer.setFont("Arial", 14.2)
        first_line = "The power of the Web is in its universality."
        second_line = "Access by everyone regardless of disability is an essential aspect."
        layer.drawString(72, 96, first_line)
        layer.drawString(72, 77, second_line)

        second_line_width = pdfmetrics.stringWidth(second_line, "Arial", 14.2)
        layer.setFillColorRGB(*lime)
        layer.setFont("Arial-Bold", 24)
        layer.drawString(72 + second_line_width + 3, 73, "”")

        # Compact attribution, aligned with the quote copy.
        layer.setFillColorRGB(*lime)
        attribution = layer.beginText(72, 56)
        attribution.setFont("Arial-Bold", 8.4)
        attribution.setCharSpace(0.35)
        attribution.textLine("TIM BERNERS-LEE  /  INVENTOR OF THE WORLD WIDE WEB")
        layer.drawText(attribution)

        layer.save()
        packet.seek(0)
        page.merge_page(PdfReader(packet).pages[0])
    writer.add_page(page)

with OUTPUT.open("wb") as stream:
    writer.write(stream)
