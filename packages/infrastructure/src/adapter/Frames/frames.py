# frames.py — the pixel work of the frame adapters (ADR 0019: Python only as an adapter's internals). It decides
# nothing: every threshold, every chosen frame, every shift, the margin and the height come from the core.
#   frames.py measure <clip> <values json>            -> stdout: one measure per video frame (JSON list)
#   frames.py cut <clip> <plan json> <values json> <out dir>
#                                                     -> sprites 00.png ...; stdout: {frames, scale, width, height}
#   frames.py hands <job json>                        -> paints the job's finger states into its sprites in place;
#                                                        stdout: {positions: [[x, y] of the hands per sprite]}
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image


def read_clip(path):
    """Every frame of the clip as RGB; a clip that cannot be read ends the step with exit code 2."""
    cap = cv2.VideoCapture(path)
    frames = []
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frames.append(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    if not frames:
        sys.stderr.write(f"no frames in {path}")
        sys.exit(2)
    return frames


def figure_mask(frame, values):
    """The figure: what the background flood from the border does not reach, opened, its largest piece."""
    a = frame.astype(int)
    border = np.concatenate([a[:4].reshape(-1, 3), a[:, :4].reshape(-1, 3), a[:, -4:].reshape(-1, 3)])
    distance = np.abs(a - np.median(border, 0)).sum(2)
    flood = np.pad((distance < values["background"]).astype(np.uint8), 1, constant_values=1)
    cv2.floodFill(flood, None, (0, 0), 2)
    mask = (flood[1:-1, 1:-1] != 2) & ~(distance < values["inside"])
    mask = cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)).astype(bool)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), 8)
    return labels == (1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])) if count > 1 else mask


def measure(clip, values):
    """Per frame: the figure's box, the spread of its feet, the centre of its head and the change from the last frame."""
    frames = read_clip(clip)
    out = []
    for i, frame in enumerate(frames):
        mask = figure_mask(frame, values)
        rows = np.where(mask.any(1))[0]
        cols = np.where(mask.any(0))[0]
        top, bottom = rows.min(), rows.max()
        feet = mask[int(top + (bottom - top) * values["legBand"]):bottom + 1]
        feet_cols = np.where(feet.any(0))[0]
        head = mask[:int(top + values["headBand"] * np.ptp(rows))]
        change = 0.0 if i == 0 else float(np.abs(frame.astype(float) - frames[i - 1].astype(float)).mean())
        out.append({
            "top": int(top), "bottom": int(bottom), "left": int(cols.min()), "right": int(cols.max()),
            "legSpread": float(feet_cols.max() - feet_cols.min()),
            "headCenterX": float(np.where(head.any(0))[0].mean()),
            "change": change,
        })
    return out


def shifted(frame, mask, dx, dy):
    """The frame and its mask moved by dx (sub-pixel, linear) and dy (whole rows)."""
    if dx != 0:
        move = np.float32([[1, 0, dx], [0, 1, 0]])
        size = (frame.shape[1], frame.shape[0])
        frame = cv2.warpAffine(frame, move, size, flags=cv2.INTER_LINEAR)
        mask = cv2.warpAffine(mask.astype(np.uint8) * 255, move, size, flags=cv2.INTER_LINEAR) > 127
    return np.roll(frame, dy, 0), np.roll(mask, dy, 0)


def cut(clip, plan, values, out_dir):
    """Shifts the planned frames, crops them to one box with the plan's margin, scales the tallest to its height."""
    frames = read_clip(clip)
    chosen = [shifted(frames[s["source"]], figure_mask(frames[s["source"]], values), s["shiftX"], s["shiftY"])
              for s in plan["sprites"]]
    for (_, mask), sprite in zip(chosen, plan["sprites"]):
        edges = [name for name, line in (("top", mask[0]), ("bottom", mask[-1]), ("left", mask[:, 0]),
                                         ("right", mask[:, -1])) if line.any()]
        if edges:
            sys.stderr.write(f"the figure leaves the clip at its {' and '.join(edges)} edge in video frame "
                             f"{sprite['source']}: a part of it is cut off")
            sys.exit(1)
    rows = np.concatenate([np.where(m.any(1))[0] for _, m in chosen])
    cols = np.concatenate([np.where(m.any(0))[0] for _, m in chosen])
    margin = plan["margin"]
    y0, y1 = rows.min() - margin["top"], rows.max() + 1 + margin["bottom"]
    x0, x1 = cols.min() - margin["left"], cols.max() + 1 + margin["right"]
    tallest = max(np.ptp(np.where(m.any(1))[0]) for _, m in chosen) + 1
    scale = plan["height"] / tallest
    width, height = int(round((x1 - x0) * scale)), int(round((y1 - y0) * scale))
    # a margin may reach past the clip's edge: the frames get that much empty background around them
    pad = max(0, -y0, -x0, y1 - frames[0].shape[0], x1 - frames[0].shape[1])
    chosen = [(np.pad(f, ((pad, pad), (pad, pad), (0, 0))), np.pad(m, pad)) for f, m in chosen]
    y0, y1, x0, x1 = y0 + pad, y1 + pad, x0 + pad, x1 + pad
    os.makedirs(out_dir, exist_ok=True)
    written = []
    for k, (frame, mask) in enumerate(chosen):
        soft = cv2.GaussianBlur(mask.astype(np.float32), (3, 3), 0)[y0:y1, x0:x1]
        colour = frame[y0:y1, x0:x1].astype(np.float32)
        weighted = cv2.resize(colour * soft[..., None], (width, height), interpolation=cv2.INTER_AREA)
        alpha = cv2.resize(soft, (width, height), interpolation=cv2.INTER_AREA)
        rgb = np.clip(weighted / np.maximum(alpha[..., None], 1e-6), 0, 255).astype(np.uint8)
        path = os.path.join(out_dir, f"{k:02d}.png")
        Image.fromarray(np.dstack([rgb, (np.clip(alpha, 0, 1) * 255).astype(np.uint8)])).save(path)
        written.append(path)
    return {"frames": written, "scale": float(scale), "width": width, "height": height}


def scaled_premultiplied(rgb, alpha, scale):
    """An RGB image with its alpha scaled by area, the colour weighted by the alpha so edges keep their colour."""
    size = (max(1, int(round(rgb.shape[1] * scale))), max(1, int(round(rgb.shape[0] * scale))))
    weighted = cv2.resize(rgb * alpha[..., None], size, interpolation=cv2.INTER_AREA)
    a = cv2.resize(alpha, size, interpolation=cv2.INTER_AREA)
    return np.clip(weighted / np.maximum(a[..., None], 1e-6), 0, 255), np.clip(a, 0, 1)


def hands(job):
    """Finds the hands of the still in every sprite and, where the job says, paints a state's hands there: only the
    pixels where some state differs from the still change, so the forearms and everything else stay the sprite's."""
    still = np.asarray(Image.open(job["still"]).convert("RGB")).astype(np.float32)
    background = np.median(still[:4].reshape(-1, 3), 0)
    b = job["box"]
    crop = (slice(b["top"], b["bottom"]), slice(b["left"], b["right"]))
    states = [np.asarray(Image.open(p).convert("RGB")).astype(np.float32)[crop] for p in job["states"]]
    if any(s.shape != still[crop].shape for s in states):
        sys.stderr.write("a state drawing is not the size of the still")
        sys.exit(2)
    changed = np.zeros(still[crop].shape[:2], bool)
    for s in states:
        changed |= np.abs(s - still[crop]).sum(2) > 45
    region = cv2.dilate(changed.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(np.float32)
    scale = job["scale"]
    template = cv2.resize(still[crop], None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    region = cv2.resize(region, (template.shape[1], template.shape[0]), interpolation=cv2.INTER_AREA) > 0.5
    painted = []
    for s in states:
        alpha = np.clip(np.abs(s - background).sum(2) / 120, 0, 1)
        painted.append(scaled_premultiplied(s, alpha, scale))
    th, tw = template.shape[:2]
    border, reach = max(th, tw), job["reach"]
    positions, previous = [], None
    for path, state in zip(job["frames"], job["sequence"]):
        sprite = np.asarray(Image.open(path).convert("RGBA")).astype(np.float32)
        flat = sprite[..., :3] * sprite[..., 3:] / 255 + background * (1 - sprite[..., 3:] / 255)
        flat = cv2.copyMakeBorder(flat, border, border, border, border, cv2.BORDER_CONSTANT, value=background.tolist())
        x0 = y0 = 0
        if previous is not None:
            x0, y0 = max(0, previous[0] - reach), max(0, previous[1] - reach)
            flat = flat[y0:previous[1] + th + reach, x0:previous[0] + tw + reach]
        _, _, (x, y), _ = cv2.minMaxLoc(cv2.matchTemplate(flat, template, cv2.TM_SQDIFF))
        previous = (x0 + x, y0 + y)
        px, py = previous[0] - border, previous[1] - border
        positions.append([px, py])
        if state is None:
            continue
        rgb, alpha = painted[state]
        h, w = sprite.shape[:2]
        ys, xs = np.nonzero(region)
        ty, tx = ys + py, xs + px
        inside = (ty >= 0) & (ty < h) & (tx >= 0) & (tx < w)
        sprite[ty[inside], tx[inside], :3] = rgb[ys[inside], xs[inside]]
        sprite[ty[inside], tx[inside], 3] = alpha[ys[inside], xs[inside]] * 255
        Image.fromarray(np.clip(sprite, 0, 255).astype(np.uint8)).save(path)
    return {"positions": positions}


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    if command == "measure" and len(sys.argv) == 4:
        print(json.dumps(measure(sys.argv[2], json.loads(sys.argv[3]))))
    elif command == "cut" and len(sys.argv) == 6:
        print(json.dumps(cut(sys.argv[2], json.loads(sys.argv[3]), json.loads(sys.argv[4]), sys.argv[5])))
    elif command == "hands" and len(sys.argv) == 3:
        print(json.dumps(hands(json.loads(sys.argv[2]))))
    else:
        sys.stderr.write("usage: frames.py measure <clip> <values> | cut <clip> <plan> <values> <out dir> | hands <job>")
        sys.exit(64)
