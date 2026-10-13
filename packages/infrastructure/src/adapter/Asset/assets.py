# assets.py — the pixel work of the asset store (ADR 0019: Python only as an adapter's internals). It decides
# nothing: every color, distance and margin comes from the core.
#   assets.py clean <pairs json: [[in, out], ...]> <values json>
#       -> each sprite with the clip's light background taken out of its edge; stdout: the written files
#   assets.py face <parts json: [{part, image, mask?, out}, ...]> <scale> <values json>
#       -> each face part scaled from still to sprite size; stdout: [{part, file, x, y, width, height}, ...]
import json
import sys

import cv2
import numpy as np
from PIL import Image


def clean(rgba, v):
    """Separates the edge from the background the sprite was cut on, drops loose bits of it and the blue cast it gave
    the outline. Thin pieces without an inside (glasses frames) stay as they are."""
    background = np.array(v["background"], np.float64)
    a = rgba.astype(np.float32)
    alpha, rgb = a[..., 3], a[..., :3]
    if not (alpha > 0).any():
        return rgba
    outside = cv2.distanceTransform(np.pad((alpha > 0).astype(np.uint8), 1), cv2.DIST_L2, 3)[1:-1, 1:-1]
    inner = (alpha >= 250) & (outside >= v["innerDepth"])
    if not inner.any():
        return rgba
    to_inner = cv2.distanceTransform((~inner).astype(np.uint8), cv2.DIST_L2, 3)
    # the color an edge pixel is mixed from is the outline next to it: the darkest opaque pixel nearby
    opaque = np.where((alpha >= 250)[..., None], rgb, 255.0).astype(np.float32)
    reach = 2 * v["outlineReach"] + 1
    outline = np.stack([cv2.erode(opaque[..., c], np.ones((reach, reach), np.uint8)) for c in range(3)], -1)
    edge = (alpha > 0) & (outside < v["edgeDepth"]) & (to_inner <= v["innerReach"])
    from_bg = np.abs(rgb - background).sum(2)
    outline_bg = np.abs(outline - background).sum(2)
    mixed = edge & (from_bg < v["mixShare"] * outline_bg) & (outline.sum(2) < v["darkSum"])
    share = np.clip(from_bg / np.maximum(outline_bg, 1), 0, 1)
    a[..., 3] = np.where(mixed, alpha * share, alpha)
    a[..., :3] = np.where((mixed | (edge & (alpha < 250)))[..., None], outline, rgb)
    loose = (from_bg < v["looseDistance"]) & (outside < v["looseDepth"])
    a[..., 3] = np.where(loose, 0, a[..., 3])
    c3 = a[..., :3]
    dark = (a[..., 3] > 200) & (c3.sum(2) < v["outlineSum"])
    cast = (a[..., 3] > 0) & (c3.sum(2) < v["castSum"]) & (c3[..., 2] > c3[..., 0] + v["castBlue"]) & (outside < v["castDepth"])
    clean_dark = dark & ~(c3[..., 2] > c3[..., 0] + v["cleanBlue"])
    if cast.any() and clean_dark.any():
        a[..., :3] = np.where(cast[..., None], np.median(c3[clean_dark], 0), c3)
    return np.clip(a, 0, 255).astype(np.uint8)


def part_layer(entry, v):
    """A face part in still pixels; the blank head takes its alpha from its softened, widened mask."""
    image = np.asarray(Image.open(entry["image"]).convert("RGBA" if "mask" not in entry else "RGB")).astype(np.float32)
    if "mask" not in entry:
        return image
    mask = np.asarray(Image.open(entry["mask"])) > 0
    wide = cv2.dilate(mask.astype(np.uint8), np.ones((v["blankDilate"], v["blankDilate"]), np.uint8)).astype(np.float32)
    return np.dstack([image, cv2.GaussianBlur(wide, (0, 0), v["blankBlur"]) * 255])


def scaled(layer, scale, v):
    """The part cropped to its pixels with a margin, scaled by area, and its place at sprite size."""
    rows, cols = np.where(layer[..., 3] > v["alphaFloor"])
    y0, y1 = rows.min() - v["cropBefore"], rows.max() + v["cropAfter"]
    x0, x1 = cols.min() - v["cropBefore"], cols.max() + v["cropAfter"]
    crop = layer[y0:y1, x0:x1]
    alpha = crop[..., 3:] / 255
    w, h = max(1, int(round((x1 - x0) * scale))), max(1, int(round((y1 - y0) * scale)))
    weighted = cv2.resize(crop[..., :3] * alpha, (w, h), interpolation=cv2.INTER_AREA)
    small_alpha = cv2.resize(alpha[..., 0], (w, h), interpolation=cv2.INTER_AREA)
    rgb = np.clip(weighted / np.maximum(small_alpha[..., None], 1e-6), 0, 255)
    image = np.dstack([rgb, np.clip(small_alpha, 0, 1) * 255]).astype(np.uint8)
    return image, (x0 * scale, y0 * scale, (x1 - x0) * scale, (y1 - y0) * scale)


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    if command == "clean" and len(sys.argv) == 4:
        values = json.loads(sys.argv[3])
        written = []
        for source, target in json.loads(sys.argv[2]):
            Image.fromarray(clean(np.asarray(Image.open(source).convert("RGBA")), values)).save(target)
            written.append(target)
        print(json.dumps(written))
    elif command == "face" and len(sys.argv) == 5:
        scale, values = float(sys.argv[3]), json.loads(sys.argv[4])
        placed = []
        for entry in json.loads(sys.argv[2]):
            image, (x, y, w, h) = scaled(part_layer(entry, values), scale, values)
            Image.fromarray(image).save(entry["out"])
            placed.append({"part": entry["part"], "file": entry["out"], "x": x, "y": y, "width": w, "height": h})
        print(json.dumps(placed))
    else:
        sys.stderr.write("usage: assets.py clean <pairs> <values> | face <parts> <scale> <values>")
        sys.exit(64)
