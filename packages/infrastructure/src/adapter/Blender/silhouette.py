# silhouette.py — measures how well a Blender figure matches its reference: renders the figure's silhouette per view
# with an orthographic camera and compares it with the cut-out reference view (intersection over union).
#   Blender -b --factory-startup -P silhouette.py -- <figure.py> <views-dir> [views...]
# <figure.py> builds the figure into the empty scene; the views dir holds view-0.png … from the cutout, in the order
# of the template's views. Prints one line: SILHOUETTE {"front": 0.93, …}.
import bpy, json, math, os, sys
import numpy as np
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
figure, views_dir = os.path.abspath(args[0]), os.path.abspath(args[1])
names = args[2:] or ['front', 'three-quarter', 'side', 'back']
# The figure faces -Y and the reference turnaround turns it to the left, so the camera moves round to its left side
# (+X): the side view shows the face on the image's left, as the reference does.
turns = {'front': 0, 'three-quarter': 45, 'side': 90, 'back': 180}

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
exec(open(figure).read(), {'__name__': '__main__'})
scene = bpy.context.scene
meshes = [o for o in scene.objects if o.type in ('MESH', 'CURVE')]
corners = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
low = Vector((min(p.x for p in corners), min(p.y for p in corners), min(p.z for p in corners)))
high = Vector((max(p.x for p in corners), max(p.y for p in corners), max(p.z for p in corners)))
centre = (low + high) / 2
reach = (high - low).length

camera_data = bpy.data.cameras.new('silhouette')
camera_data.type = 'ORTHO'
camera_data.ortho_scale = reach * 1.1
camera = bpy.data.objects.new('silhouette', camera_data)
scene.collection.objects.link(camera)
scene.camera = camera
scene.render.engine = 'BLENDER_WORKBENCH'
scene.display.shading.light = 'FLAT'
scene.display.shading.color_type = 'SINGLE'
scene.display.shading.single_color = (1, 1, 1)
scene.display.render_aa = 'OFF'
scene.render.film_transparent = True
scene.render.resolution_x = scene.render.resolution_y = 512
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'


def alpha_of(path):
    image = bpy.data.images.load(path)
    w, h = image.size
    pixels = np.empty(w * h * 4, np.float32)
    image.pixels.foreach_get(pixels)
    return pixels.reshape(h, w, 4)[::-1, :, 3] > 0.5


def cropped(mask):
    ys, xs = np.nonzero(mask)
    return mask[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def resized(mask, height, width):
    rows = (np.arange(height) * mask.shape[0] / height).astype(int)
    cols = (np.arange(width) * mask.shape[1] / width).astype(int)
    return mask[rows][:, cols]


scores = {}
out = os.path.join(views_dir, 'silhouette')
os.makedirs(out, exist_ok=True)
for index, name in enumerate(names):
    reference = os.path.join(views_dir, f'view-{index}.png')
    if not os.path.exists(reference):
        continue
    angle = math.radians(turns[name])
    direction = Vector((math.sin(angle), -math.cos(angle), 0))
    camera.location = centre + direction * reach * 3
    camera.rotation_euler = (-direction).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = os.path.join(out, f'{name}.png')
    bpy.ops.render.render(write_still=True)
    model = cropped(alpha_of(scene.render.filepath))
    target = cropped(alpha_of(reference))
    model = resized(model, *target.shape)
    union = np.logical_or(model, target).sum()
    scores[name] = round(float(np.logical_and(model, target).sum() / union), 3) if union else 0.0
print('SILHOUETTE ' + json.dumps(scores))
