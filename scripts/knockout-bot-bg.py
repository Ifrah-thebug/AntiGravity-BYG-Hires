"""Remove solid blue studio backdrop; keep white robot opaque."""
from PIL import Image
from collections import deque
import os

src = r"C:\Users\Latitude\.cursor\projects\e-365adventures\assets\byg-bot-curious-clean.png"
out = r"e:\365adventures\AntiGravity-BYG-Hires\src\assets\byg-bot-curious.png"

img = Image.open(src).convert("RGBA")
# Downscale for speed if huge, then upscale mask — keep original size processing but efficient numpy if available
try:
    import numpy as np

    arr = np.array(img)
    h, w = arr.shape[:2]
    rgb = arr[:, :, :3].astype(np.float32)

    # Reference blues from corners
    refs = np.array(
        [
            rgb[2, 2],
            rgb[2, w - 3],
            rgb[h - 3, 2],
            rgb[h - 3, w - 3],
            rgb[h // 2, 2],
            rgb[2, w // 2],
        ],
        dtype=np.float32,
    )

    # Distance to nearest blue reference
    dists = np.min(
        np.sqrt(((rgb[:, :, None, :] - refs[None, None, :, :]) ** 2).sum(axis=3)),
        axis=2,
    )

    # Also treat very-blue sky pixels (b dominant over r)
    blueish = (rgb[:, :, 2] > rgb[:, :, 0] + 20) & (rgb[:, :, 1] > rgb[:, :, 0] + 10) & (
        rgb[:, :, 2] > 160
    )

    # Candidate bg: close to blue refs OR blueish, but NOT near-white robot fill
    # White robot: high luminance, low chroma
    lum = rgb.mean(axis=2)
    chroma = rgb.max(axis=2) - rgb.min(axis=2)
    is_white_body = (lum > 200) & (chroma < 35)

    candidate = ((dists < 48) | blueish) & ~is_white_body

    # Flood from edges only among candidates
    mask = np.zeros((h, w), dtype=bool)
    q = deque()
    for x in range(w):
        q.append((0, x))
        q.append((h - 1, x))
    for y in range(h):
        q.append((y, 0))
        q.append((y, w - 1))

    while q:
        y, x = q.popleft()
        if y < 0 or x < 0 or y >= h or x >= w or mask[y, x]:
            continue
        if not candidate[y, x]:
            continue
        mask[y, x] = True
        q.append((y + 1, x))
        q.append((y - 1, x))
        q.append((y, x + 1))
        q.append((y, x - 1))

    # Soften: expand mask slightly into near-blue fringe
    from scipy import ndimage  # may fail

    try:
        mask = ndimage.binary_dilation(mask, iterations=1) & ((dists < 70) | blueish) & ~is_white_body
    except Exception:
        pass

    arr[mask, 3] = 0
    # Kill leftover watermark-ish pale blobs in bottom-right corner (small)
    br = arr[int(h * 0.88) :, int(w * 0.88) :, :]
    br_lum = br[:, :, :3].mean(axis=2)
    br_a = br[:, :, 3]
    # faint logos often semi-opaque pale
    kill = (br_a > 0) & (br_lum > 180) & ((br[:, :, 2] >= br[:, :, 0]) | (br_lum > 220))
    # only if sparse — avoid feet: feet are opaque white near bottom center, corner is safer
    br[kill, 3] = 0
    arr[int(h * 0.88) :, int(w * 0.88) :, :] = br

    out_img = Image.fromarray(arr, "RGBA")
    out_img.save(out, "PNG")
    print("saved", out, os.path.getsize(out), "transparent_px", int(mask.sum()))
except ImportError:
    # Pure PIL fallback — color distance flood fill
    pixels = img.load()
    w, h = img.size
    refs = [
        pixels[2, 2][:3],
        pixels[w - 3, 2][:3],
        pixels[2, h - 3][:3],
        pixels[w - 3, h - 3][:3],
    ]

    def dist(c, r):
        return ((c[0] - r[0]) ** 2 + (c[1] - r[1]) ** 2 + (c[2] - r[2]) ** 2) ** 0.5

    def is_bg_color(r, g, b):
        lum = (r + g + b) / 3
        chroma = max(r, g, b) - min(r, g, b)
        if lum > 200 and chroma < 35:
            return False  # keep white body
        if min(dist((r, g, b), ref) for ref in refs) < 48:
            return True
        if b > r + 20 and g > r + 10 and b > 160:
            return True
        return False

    visited = set()
    q = deque()
    for x in range(w):
        q.append((x, 0))
        q.append((x, h - 1))
    for y in range(h):
        q.append((0, y))
        q.append((w - 1, y))

    count = 0
    while q:
        x, y = q.popleft()
        if (x, y) in visited or x < 0 or y < 0 or x >= w or y >= h:
            continue
        visited.add((x, y))
        r, g, b, a = pixels[x, y]
        if not is_bg_color(r, g, b):
            continue
        pixels[x, y] = (0, 0, 0, 0)
        count += 1
        q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])

    img.save(out, "PNG")
    print("saved", out, os.path.getsize(out), "transparent_px", count)
