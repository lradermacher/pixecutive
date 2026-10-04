# cutout.py — cuts a key-colored turnaround into one transparent PNG per view. Runs inside headless Blender:
#   Blender -b --factory-startup -P cutout.py -- <image> <panels> <hex key color> <output-dir>
# The key color is measured at the image border and must lie close to the expected one; pixels near it become
# transparent, green spill on the figure's edge is neutralized, and each view is cropped to its figure.
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
if np.abs(key - expected).max() > 0.25:
    print('CUTOUT ' + json.dumps({'error': f'border color {key.round(2).tolist()} is not the key color {key_hex}'}))
    sys.exit(0)
distance = np.sqrt(((rgb - key) ** 2).sum(axis=-1))
green_excess = rgb[..., 1] - np.maximum(rgb[..., 0], rgb[..., 2])
alpha = np.clip((distance - 0.18) / 0.12, 0, 1) * (green_excess < 0.25)
spill = (alpha > 0) & (green_excess > 0.02)
rgb = rgb.copy()
rgb[spill, 1] = np.maximum(rgb[spill, 0], rgb[spill, 2])
written = []
os.makedirs(out_dir, exist_ok=True)
step = w // panels
for index in range(panels):
    a = alpha[:, index * step:(index + 1) * step]
    ys, xs = np.nonzero(a > 0.5)
    if len(ys) == 0:
        continue
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    view = np.concatenate([rgb[:, index * step:(index + 1) * step], a[..., None]], axis=-1)[y0:y1, x0:x1]
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
