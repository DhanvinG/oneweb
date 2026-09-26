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

PALE_BLUE = (220 / 255, 235 / 255, 1)
BLUE = (48 / 255, 131 / 255, 253 / 255)
LIME = (0.75, 1.0, 0.0)
ORANGE = (1.0, 0.31, 0.0)
BLACK = (0, 0, 0)
GRAY = (0.27, 0.31, 0.36)


def centered_text(layer, text, font, size, center_x, y):
    width = pdfmetrics.stringWidth(text, font, size)
    layer.setFont(font, size)
    layer.drawString(center_x - width / 2, y, text)


def draw_role_card(layer, x, y, width, height, accent, role, action, detail):
    # One coherent card replaces the disconnected role square and text block.
    layer.setFillColorRGB(*BLACK)
    layer.rect(x + 4, y - 4, width, height, stroke=0, fill=1)
    layer.setFillColorRGB(1, 1, 1)
    layer.setStrokeColorRGB(*BLACK)
    layer.setLineWidth(1.5)
    layer.rect(x, y, width, height, stroke=1, fill=1)

    layer.setFillColorRGB(*accent)
    layer.rect(x, y + height - 30, width, 30, stroke=0, fill=1)
    layer.setFillColorRGB(*BLACK)
    layer.setFont("Impact", 13)
    layer.drawString(x + 15, y + height - 21, role)

    layer.setFont("Arial-Bold", 11.2)
    action_y = y + height - 49
    for line in action:
        layer.drawString(x + 15, action_y, line)
        action_y -= 13

    layer.setStrokeColorRGB(0.78, 0.81, 0.84)
    layer.setLineWidth(0.8)
    layer.line(x + 15, y + 51, x + width - 15, y + 51)

    layer.setFillColorRGB(*GRAY)
    layer.setFont("Arial", 9.1)
    detail_y = y + 36
    for line in detail:
        layer.drawString(x + 15, detail_y, line)
        detail_y -= 11


reader = PdfReader(str(SOURCE))
writer = PdfWriter()

for page_number, page in enumerate(reader.pages, start=1):
    if page_number == 25:
        packet = BytesIO()
        layer = canvas.Canvas(packet, pagesize=(612, 792))

        # Clear the fragmented layout while preserving the page header and title.
        layer.setFillColorRGB(*PALE_BLUE)
        layer.rect(24, 67, 564, 588, stroke=0, fill=1)

        cards = [
            (33, 510, LIME, "LEADERS", ["Set direction and ownership"],
             ["Set scope, goals, owners, and resources.", "Approve policy and remove blockers."]),
            (316, 510, ORANGE, "CONTENT", ["Make information clear"],
             ["Write clear copy and meaningful alternatives.", "Use headings, links, alt text, and captions."]),
            (33, 372, LIME, "DESIGN", ["Design flexible patterns"],
             ["Create readable, adaptable components.", "Check contrast, focus, zoom, and motion."]),
            (316, 372, ORANGE, "DEVELOPMENT", ["Build accessible behavior"],
             ["Use semantic, operable controls and states.", "Verify keyboard behavior and testing."]),
            (33, 234, LIME, "QA + USERS", ["Test tasks and corrections"],
             ["Combine automated and manual checks", "with disabled-user evaluation."]),
            (316, 234, ORANGE, "PROCUREMENT", ["Buy with evidence"],
             ["Require proof before purchase.", "Track barriers through resolution."]),
        ]
        for x, y, accent, role, action, detail in cards:
            draw_role_card(layer, x, y, 263, 116, accent, role, action, detail)

        # A restrained timeline reads as an editorial process, not navigation UI.
        layer.setFillColorRGB(*BLACK)
        layer.rect(37, 141, 546, 64, stroke=0, fill=1)
        layer.setFillColorRGB(1, 1, 1)
        layer.setStrokeColorRGB(*BLACK)
        layer.setLineWidth(1.5)
        layer.rect(33, 145, 546, 64, stroke=1, fill=1)
        layer.setFillColorRGB(*BLACK)
        layer.setFont("Impact", 11)
        layer.drawString(48, 190, "THE ACCESSIBILITY WORKFLOW")

        stages = ["PLAN", "CREATE", "CHECK", "PUBLISH", "LISTEN", "IMPROVE"]
        centers = [69, 164, 259, 354, 449, 544]
        layer.setStrokeColorRGB(*BLACK)
        layer.setLineWidth(2)
        layer.line(69, 168, 544, 168)
        for index, (stage, center) in enumerate(zip(stages, centers), start=1):
            layer.setFillColorRGB(*(LIME if index % 2 else ORANGE))
            layer.setStrokeColorRGB(*BLACK)
            layer.setLineWidth(1.2)
            layer.circle(center, 168, 7, stroke=1, fill=1)
            layer.setFillColorRGB(*BLACK)
            centered_text(layer, str(index), "Arial-Bold", 6.5, center, 165.7)
            centered_text(layer, stage, "Arial-Bold", 7.6, center, 150.5)

        # Keep the closing action separate and easy to scan.
        layer.setFillColorRGB(1, 1, 1)
        layer.setStrokeColorRGB(*BLACK)
        layer.setLineWidth(1.5)
        layer.rect(33, 83, 546, 44, stroke=1, fill=1)
        layer.setFillColorRGB(*ORANGE)
        layer.rect(33, 83, 7, 44, stroke=0, fill=1)
        layer.setFillColorRGB(*BLACK)
        layer.setFont("Arial-Bold", 9.5)
        layer.drawString(52, 108, "MAKE FEEDBACK VISIBLE")
        layer.setFillColorRGB(*GRAY)
        layer.setFont("Arial", 8.3)
        layer.drawString(
            52,
            92,
            "Publish a contact method, acknowledge reports, explain next steps, and confirm when issues are resolved.",
        )

        layer.save()
        packet.seek(0)
        page.merge_page(PdfReader(packet).pages[0])
    writer.add_page(page)

with OUTPUT.open("wb") as stream:
    writer.write(stream)
