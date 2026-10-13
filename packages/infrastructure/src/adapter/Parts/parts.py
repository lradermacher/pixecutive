# parts.py — the pixel work of the part cutter (ADR 0019: Python only as an adapter's internals). It decides nothing:
# the thresholds, the grids and the fits come from the core; every subcommand takes one job as JSON and answers JSON.
#   parts.py <grid|split|key_cut|hat_cut|glasses_cut|variant_cut|under_hat|fit|skull|first_rows> <job json>
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image


def rgb(path, size=None):
    """An image as float RGB, resized with LANCZOS to `size` (width, height) when given: the model may answer in another size."""
    image = Image.open(path).convert("RGB")
    if size is not None and image.size != tuple(size):
        image = image.resize(tuple(size), Image.LANCZOS)
    return np.asarray(image).astype(np.float32)


def alpha(path):
    """An image's alpha channel."""
    return np.asarray(Image.open(path).convert("RGBA"))[..., 3]


def save_rgba(path, color, opacity):
    """Writes color (float RGB) and opacity (0..1) as an RGBA PNG."""
    Image.fromarray(np.dstack([np.clip(color, 0, 255), np.clip(opacity, 0, 1) * 255]).astype(np.uint8)).save(path)


def span(start, stop, step):
    """The values from `start` to `stop` included, in steps of `step`."""
    return np.arange(start, stop + step / 10, step)


def kernel(size):
    return np.ones((size, size), np.uint8)


def dilate(mask, size):
    return cv2.dilate(mask.astype(np.uint8), kernel(size)) > 0


def erode_color(image, size):
    """Each channel eroded: the darkest color around every pixel."""
    return np.stack([cv2.erode(image[..., c], kernel(size)) for c in range(3)], -1)


def green_excess(image):
    return np.clip(image[..., 1] - np.maximum(image[..., 0], image[..., 2]), 0, 255)


def search(err, coarse, fine):
    """The scale and shift with the least error: the coarse grid first, then the fine grid around its best."""
    best = (err(1.0, 0, 0), 1.0, 0, 0)
    for sc in span(coarse["scaleFrom"], coarse["scaleTo"], coarse["scaleStep"]):
        for dy in span(-coarse["shift"], coarse["shift"], coarse["shiftStep"]):
            for dx in span(-coarse["shift"], coarse["shift"], coarse["shiftStep"]):
                e = err(sc, dx, dy)
                if e < best[0]:
                    best = (e, sc, dx, dy)
    _, s0, x0, y0 = best
    for sc in span(s0 - fine["scale"], s0 + fine["scale"], fine["scaleStep"]):
        for dy in span(y0 - fine["shift"], y0 + fine["shift"], fine["shiftStep"]):
            for dx in span(x0 - fine["shift"], x0 + fine["shift"], fine["shiftStep"]):
                e = err(sc, dx, dy)
                if e < best[0]:
                    best = (e, sc, dx, dy)
    return best


def warp_about(image, sc, dx, dy, centre, shape):
    """Scales about `centre` (x, y) and shifts by dx, dy into an image of `shape` (width, height)."""
    cx, cy = centre
    matrix = np.float32([[sc, 0, cx - sc * cx + dx], [0, sc, cy - sc * cy + dy]])
    return cv2.warpAffine(image, matrix, shape, flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)


def near_template(drawing, template, radius):
    """Per pixel the least color change against the template within `radius` pixels."""
    near = np.full(drawing.shape[:2], 1e9, np.float32)
    for oy in range(-radius, radius + 1):
        for ox in range(-radius, radius + 1):
            near = np.minimum(near, np.abs(drawing - np.roll(np.roll(template, oy, 0), ox, 1)).sum(2))
    return near


def grid(job):
    """The grid image: the still's box once per cell, resized to the cell, on a canvas of the grid's size."""
    layout, cells = job["layout"], job["cells"]
    still = Image.open(job["still"]).convert("RGB")
    box = layout["box"]
    tile = still.crop((box["left"], box["top"], box["right"], box["bottom"]))
    # where the cells leave a line uncovered, the color at the box's top left corner shows
    canvas = Image.new("RGB", (layout["width"], layout["height"]), still.getpixel((box["left"], box["top"])))
    for cell in cells:
        canvas.paste(tile.resize((cell["right"] - cell["left"], cell["bottom"] - cell["top"]), Image.LANCZOS), (cell["left"], cell["top"]))
    canvas.save(job["out"])
    return {"cells": len(cells)}


def split(job):
    """Each cell of a drawn grid back into the still's box, on a copy of the base still: one still per drawing."""
    layout = job["layout"]
    drawn = Image.open(job["grid"]).convert("RGB").resize((layout["width"], layout["height"]), Image.LANCZOS)
    box = layout["box"]
    outs = []
    for cell, out in zip(job["cells"], job["outs"]):
        part = drawn.crop((cell["left"], cell["top"], cell["right"], cell["bottom"]))
        part = part.resize((box["right"] - box["left"], box["bottom"] - box["top"]), Image.LANCZOS)
        still = Image.open(job["base"]).convert("RGB")
        still.paste(part, (box["left"], box["top"]))
        still.save(out)
        outs.append(out)
    return {"stills": outs}


def key_cut(job):
    """Hair, a beard or hair under a hat from a drawing on the green still: aligned on the unchanged lines, every pixel
    that is neither the green skin nor the background nor the unchanged template, separated from the green."""
    v, kind = job["values"], job["kind"]
    G = rgb(job["green"])
    V0 = rgb(job["drawing"], G.shape[1::-1])
    m = alpha_or_mask(job["mask"])
    ys, xs = np.where(m)
    fy0, fy1, fx0, fx1 = ys.min(), ys.max(), xs.min(), xs.max()
    w = dilate(dilate(m, 5) & (G.sum(2) < 250), 5).astype(np.float32)
    cy0, cy1, cx0, cx1 = fy0 - 40, fy1 + 40, fx0 - 40, fx1 + 40
    if kind == "hair-under-hat":
        # under a hat the model redraws the face a little larger; the body outline below the chin stays in place
        w = (G.sum(2) < 250).astype(np.float32)
        w[: fy1 + 30] = 0
        w[int(G.shape[0] * 0.8) :] = 0
        w = cv2.dilate(w, kernel(3))
        cy0, cy1, cx0, cx1 = fy1 + 20, int(G.shape[0] * 0.8) + 10, 0, G.shape[1]
    Sc, Vc, wc = G[cy0:cy1, cx0:cx1], V0[cy0:cy1, cx0:cx1], w[cy0:cy1, cx0:cx1]
    centre = ((fx0 + fx1) / 2, (fy0 + fy1) / 2)

    def err(sc, dx, dy):
        W = warp_about(Vc, sc, dx, dy, (centre[0] - cx0, centre[1] - cy0), Sc.shape[1::-1])
        return float((np.abs(W - Sc).sum(2) * wc).sum() / wc.sum() / 3)

    e, sc, dx, dy = search(err, v["coarse"], v["fine"])
    V = warp_about(V0, sc, dx, dy, centre, G.shape[1::-1])
    if kind == "hair-under-hat":
        magenta = (V[..., 0] > 140) & (V[..., 2] > 140) & (V[..., 1] < 110)
        magenta = cv2.morphologyEx(magenta.astype(np.uint8), cv2.MORPH_CLOSE, kernel(5)) > 0
        ring = dilate(magenta, 9) & (V.sum(2) < 250)
        V[magenta | ring] = (0.0, 255.0, 0.0)
    bg = np.median(G[:4].reshape(-1, 3), 0)
    gx = green_excess(V)
    green = gx > v["green"]
    near = near_template(V, G, 2)
    if kind == "hair-under-hat":  # below the chin the body may move up to 5 px
        near[fy1 + 20 :] = near_template(V, G, 5)[fy1 + 20 :]
    on_background = np.abs(V - bg).sum(2) < v["background"]
    hair = ~green & ~on_background & (near > v["changed"])
    if kind == "beard":
        zone = np.zeros(m.shape, bool)
        zone[fy0 + int((fy1 - fy0) * 0.35) : fy1 + 70, fx0 - 70 : fx1 + 30] = True
        hair &= zone
    hair = cv2.morphologyEx(hair.astype(np.uint8), cv2.MORPH_OPEN, kernel(2)).astype(bool)
    # the redrawn outline and features are a few pixels off; thin lines are no hair, the features never are
    if kind == "beard":  # a beard may lie around the mouth; only eyes, brows and nose are taboo
        fm = np.zeros(m.shape, bool)
        for path in job["features"]:
            fm |= alpha(path) > 20
        feat = dilate(fm, v["features"])
    elif kind == "hair-under-hat":  # a strand may pass right beside a brow: only the features themselves are taboo
        feat = m.copy()
    else:
        feat = dilate(m, v["features"])
    hair &= ~feat
    lines = dilate(G.sum(2) < 250, 9)
    thick_size = v["thickness"]
    thick = (
        cv2.morphologyEx(hair.astype(np.uint8), cv2.MORPH_OPEN, kernel(thick_size))
        if kind in ("hair", "hair-under-hat")
        else hair.astype(np.uint8)
    )
    cn, lb, cs, _ = cv2.connectedComponentsWithStats(cv2.dilate(thick, kernel(11)), 8)
    core = np.zeros(m.shape, bool)
    smallest = v["smallest"]
    for j in range(1, cn):
        _, y_, _, h_, area = cs[j]
        if kind == "hair" and area >= smallest["hair"] and y_ < fy0:  # reaches above the brows
            core |= (lb == j) & (thick > 0)
        if kind == "hair-under-hat" and area >= smallest["hairUnderHat"] and y_ < fy1:
            core |= (lb == j) & (thick > 0)
        if kind == "beard" and area >= smallest["beard"] and y_ + h_ > fy0 + (fy1 - fy0) * 0.5:
            core |= (lb == j) & (thick > 0)
    grow = core | (hair & dilate(core, 7))
    thin = hair & ~lines
    _, lb2 = cv2.connectedComponents(thin.astype(np.uint8), connectivity=8)
    touch = np.unique(lb2[dilate(grow, 3) & (lb2 > 0)])
    keep = grow | (np.isin(lb2, touch) & (lb2 > 0))
    # inside the hair's closed area everything that is not green, background or a feature is hair, in the darkest
    # color around it: hair lying exactly on the old outline looks unchanged and would leave an arc
    region = cv2.morphologyEx(keep.astype(np.uint8), cv2.MORPH_CLOSE, kernel(9)).astype(bool)
    outline = dilate(G.sum(2) < 200, 7)
    fill = region & ~keep & ~(gx > 60) & ~feat & (~on_background | outline)
    V = np.where(fill[..., None], erode_color(V, 3), V)
    keep |= fill
    # the still's light rim between its outline and the hair becomes part of the dark outline
    sliver = dilate(keep, 7) & ~keep & dilate(G.sum(2) < 200, 5) & ~(gx > 60) & ~feat & ((G.sum(2) > 330) | on_background)
    V = np.where(sliver[..., None], erode_color(V, 5), V)
    keep |= sliver
    # a pixel blended with the green skin is a*hair + (1-a)*green: its opacity and color are solved from the hair
    # color of its non-green neighbors
    gx2 = green_excess(V)
    olive = (V[..., 1] > 0.85 * V[..., 0]) & (V[..., 1] > V[..., 2] + 15) & (V.sum(2) > 60)
    pure = keep & (gx2 < 6) & ~olive
    if pure.any():
        pm = pure.astype(np.float32)
        blurred = cv2.GaussianBlur(pm, (0, 0), 6)
        loc = np.stack([cv2.GaussianBlur(V[..., c] * pm, (0, 0), 6) for c in range(3)], -1) / np.maximum(blurred, 1e-3)[..., None]
        loc = np.where((blurred > 0.02)[..., None], loc, np.median(V[pure], 0))
        mix = keep & ((gx2 >= 6) | olive)
        a_mix = np.clip((255.0 - V[..., 1]) / np.maximum(255.0 - loc[..., 1], 1), v["floor"], 1)
        V = np.where(mix[..., None], loc, V)
        solved = np.where(mix, a_mix, 1.0)
    else:
        solved = np.ones(keep.shape)
    V[..., 1] = np.minimum(V[..., 1], np.maximum(V[..., 0], V[..., 2]) + v["spill"])
    # small enclosed holes are hair the threshold missed
    hn, hl, hs, _ = cv2.connectedComponentsWithStats((~keep).astype(np.uint8), 4)
    for j in range(1, hn):
        if hs[j][4] < v["holes"] and not green[hl == j].mean() > 0.5:
            keep |= hl == j
    # thin gaps along a contour are closed, never over green skin or a feature, in the darkest neighbor's color
    gaps = cv2.morphologyEx(keep.astype(np.uint8), cv2.MORPH_CLOSE, kernel(3)).astype(bool) & ~keep & ~(gx > 60) & ~feat
    V = np.where(gaps[..., None], erode_color(V, 3), V)
    keep |= gaps
    if kind in ("hair", "hair-under-hat"):
        gap = dilate(keep, 5) & ~keep & (G.sum(2) > 500) & dilate(G.sum(2) < 200, 5) & (gx < 60)
        V = np.where(gap[..., None], erode_color(V, 5), V)
        keep |= gap
    if kind == "hair-under-hat":
        # the body drawn a few pixels off: up to 4 px of background between hair and body outline become outline
        still_background = np.abs(G - bg).sum(2) < 45
        seam = still_background & ~keep & dilate(keep, 9) & dilate(G.sum(2) < 200, 9)
        V = np.where(seam[..., None], erode_color(V, 7), V)
        keep |= seam
    if kind in ("hair", "hair-under-hat"):
        # the still's own dark lines inside the hair are filled from the hair around them
        hull = cv2.morphologyEx(keep.astype(np.uint8), cv2.MORPH_CLOSE, kernel(15)).astype(bool)
        under = hull & ~keep & (G.sum(2) < 330) & ~(gx > 60) & ~feat & ~on_background
        if under.any():
            V = cv2.inpaint(np.clip(V, 0, 255).astype(np.uint8), under.astype(np.uint8), 4, cv2.INPAINT_TELEA).astype(np.float32)
            keep |= under
    hat_alpha = None
    if kind == "hair-under-hat":
        # hair under a hat lies only where the hairstyle without a hat lies, and only in its colors
        Hh = np.asarray(Image.open(job["hairless"]).convert("RGBA")).astype(np.float32)
        zone = dilate(Hh[..., 3] > 40, 7)
        hat_alpha = alpha(job["hat"]) > 60
        zone |= dilate(hat_alpha, 21) & ~hat_alpha & ~m
        luminance = 0.3 * V[..., 0] + 0.59 * V[..., 1] + 0.11 * V[..., 2]
        hair_luminance = 0.3 * Hh[..., 0] + 0.59 * Hh[..., 1] + 0.11 * Hh[..., 2]
        light = luminance > np.percentile(hair_luminance[Hh[..., 3] > 200], 98) + 25
        keep &= zone & ~light
        own = Hh[..., 3] > 40
        rim = (G.sum(2) > 450) & dilate(G.sum(2) < 200, 7) & (gx < 60)
        gap = rim & own & ~keep & dilate(keep, 13)
        V = np.where(gap[..., None], erode_color(V, 7), V)
        keep |= gap
        # narrow slits enclosed by hair and body, where the background would show through, are painted from the hair
        still_background_wide = np.abs(G - bg).sum(2) < 60
        sn, sl, ss, _ = cv2.connectedComponentsWithStats((~keep & still_background_wide).astype(np.uint8), 4)
        edge_ids = set(np.unique(np.concatenate([sl[0], sl[-1], sl[:, 0], sl[:, -1]])))
        small = [j for j in range(1, sn) if j not in edge_ids and ss[j][4] < 800]
        slit = np.isin(sl, small) & zone
        if slit.any():
            V = cv2.inpaint(np.clip(V, 0, 255).astype(np.uint8), slit.astype(np.uint8), 3, cv2.INPAINT_TELEA).astype(np.float32)
            keep |= slit
        # a strand that does not reach the hat but lies on the head would float in the face
        Os = rgb(job["open"])
        bgO = np.median(Os[:6].reshape(-1, 3), 0)
        head = (np.abs(Os - bgO).sum(2) > 60) & (Os.sum(2) > 330)
        head[int(Os.shape[0] * 0.42) :] = False
        from_hat = cv2.distanceTransform((~hat_alpha).astype(np.uint8), cv2.DIST_L2, 3)
        ln, ll, _, _ = cv2.connectedComponentsWithStats((keep & ~hat_alpha).astype(np.uint8), 8)
        for j in range(1, ln):
            c = ll == j
            if from_hat[c].min() > 3 and (c & head).sum() / c.sum() > 0.5:
                keep &= ~c
    # loose bits not attached to the main mass go
    cn3, lb3, cs3, _ = cv2.connectedComponentsWithStats(keep.astype(np.uint8), 8)
    if cn3 > 1:
        main = 1 + int(np.argmax(cs3[1:, 4]))
        mainz = dilate(lb3 == main, 5)
        for j in range(1, cn3):
            below = cs3[j][1] > fy1 + 40
            loose = cs3[j][4] < v["islands"] or (below and not (mainz & (lb3 == j)).any())
            if j != main and loose and not (kind == "beard" and cs3[j][4] >= 10):
                keep &= lb3 != j
    # soft edge: pixels blended with the green get opacity from their green excess and the color of the hair beside
    ring = dilate(keep, 3) & ~keep & ~on_background
    opacity = keep.astype(np.float32) * solved + ring * np.clip(1 - gx / v["ring"], 0, 1) * (gx > 10)
    inner = cv2.erode(keep.astype(np.uint8), kernel(3)).astype(np.float32)
    num = cv2.GaussianBlur(V * inner[..., None], (0, 0), 1.5)
    den = cv2.GaussianBlur(inner, (0, 0), 1.5)
    edge = (keep & (inner == 0)) | ring
    color = np.where(edge[..., None] & (den > 1e-3)[..., None] & (gx > 10)[..., None], num / np.maximum(den, 1e-3)[..., None], V)
    if kind == "hair-under-hat":
        outer = keep & dilate(on_background & ~keep, 3)
        loc = erode_color(V, 5)
        a_bg = np.clip(np.abs(V - bg).sum(2) / np.maximum(np.abs(loc - bg).sum(2), 1), 0, 1)
        color = np.where(outer[..., None], loc, color)
        opacity = np.where(outer, np.minimum(opacity, a_bg), opacity)
    save_rgba(job["out"], color, opacity)
    return {"scale": float(sc), "dx": float(dx), "dy": float(dy), "error": float(e), "pixels": int(keep.sum())}


def alpha_or_mask(path):
    """A mask image as booleans: its alpha where it has one, else its brightness."""
    image = Image.open(path)
    data = np.asarray(image)
    return (data[..., 3] if data.ndim == 3 and data.shape[2] == 4 else data) > 0


def hat_cut(job):
    """A hat and its hide from a drawing on the open green still: above the brows the template holds only green skin and
    background, so every other pixel there is hat; what the drawing turned into background, the head must hide."""
    v = job["values"]
    T = rgb(job["greenOpen"])
    H, W = T.shape[:2]
    G = rgb(job["green"])
    V = rgb(job["drawing"], (W, H))
    bg = np.median(T[:6].reshape(-1, 3), 0)
    gx = green_excess(V)
    # background is only what reaches the border in the background color: light shading inside a white hat is hat
    _, background_labels = cv2.connectedComponents((np.abs(V - bg).sum(2) < v["background"]).astype(np.uint8), connectivity=4)
    border = np.unique(np.concatenate([background_labels[0], background_labels[-1], background_labels[:, 0], background_labels[:, -1]]))
    on_background = np.isin(background_labels, border[border > 0])
    near = near_template(V, T, 1)
    head_rows = int(H * v["head"])
    hat = (near > v["changed"]) & (gx < v["green"]) & ~on_background
    hat[head_rows:] = False
    hat = cv2.morphologyEx(hat.astype(np.uint8), cv2.MORPH_OPEN, kernel(2)).astype(bool)
    nn, lb, st, _ = cv2.connectedComponentsWithStats(hat.astype(np.uint8), 8)
    big = 1 + int(np.argmax(st[1:, 4]))
    keep = np.zeros_like(hat)
    for j in range(1, nn):
        if st[j][4] >= v["pieces"] * st[big][4]:
            keep |= lb == j
    region = cv2.morphologyEx(keep.astype(np.uint8), cv2.MORPH_CLOSE, kernel(v["closing"])).astype(bool)
    hn, hl, hs, _ = cv2.connectedComponentsWithStats((~region).astype(np.uint8), 4)
    for j in range(1, hn):
        x_, y_, w_, h_, area = hs[j]
        if x_ > 0 and y_ > 0 and x_ + w_ < W and y_ + h_ < H and area < v["holes"]:
            region |= hl == j
    keep = region & (gx < v["green"]) & (~on_background | keep)
    # the hat's outline over the head's old outline looks unchanged: a dark pixel at the hat and at the background is it
    dark = (V.sum(2) < 360) & (gx < v["green"])
    at_bg = dilate(on_background, 7)
    for _ in range(3):
        keep |= dark & dilate(keep, 5) & at_bg & ~on_background
    keep[head_rows:] = False
    # a light part whose outline the model left open joins the background; what the closed outline encloses is hat
    shut = cv2.morphologyEx(keep.astype(np.uint8), cv2.MORPH_CLOSE, kernel(v["closing"]))
    _, hl2 = cv2.connectedComponents((1 - shut).astype(np.uint8), connectivity=4)
    outside = np.unique(np.concatenate([hl2[0], hl2[-1], hl2[:, 0], hl2[:, -1]]))
    keep |= ~np.isin(hl2, outside) & (gx < v["green"])
    ring = dilate(keep, 3) & ~keep & (gx >= v["green"]) & (gx < v["ring"])
    opacity = keep.astype(np.float32) + ring * (1 - gx / v["ring"])
    inner = cv2.erode(keep.astype(np.uint8), kernel(3)).astype(np.float32)
    num = cv2.GaussianBlur(V * inner[..., None], (0, 0), 1.5)
    den = cv2.GaussianBlur(inner, (0, 0), 1.5)
    color = np.where(ring[..., None] & (den > 1e-3)[..., None], num / np.maximum(den, 1e-3)[..., None], V)
    color[..., 1] = np.minimum(color[..., 1], np.maximum(color[..., 0], color[..., 2]) + 4)
    outer = keep & dilate(on_background & ~keep, 3)
    loc = erode_color(V, 5)
    a_bg = np.clip(np.abs(V - bg).sum(2) / np.maximum(np.abs(loc - bg).sum(2), 1), 0, 1)
    color = np.where(outer[..., None], loc, color)
    opacity = np.where(outer, np.minimum(opacity, a_bg), opacity)
    save_rgba(job["out"], color, opacity)
    # hide: the still's head where the drawing shows background, only above the brows or right at the hat
    head = np.abs(G - bg).sum(2) > v["hide"]
    head[head_rows:] = False
    brow_top = np.where(alpha_or_mask(job["mask"]))[0].min()
    reach = np.zeros((H, W), bool)
    reach[: brow_top + v["hideReach"]] = True
    reach |= dilate(keep, v["hideGrowth"])
    hide = head & on_background & ~keep & reach
    hide = dilate(hide, v["hideWidth"]) & head & ~keep & reach
    Image.fromarray(np.dstack([np.zeros((H, W, 3)), hide * 255]).astype(np.uint8)).save(job["hide"])
    return {"pixels": int(keep.sum()), "hide": int(hide.sum())}


def glasses_cut(job):
    """Glasses from a drawing on the accessory green still: aligned on the body's outline, what is new against the
    still (thin frames plus their dark rim and tinted lenses), in still coordinates."""
    v = job["values"]
    O = rgb(job["green"])
    H, W = O.shape[:2]
    V0 = rgb(job["drawing"], (W, H))
    lines = (O.sum(2) < 250).astype(np.float32)
    lines[: int(H * 0.45)] *= 0.3  # the body's outline below the head carries the fit

    def err(sc, dx, dy):
        return float((np.abs(warp_about(V0, sc, dx, dy, (W / 2, H / 2), (W, H)) - O).sum(2) * lines).sum() / lines.sum())

    e, sc, dx, dy = search(err, v["coarse"], v["fine"])
    V = warp_about(V0, sc, dx, dy, (W / 2, H / 2), (W, H))
    near = near_template(V, O, 1)
    background = np.median(O[:6].reshape(-1, 3), 0)
    on_plain = np.abs(O - background).sum(2) < 30  # over the plain background any change counts
    near = np.where(on_plain & (np.abs(V - background).sum(2) > 30), np.maximum(near, 80), near)
    key = (V[..., 1] > 180) & (V[..., 0] < 120) & (V[..., 2] < 120)
    new = ((near > v["changed"]) & ~key).astype(np.uint8)
    new[int(H * v["head"]) :] = 0
    core = cv2.morphologyEx(new, cv2.MORPH_OPEN, kernel(2))
    nn, lb, st, _ = cv2.connectedComponentsWithStats(core, 8)
    keep = np.zeros((H, W), bool)
    big = max(range(1, nn), key=lambda j: st[j][4]) if nn > 1 else 0
    for j in range(1, nn):
        if st[j][4] >= v["smallest"] or j == big:
            keep |= lb == j
    rim = dilate(keep, 3) & (V.sum(2) < v["rim"]) & (near > v["rimChange"]) & ~key
    hull = cv2.morphologyEx((keep | rim).astype(np.uint8), cv2.MORPH_CLOSE, kernel(5)) > 0
    a = (keep | rim | (hull & (near > 40))) & ~key
    a |= cv2.morphologyEx(a.astype(np.uint8), cv2.MORPH_CLOSE, kernel(v["lenses"])).astype(bool) & (near > v["lensChange"]) & ~key
    hn, hl, hs, _ = cv2.connectedComponentsWithStats((~a).astype(np.uint8), 4)
    for j in range(1, hn):
        x_, y_, w_, h_, area = hs[j]
        if area < v["holes"] and x_ > 0 and y_ > 0 and x_ + w_ < W and y_ + h_ < H:
            hole = hl == j
            if (key & hole).sum() < area * 0.5:
                a |= hole
    a = cv2.morphologyEx(a.astype(np.uint8), cv2.MORPH_CLOSE, kernel(3)).astype(bool) & ~(key & ~a)
    a &= ~((V[..., 1] > np.maximum(V[..., 0], V[..., 2]) + v["spill"]) & (V[..., 1] > v["spillFloor"]))
    edge = a & ~(cv2.erode(a.astype(np.uint8), kernel(5)) > 0)
    a &= ~(edge & (np.abs(V - background).sum(2) < 60))
    a &= ~((np.abs(V - background).sum(2) < 40) & (V[..., 2] > V[..., 0] + 15))
    nn2, l2, st2, _ = cv2.connectedComponentsWithStats(a.astype(np.uint8), 8)
    if nn2 > 1:
        big2 = max(st2[j][4] for j in range(1, nn2))
        main = np.zeros_like(a)
        for j in range(1, nn2):
            if st2[j][4] >= 0.05 * big2:
                main |= l2 == j
        near_main = dilate(main, 7)
        for j in range(1, nn2):
            cm = l2 == j
            if st2[j][4] < 0.05 * big2 and not (cm & near_main).any():
                a &= ~cm
    opacity = cv2.GaussianBlur(a.astype(np.float32), (3, 3), 0) * a
    Image.fromarray(np.dstack([np.clip(V, 0, 255), opacity * 255]).astype(np.uint8)).save(job["out"])
    return {"scale": float(sc), "dx": float(dx), "dy": float(dy), "error": float(e), "pixels": int(a.sum())}


def align_head(S, V0, v):
    """The drawing aligned to the open still on the head's outline and ear, away from the face."""
    V = V0
    bg = np.median(S[:4].reshape(-1, 3), 0)
    fig = np.abs(S - bg).sum(2) > 60
    ys = np.where(fig.any(1))[0]
    top, bot = ys.min(), ys.max()
    height = bot - top
    xs = np.where(fig[top : top + int(height * 0.33)].any(0))[0]
    hb = (xs.min() - 6, top - 6, xs.max() + 6, top + int(height * 0.36))
    reg = np.zeros(fig.shape, bool)
    reg[hb[1] : hb[3], hb[0] : hb[2]] = True
    yy, xx = np.mgrid[0 : S.shape[0], 0 : S.shape[1]]
    face = (xx > hb[0] + (hb[2] - hb[0]) * 0.38) & (yy > hb[1] + (hb[3] - hb[1]) * 0.38)
    w = cv2.dilate((reg & ~face & (S.sum(2) < 250)).astype(np.float32), kernel(5))
    pad = 40
    cx0, cy0 = max(0, hb[0] - pad), max(0, hb[1] - pad)
    cx1, cy1 = min(S.shape[1], hb[2] + pad), min(S.shape[0], hb[3] + pad)
    Sc, Vc, weight_crop = S[cy0:cy1, cx0:cx1], V[cy0:cy1, cx0:cx1], w[cy0:cy1, cx0:cx1]
    centre = ((hb[0] + hb[2]) / 2, (hb[1] + hb[3]) / 2)

    def err(sc, dx, dy):
        W = warp_about(Vc, sc, dx, dy, (centre[0] - cx0, centre[1] - cy0), Sc.shape[1::-1])
        return float((np.abs(W - Sc).sum(2) * weight_crop).sum() / weight_crop.sum() / 3)

    _, sc, dx, dy = search(err, v["coarse"], v["fine"])
    # the aligned drawing is kept in 8 bits, as the cut has always read it
    return np.clip(warp_about(V, sc, dx, dy, centre, S.shape[1::-1]), 0, 255).astype(np.uint8).astype(np.float32)


def variant_cut(job):
    """A face part's variant from a drawing of the approved face: every feature that differs from the blank head goes
    as a whole to the default part it lies nearest to, and only the wanted part's features become the layer."""
    v, part = job["values"], job["part"]
    S = rgb(job["open"])
    V = align_head(S, rgb(job["drawing"], S.shape[1::-1]), v)
    BL = rgb(job["blank"])
    m = alpha_or_mask(job["mask"])
    bg = np.median(BL[:4].reshape(-1, 3), 0)
    flood = np.pad((np.abs(BL - bg).sum(2) < 60).astype(np.uint8), 1, constant_values=1)
    cv2.floodFill(flood, None, (0, 0), 2)
    dist = cv2.distanceTransform((flood[1:-1, 1:-1] != 2).astype(np.uint8), cv2.DIST_L2, 5)
    face = dilate(m, 45) & (dist > v["edge"][part])
    d = np.abs(V - BL).sum(2)
    keys = ["brows", "eyes", "nose", "mouth"]
    seeds = [alpha(job["defaults"][q]) > 20 for q in keys]
    sd = np.stack([cv2.distanceTransform((~s).astype(np.uint8), cv2.DIST_L2, 5) for s in seeds])
    ki = keys.index(part)
    sd[ki] -= v["reach"]  # the wanted part gets a head start so a larger new shape stays whole
    keep = (np.argmin(sd, 0) == ki) & face
    if part == "eyes":
        # an eye is a feature that holds eye white; it ends at its lower lid
        cn, lb = cv2.connectedComponents(((d > v["line"]) & keep).astype(np.uint8), connectivity=8)
        white = V.min(2) > 200
        ok = np.zeros(m.shape, bool)
        for i in range(1, cn):
            p = lb == i
            if (white & p).sum() > 20:
                ok |= p & (np.arange(p.shape[0])[:, None] <= np.where((white & p).any(1))[0].max() + 5)
        keep &= dilate(ok, 5)
    if part == "nose":
        # the nose line from the far eye's corner down belongs to the nose
        white = V.min(2) > 200
        ew = white & (sd[keys.index("eyes")] < 25)
        low = np.where(ew.any(1))[0].max() + 5 if ew.any() else 0
        keep |= (np.argmin(sd, 0) == keys.index("eyes")) & face & (np.arange(m.shape[0])[:, None] > low) & (sd[keys.index("nose")] < 40)
    a = np.clip((d - v["opacityFrom"]) / v["opacityOver"], 0, 1) * keep
    cn, lb, cs, _ = cv2.connectedComponentsWithStats((a > 0.3).astype(np.uint8), 8)
    for i in range(1, cn):
        if cs[i][4] < 40:
            a[dilate(lb == i, 5)] = 0
    color = np.clip(np.where(a[..., None] > 0.02, (V - BL * (1 - a[..., None])) / np.maximum(a[..., None], 1e-3), 0), 0, 255)
    Image.fromarray(np.dstack([color, a * 255]).astype(np.uint8)).save(job["out"])
    return {"pixels": int((a > 0.1).sum())}


def under_hat(job):
    """The input for hair under a hat: the hairstyle's still at the hat layer's size with the hat's silhouette on top,
    flat magenta with a dark outline, shrunk so the hat covers where hair and hat meet."""
    hat_alpha = alpha(job["hat"])
    V = np.asarray(Image.open(job["hair"]).convert("RGB").resize(hat_alpha.shape[1::-1], Image.LANCZOS)).copy()
    hat = cv2.erode((hat_alpha > 127).astype(np.uint8), kernel(job["shrink"])) > 0
    edge = hat & ~(cv2.erode(hat.astype(np.uint8), kernel(7)) > 0)
    V[hat] = (255, 0, 255)
    V[edge] = (25, 20, 30)
    Image.fromarray(V).save(job["out"])
    return {"pixels": int(hat.sum())}


def fit(job):
    """A part of another figure fitted to this one: scaled about its box's centre and moved, premultiplied."""
    image = Image.open(job["part"]).convert("RGBA")
    x0, y0, x1, y1 = image.getbbox()
    m = np.asarray(image).astype(np.float32)
    sc, dx, dy = job["scale"], job["dx"], job["dy"]
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    matrix = np.float32([[sc, 0, cx - sc * cx + dx], [0, sc, cy - sc * cy + dy]])
    H, W = m.shape[:2]
    pre = m.copy()
    pre[..., :3] *= m[..., 3:] / 255
    w = cv2.warpAffine(pre, matrix, (W, H), flags=cv2.INTER_AREA if sc < 1 else cv2.INTER_LINEAR, borderValue=0)
    a = w[..., 3]
    out = np.zeros_like(w)
    out[..., 3] = a
    out[..., :3] = np.clip(w[..., :3] / np.maximum(a[..., None] / 255, 1e-3), 0, 255)
    Image.fromarray(out.astype(np.uint8)).save(job["out"])
    return {"pixels": int((a > 0).sum())}


def skull(job):
    """The first row of the open still that differs from the background by more than the threshold: the bald skull."""
    S = rgb(job["open"])
    bg = np.median(S[:4].reshape(-1, 3), 0)
    rows = np.where((np.abs(S - bg).sum(2) > job["threshold"]).any(1))[0]
    return {"row": int(rows.min())}


def first_rows(job):
    """Per layer the first row with an opacity above 3, or None for an empty layer."""
    found = []
    for layer in job["layers"]:
        rows = np.where((alpha(layer) > 3).any(1))[0]
        found.append(int(rows.min()) if rows.size else None)
    return {"rows": found}


COMMANDS = {
    "grid": grid,
    "split": split,
    "key_cut": key_cut,
    "hat_cut": hat_cut,
    "glasses_cut": glasses_cut,
    "variant_cut": variant_cut,
    "under_hat": under_hat,
    "fit": fit,
    "skull": skull,
    "first_rows": first_rows,
}

if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    if command not in COMMANDS or len(sys.argv) != 3:
        sys.stderr.write(f"usage: parts.py <{'|'.join(COMMANDS)}> <job json>")
        sys.exit(2)
    job = json.loads(sys.argv[2])
    # every file a job writes lands in a folder that may not exist yet
    for path in [job.get("out"), job.get("hide"), *job.get("outs", [])]:
        if path:
            os.makedirs(os.path.dirname(path), exist_ok=True)
    print(json.dumps(COMMANDS[command](job)))
