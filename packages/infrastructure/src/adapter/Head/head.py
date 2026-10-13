# head.py — the pixel work of the head tracker (ADR 0019: Python only as an adapter's internals). It decides nothing:
# the thresholds, bands, margins and the scale search come from the core.
#   head.py track <still> <frames json> <ear json> <values json>
#     -> stdout: {scale, origin: [[x, y] per frame], earOffset: [px per frame]}
# The origin is where the still's (0, 0) lands in each sprite frame, at the scale the still's head matches best.
import json
import sys

import cv2
import numpy as np
from PIL import Image


def head_box(still, values):
    """The head on the still: the figure's top band, as wide as the figure is there, with a margin."""
    background = np.median(still[:4].reshape(-1, 3), 0)
    figure = np.abs(still - background).sum(2) > values["background"]
    rows = np.where(figure.any(1))[0]
    top, bottom = rows.min(), rows.max()
    cols = np.where(figure[top:top + int((bottom - top) * values["headWidthBand"])].any(0))[0]
    m = values["margin"]
    return (int(cols.min() - m), int(top - m), int(cols.max() + m), int(top + (bottom - top) * values["headHeightBand"]))


def on_background(path, background, border):
    """A sprite composed on the still's background, with a border so a template can reach past its edge."""
    a = np.asarray(Image.open(path).convert("RGBA")).astype(np.float32)
    flat = a[..., :3] * a[..., 3:] / 255 + background * (1 - a[..., 3:] / 255)
    return cv2.copyMakeBorder(flat, border, border, border, border, cv2.BORDER_CONSTANT, value=background.tolist())


def best_scale(still, box, frames, values):
    """The median over the frames of the scale at which the still's head matches best."""
    template = still[box[1]:box[3], box[0]:box[2]]
    scales = np.arange(values["scaleFrom"], values["scaleTo"], values["scaleStep"])
    best = []
    for frame in frames:
        errors = []
        for s in scales:
            t = cv2.resize(template, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
            errors.append((cv2.minMaxLoc(cv2.matchTemplate(frame, t, cv2.TM_SQDIFF))[0] / (template.size * s * s), s))
        best.append(min(errors)[1])
    return float(np.median(best))


def subpixel(a, b, c):
    """The vertex of the parabola through three neighboring match errors."""
    d = a - 2 * b + c
    return 0.0 if d == 0 else 0.5 * (a - c) / d


def best_at(r):
    """The best place of a match result, to a fraction of a pixel."""
    _, _, (x, y), _ = cv2.minMaxLoc(r)
    dx = subpixel(r[y, x - 1], r[y, x], r[y, x + 1]) if 0 < x < r.shape[1] - 1 else 0
    dy = subpixel(r[y - 1, x], r[y, x], r[y + 1, x]) if 0 < y < r.shape[0] - 1 else 0
    return x + dx, y + dy


def track(still, box, frames, scale, border, near=None, reach=0):
    """Where the still's (0, 0) lands in every frame when its `box` is matched there; with `near` (an origin per
    frame) only within `reach` pixels of where that origin puts the box, so a like shape elsewhere is not taken."""
    template = cv2.resize(still[box[1]:box[3], box[0]:box[2]], None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    th, tw = template.shape[:2]
    out = []
    for k, frame in enumerate(frames):
        x0 = y0 = 0
        if near is not None:
            ex, ey = int(round(near[k][0] + border + box[0] * scale)), int(round(near[k][1] + border + box[1] * scale))
            x0, y0 = max(0, ex - reach), max(0, ey - reach)
            frame = frame[y0:min(frame.shape[0], ey + th + reach), x0:min(frame.shape[1], ex + tw + reach)]
        x, y = best_at(cv2.matchTemplate(frame, template, cv2.TM_SQDIFF))
        out.append((x0 + x - border - box[0] * scale, y0 + y - border - box[1] * scale))
    return np.array(out)


def run(still_path, frame_paths, ear, values):
    still = np.asarray(Image.open(still_path).convert("RGB")).astype(np.float32)
    background = np.median(still[:4].reshape(-1, 3), 0)
    frames = [on_background(p, background, values["border"]) for p in frame_paths]
    box = head_box(still, values)
    scale = best_scale(still, box, frames, values)
    head = track(still, box, frames, scale, values["border"])
    ear_box = (ear["left"], ear["top"], ear["right"], ear["bottom"])
    ear_at = track(still, ear_box, frames, scale, values["border"], head, values["earReach"])
    d = ear_at - head
    stray = np.hypot(d[:, 0] - np.median(d[:, 0]), d[:, 1] - np.median(d[:, 1]))
    return {"scale": scale, "origin": head.tolist(), "earOffset": stray.tolist()}


if __name__ == "__main__":
    if len(sys.argv) == 6 and sys.argv[1] == "track":
        print(json.dumps(run(sys.argv[2], json.loads(sys.argv[3]), json.loads(sys.argv[4]), json.loads(sys.argv[5]))))
    else:
        sys.stderr.write("usage: head.py track <still> <frames json> <ear json> <values json>")
        sys.exit(64)
