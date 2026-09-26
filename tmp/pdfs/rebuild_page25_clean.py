from io import BytesIO
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from reportlab.lib.utils import ImageReader
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
GRAY = (0.28, 0.32, 0.37)
LIGHT_GRAY = (0.78, 0.82, 0.86)


def draw_lines(layer, lines, x, y, font, size, leading, color=BLACK):
    layer.setFillColorRGB(*color)
    layer.setFont(font, size)
    for line in lines:
        layer.drawString(x, y, line)
        y -= leading


def draw_stage(layer, x, stage):
    width, bottom, height = 123, 290, 300
    accent = stage["accent"]
    header_text = stage.get("header_text", BLACK)

    layer.setFillColorRGB(*BLACK)
    layer.rect(x + 4, bottom - 4, width, height, stroke=0, fill=1)
    layer.setFillColorRGB(1, 1, 1)
    layer.setStrokeColorRGB(*BLACK)
    layer.setLineWidth(1.5)
    layer.rect(x, bottom, width, height, stroke=1, fill=1)
    layer.setFillColorRGB(*accent)
    layer.rect(x, bottom + height - 52, width, 52, stroke=0, fill=1)

    layer.setFillColorRGB(*header_text)
    layer.setFont("Arial-Bold", 7.5)
    layer.drawString(x + 12, bottom + height - 17, stage["number"])
    title_size = stage.get("title_size", 17)
    layer.setFont("Impact", title_size)
    title_y = bottom + height - 42
    for title_line in stage["title"]:
        layer.drawString(x + 12, title_y, title_line)
        title_y -= 17

    layer.setFillColorRGB(*GRAY)
    layer.setFont("Arial-Bold", 7)
    layer.drawString(x + 12, bottom + 226, "OWNERS")
    draw_lines(layer, stage["owners"], x + 12, bottom + 207, "Arial-Bold", 9, 12)

    layer.setStrokeColorRGB(*LIGHT_GRAY)
    layer.setLineWidth(0.8)
    layer.line(x + 12, bottom + 173, x + width - 12, bottom + 173)
    layer.setFillColorRGB(*GRAY)
    layer.setFont("Arial-Bold", 7)
    layer.drawString(x + 12, bottom + 157, "KEY ACTIONS")

    action_y = bottom + 137
    for action in stage["actions"]:
        layer.setFillColorRGB(*accent)
        layer.rect(x + 12, action_y + 2, 5, 5, stroke=0, fill=1)
        draw_lines(layer, action, x + 23, action_y, "Arial", 8.1, 10)
        action_y -= 44


reader = PdfReader(str(SOURCE))
writer = PdfWriter()
globe = reader.pages[24].images[0].image.convert("RGBA")

page_buffer = BytesIO()
layer = canvas.Canvas(page_buffer, pagesize=(612, 792))

# Background and publication header.
layer.setFillColorRGB(*PALE_BLUE)
layer.rect(0, 0, 612, 792, stroke=0, fill=1)
layer.drawImage(ImageReader(globe), 31, 748, 28, 28, mask="auto")
layer.setFillColorRGB(*BLACK)
layer.setFont("Impact", 18)
layer.drawString(61, 755, "ONEWEB")
layer.setFont("Courier-Bold", 6)
layer.drawRightString(579, 766, "05 / PUBLISH AND PURCHASE")
layer.setStrokeColorRGB(0.72, 0.77, 0.82)
layer.setLineWidth(0.8)
layer.line(0, 744, 612, 744)

# Title and framing statement.
layer.setFillColorRGB(*BLACK)
layer.setFont("Impact", 25)
layer.drawString(33, 703, "ACCESSIBILITY IS SHARED WORK")
layer.drawString(33, 676, "ACROSS THE LIFECYCLE")
layer.setStrokeColorRGB(*ORANGE)
layer.setLineWidth(2)
layer.line(0, 655, 612, 655)
layer.setFillColorRGB(*GRAY)
layer.setFont("Arial", 10.5)
layer.drawString(
    33,
    628,
    "Each phase has named owners, specific actions, and evidence that moves forward.",
)

stages = [
    {
        "number": "01",
        "title": ["PLAN"],
        "accent": LIME,
        "owners": ["Leaders", "Procurement"],
        "actions": [
            ["Set goals, policy,", "owners, and resources."],
            ["Require accessibility", "evidence before buying."],
            ["Remove blockers", "and fund corrections."],
        ],
    },
    {
        "number": "02",
        "title": ["CREATE"],
        "accent": ORANGE,
        "owners": ["Content, Design,", "Development"],
        "actions": [
            ["Write clear content", "and alternatives."],
            ["Design readable,", "flexible patterns."],
            ["Build semantic,", "keyboard-operable UI."],
        ],
    },
    {
        "number": "03",
        "title": ["VERIFY"],
        "accent": BLUE,
        "header_text": (1, 1, 1),
        "owners": ["QA + disabled", "users"],
        "actions": [
            ["Run automated", "and manual checks."],
            ["Test real tasks with", "disabled users."],
            ["Track corrections", "and retest evidence."],
        ],
    },
    {
        "number": "04",
        "title": ["PUBLISH + IMPROVE"],
        "title_size": 12.5,
        "accent": BLACK,
        "header_text": (1, 1, 1),
        "owners": ["All roles"],
        "actions": [
            ["Confirm evidence", "before release."],
            ["Publish a contact", "method for barriers."],
            ["Listen, respond,", "and improve."],
        ],
    },
]

positions = [33, 174, 315, 456]
for position, stage in zip(positions, stages):
    draw_stage(layer, position, stage)

# Small arrows make the card order explicit without adding another workflow.
layer.setFillColorRGB(*BLACK)
for x in (160, 301, 442):
    layer.line(x, 563, x + 10, 563)
    arrow = layer.beginPath()
    arrow.moveTo(x + 10, 563)
    arrow.lineTo(x + 5, 567)
    arrow.lineTo(x + 5, 559)
    arrow.close()
    layer.drawPath(arrow, stroke=0, fill=1)

# Feedback is part of the final phase, expressed as a compact operational loop.
layer.setFillColorRGB(*BLACK)
layer.rect(33, 145, 546, 100, stroke=0, fill=1)
layer.setFillColorRGB(*LIME)
layer.setFont("Impact", 14)
layer.drawString(48, 221, "FEEDBACK CLOSES THE LOOP")
layer.setFillColorRGB(1, 1, 1)
layer.setFont("Arial", 8.7)
layer.drawString(48, 204, "Treat every barrier report as product evidence and communicate the outcome.")
layer.setStrokeColorRGB(0.35, 0.38, 0.42)
layer.setLineWidth(0.8)
layer.line(48, 193, 564, 193)

feedback = [
    (96, "REPORT", "Make contact easy."),
    (232, "ACKNOWLEDGE", "Confirm receipt."),
    (368, "RESOLVE", "Fix and retest."),
    (504, "COMMUNICATE", "Share the outcome."),
]
for index, (center, label, detail) in enumerate(feedback, start=1):
    layer.setFillColorRGB(*(LIME if index % 2 else ORANGE))
    layer.circle(center - 43, 173, 6, stroke=0, fill=1)
    layer.setFillColorRGB(1, 1, 1)
    layer.setFont("Arial-Bold", 8)
    layer.drawString(center - 31, 174, label)
    layer.setFillColorRGB(0.72, 0.76, 0.80)
    layer.setFont("Arial", 7.2)
    layer.drawString(center - 31, 161, detail)

# Footer.
layer.setFillColorRGB(*BLACK)
layer.setFont("Courier", 5.8)
layer.drawString(33, 16, "ONEWEB / DIGITAL ACCESSIBILITY AWARENESS & EDUCATION")
layer.drawRightString(579, 16, "25")
layer.save()

page_buffer.seek(0)
clean_page = PdfReader(page_buffer).pages[0]
for page_number, page in enumerate(reader.pages, start=1):
    writer.add_page(clean_page if page_number == 25 else page)

with OUTPUT.open("wb") as stream:
    writer.write(stream)
