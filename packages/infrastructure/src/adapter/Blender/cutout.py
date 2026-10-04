# cutout.py — cuts a key-colored turnaround into one transparent PNG per view. Runs inside headless Blender:
#   Blender -b --factory-startup -P cutout.py -- <image> <panels> <hex key color> <output-dir>
# The background is the key color or any clearly green-dominant color, since the image model sometimes paints blotches
# of other greens; the image border must be such a background. Green spill on the figure's edge is neutralized, and
# each figure found becomes one cropped view.
import bpy, json, os, sys
import numpy as np

image_path, panels, key_hex, out_dir = sys.argv[sys.argv.index('--') + 1:][:4]
panels = int(panels)
# Blender resolves a relative path against the blend file, not the working directory.
image_path, out_dir = os.path.abspath(image_path), os.path.abspath(out_dir)
expected = np.array([int(key_hex[i:i + 2], 16) / 255 for i in (1, 3, 5)])
image = bpy.data.images.load(image_path)
image.colorspace_settings.name = 'Non-Color'
w, h = image.size
px = np.empty(w * h * 4, np.float32)
image.pixels.foreach_get(px)
rgb = px.reshape(h, w, 4)[::-1, :, :3]
border = np.concatenate([rgb[:4].reshape(-1, 3), rgb[-4:].reshape(-1, 3), rgb[:, :4].reshape(-1, 3), rgb[:, -4:].reshape(-1, 3)])
key = np.median(border, axis=0)
# Green excess: how far green rises above red and blue. Measured backgrounds lie at 0.12 and above, the figures'
# skin, hair, white and grey below 0.06.
border_excess = border[:, 1] - np.maximum(border[:, 0], border[:, 2])
if (border_excess > 0.1).mean() < 0.9:
    print('CUTOUT ' + json.dumps({'error': f'border color {key.round(2).tolist()} is not a green key background like {key_hex}'}))
    sys.exit(0)
distance = np.sqrt(((rgb - expected) ** 2).sum(axis=-1))
green_excess = rgb[..., 1] - np.maximum(rgb[..., 0], rgb[..., 2])
alpha = np.clip((distance - 0.18) / 0.12, 0, 1) * np.clip((0.12 - green_excess) / 0.06, 0, 1)
spill = (alpha > 0) & (green_excess > 0.02)
rgb = rgb.copy()
rgb[spill, 1] = np.maximum(rgb[spill, 0], rgb[spill, 2])
# A figure is a connected shape of opaque pixels. Figures that touch, an arm against a back, are told apart by wearing
# the shapes down until they fall apart, then letting each grow back into its own pixels, so an arm that reaches over
# the other figure's foot stays with its owner. A stray island of the painted background, under 5 % of the largest
# shape, is no figure. The image model sometimes keeps the panel count of its input image, so a count that differs
# from the template is refused.
def shapes(mask):
    """Labels every connected shape of the mask, joining the runs of each row with the runs they touch in the row
    above; returns the label image (-1 outside) and the size of each label."""
    parent = []

    def root(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    runs, above = [], []
    for y in range(mask.shape[0]):
        row = np.nonzero(np.diff(np.concatenate(([0], mask[y].astype(np.int8), [0]))))[0]
        here = []
        for x0, x1 in zip(row[::2], row[1::2]):
            parent.append(len(parent))
            here.append((x0, x1, len(parent) - 1))
            for a0, a1, other in above:
                if a0 < x1 and x0 < a1:
                    parent[root(other)] = root(len(parent) - 1)
        runs.append(here)
        above = here
    label = np.full(mask.shape, -1)
    for y, here in enumerate(runs):
        for x0, x1, i in here:
            label[y, x0:x1] = root(i)
    ids, sizes = np.unique(label[label >= 0], return_counts=True)
    return label, dict(zip(ids.tolist(), sizes.tolist()))


opaque = alpha > 0.5
# How deep each opaque pixel lies inside its shape, in pixels; wearing down to a depth keeps the deeper pixels.
depth = np.zeros(alpha.shape, int)
layer = opaque
while layer.any():
    depth += layer
    layer = layer & np.roll(layer, 1, 0) & np.roll(layer, -1, 0) & np.roll(layer, 1, 1) & np.roll(layer, -1, 1)
figures = []
for level in range(1, int(depth.max()) + 1, 2):
    core = depth >= level
    label, sizes = shapes(core)
    figures = [i for i, size in sizes.items() if size >= 0.05 * max(sizes.values())] if sizes else []
    if len(figures) >= panels:
        break
# Wearing down can free a head at its thin neck in the same step that parts two figures. A part far smaller than the
# figures kept is no figure of its own: it grows back into the figure it hangs on.
figures.sort(key=lambda i: -sizes[i])
if len(figures) > panels and sizes[figures[panels]] < 0.5 * sizes[figures[panels - 1]]:
    figures = figures[:panels]
if len(figures) != panels:
    print('CUTOUT ' + json.dumps({'error': f'found {len(figures)} figures, the template has {panels} views'}))
    sys.exit(0)
owner = np.full(alpha.shape, -1)
for index, figure in enumerate(figures):
    owner[label == figure] = index
reach = alpha > 0.01
while True:
    grown = owner.copy()
    for axis in (0, 1):
        for shift in (1, -1):
            near = np.roll(owner, shift, axis)
            grown = np.where((grown < 0) & reach & (near >= 0), near, grown)
    if (grown == owner).all():
        break
    owner = grown
order = sorted(range(panels), key=lambda index: np.nonzero(owner == index)[1].mean())
written = []
os.makedirs(out_dir, exist_ok=True)
for index, figure in enumerate(order):
    a = alpha * (owner == figure)
    ys, xs = np.nonzero(a > 0.5)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    view = np.concatenate([rgb, a[..., None]], axis=-1)[y0:y1, x0:x1]
    vh, vw, _ = view.shape
    out = bpy.data.images.new(f'view{index}', vw, vh, alpha=True)
    out.colorspace_settings.name = 'Non-Color'
    out.pixels.foreach_set(view[::-1].astype(np.float32).ravel())
    path = os.path.join(out_dir, f'view-{index}.png')
    out.filepath_raw = path
    out.file_format = 'PNG'
    out.save()
    written.append(path)
print('CUTOUT ' + json.dumps({'written': written}))
