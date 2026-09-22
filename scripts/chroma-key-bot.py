"""Chroma-key pure green (#00FF00-ish) to transparent; protect white robot."""
from PIL import Image
import os

src = r"C:\Users\Latitude\.cursor\projects\e-365adventures\assets\byg-bot-greenscreen.png"
out = r"e:\365adventures\AntiGravity-BYG-Hires\src\assets\byg-bot-curious.png"

img = Image.open(src).convert("RGBA")
pixels = img.load()
w, h = img.size

def key_alpha(r, g, b):
    # green screen: high G, G clearly above R and B
    if g > 90 and g > r + 35 and g > b + 35:
        # soft edge based on how green
        greenness = min(255, (g - max(r, b)) * 3)
        if greenness > 140:
            return 0
        if greenness > 70:
            return int(255 * (1 - (greenness - 70) / 70))
    return 255

for y in range(h):
    for x in range(w):
        r, g, b, a = pixels[x, y]
        na = key_alpha(r, g, b)
        if na < a:
            pixels[x, y] = (r, g, b, na)

# Also wipe any leftover pale watermark in extreme bottom-right (tiny region)
for y in range(int(h * 0.92), h):
    for x in range(int(w * 0.92), w):
        r, g, b, a = pixels[x, y]
        if a and (r + g + b) / 3 > 200:
            pixels[x, y] = (0, 0, 0, 0)

img.save(out, "PNG")
print("saved", out, os.path.getsize(out))
