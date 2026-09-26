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
pdfmetrics.registerFont(TTFont("Impact", r"C:\Windows\Fonts\impact.ttf"))


def draw_card(layer, x, y, width, height, color, title, lines, title_size=22):
    # A small offset shadow matches the visual language used elsewhere in the guide.
    layer.setFillColorRGB(0, 0, 0)
    layer.rect(x + 4, y - 4, width, height, stroke=0, fill=1)
    layer.setFillColorRGB(*color)
    layer.setStrokeColorRGB(0, 0, 0)
    layer.setLineWidth(2)
    layer.rect(x, y, width, height, stroke=1, fill=1)

    left = x + 24
    layer.setFillColorRGB(0, 0, 0)
    layer.setFont("Impact", title_size)
    layer.drawString(left, y + height - 50, title)

    layer.setFont("Arial", 12.5)
    baseline = y + height - 81
    for line in lines:
        layer.drawString(left, baseline, line)
        baseline -= 18


reader = PdfReader(str(SOURCE))
writer = PdfWriter()

for page_number, page in enumerate(reader.pages, start=1):
    if page_number == 9:
        packet = BytesIO()
        layer = canvas.Canvas(packet, pagesize=(612, 792))

        draw_card(
            layer,
            93,
            511,
            426,
            132,
            (1, 1, 1),
            "AUTOMATED CHECKS",
            [
                "Find some code-based issues at scale: contrast failures,",
                "missing attributes, empty labels, and repeated patterns.",
            ],
        )
        draw_card(
            layer,
            63,
            376,
            486,
            121,
            (0.20, 0.51, 0.95),
            "MANUAL CHECKS",
            [
                "Review keyboard use, zoom, focus, forms, headings, media,",
                "instructions, and complete tasks.",
            ],
        )
        draw_card(
            layer,
            33,
            239,
            546,
            123,
            (0.75, 1.0, 0.0),
            "EVALUATION WITH DISABLED PEOPLE",
            [
                "Reveal barriers, workarounds, and confusing patterns that",
                "technical checks may miss.",
            ],
            title_size=20,
        )

        # Rebalance the evidence formula to match the stronger card typography.
        layer.setFillColorRGB(0, 0, 0)
        layer.rect(33, 157, 546, 61, stroke=0, fill=1)
        layer.setFillColorRGB(1, 1, 1)
        layer.setFont("Arial-Bold", 10)
        layer.drawString(64, 183, "BETTER EVIDENCE")

        pills = [
            (179, 170, 93, "AUTOMATED SIGNAL"),
            (296, 170, 78, "MANUAL REVIEW"),
            (398, 170, 116, "DISABLED USER FEEDBACK"),
        ]
        for x, y, width, label in pills:
            layer.setStrokeColorRGB(1, 1, 1)
            layer.setLineWidth(1)
            layer.rect(x, y, width, 30, stroke=1, fill=0)
            layer.setFillColorRGB(1, 1, 1)
            layer.setFont("Arial-Bold", 7.3)
            text_width = pdfmetrics.stringWidth(label, "Arial-Bold", 7.3)
            layer.drawString(x + (width - text_width) / 2, y + 10, label)

        layer.setFillColorRGB(0.75, 1.0, 0.0)
        layer.setFont("Arial-Bold", 15)
        layer.drawString(280, 178, "+")
        layer.drawString(382, 178, "+")

        layer.save()
        packet.seek(0)
        page.merge_page(PdfReader(packet).pages[0])
    writer.add_page(page)

with OUTPUT.open("wb") as stream:
    writer.write(stream)
