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

shortcuts = [
    ("Tab", "move forward"),
    ("Shift + Tab", "move backward"),
    ("Enter", "activate links"),
    ("Space", "activate buttons"),
    ("Esc", "close dialogs"),
]

for page_number, page in enumerate(reader.pages, start=1):
    if page_number == 16:
        packet = BytesIO()
        layer = canvas.Canvas(packet, pagesize=(612, 792))

        # Clear the uneven original shortcut row while preserving the paragraph.
        layer.setFillColorRGB(1, 1, 1)
        layer.rect(205, 298, 374, 69, stroke=0, fill=1)

        key_width = 66
        key_height = 30
        gap = 9
        start_x = 212
        key_y = 330
        caption_y = 311

        for index, (key, caption) in enumerate(shortcuts):
            x = start_x + index * (key_width + gap)

            # Uniform keycaps with a restrained two-point shadow.
            layer.setFillColorRGB(0, 0, 0)
            layer.rect(x + 2, key_y - 2, key_width, key_height, stroke=0, fill=1)
            layer.setFillColorRGB(1, 1, 1)
            layer.setStrokeColorRGB(0, 0, 0)
            layer.setLineWidth(1.5)
            layer.rect(x, key_y, key_width, key_height, stroke=1, fill=1)

            layer.setFillColorRGB(0, 0, 0)
            key_size = 8.1 if key == "Shift + Tab" else 9
            layer.setFont("Courier-Bold", key_size)
            key_text_width = pdfmetrics.stringWidth(key, "Courier-Bold", key_size)
            layer.drawString(x + (key_width - key_text_width) / 2, key_y + 10, key)

            layer.setFont("Arial", 7)
            caption_width = pdfmetrics.stringWidth(caption, "Arial", 7)
            layer.drawString(x + (key_width - caption_width) / 2, caption_y, caption)

        layer.save()
        packet.seek(0)
        page.merge_page(PdfReader(packet).pages[0])
    writer.add_page(page)

with OUTPUT.open("wb") as stream:
    writer.write(stream)
