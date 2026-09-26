from pathlib import Path
from PIL import Image, ImageDraw

folder = Path(__file__).parent / "thumbs"
files = sorted(folder.glob("page-*.jpg"))
thumbs = []
for index, path in enumerate(files, start=1):
    image = Image.open(path).convert("RGB")
    image.thumbnail((204, 264))
    tile = Image.new("RGB", (220, 292), "white")
    tile.paste(image, ((220 - image.width) // 2, 20))
    ImageDraw.Draw(tile).text((8, 3), str(index), fill="black")
    thumbs.append(tile)

sheet = Image.new("RGB", (220 * 5, 292 * 6), "#dddddd")
for index, tile in enumerate(thumbs):
    sheet.paste(tile, ((index % 5) * 220, (index // 5) * 292))
sheet.save(Path(__file__).parent / "contact-sheet.jpg", quality=90)
