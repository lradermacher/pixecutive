# base-m.py — builds the male base figure into the empty scene: one body mesh grown over the spec's joints, the parts
# of the layered part system as their own meshes, all weighted to one armature with exactly the spec's joints.
#   Blender -b --factory-startup -P base-m.py
# Measures are pixels of the approved reference's cut-out front and side views (437 pixels tall); `x` is across, `y`
# the image row from the top, `d` the depth with the face at negative values. The figure faces -Y.
import bpy, bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HEIGHT = 1.75
SCALE = HEIGHT / 437


# Subdivision pulls a skin box in to about 78 % of its radius (measured on this figure's torso and pelvis), so the
# radii are given as seen in the reference and widened by this factor.
ROUNDING = 1 / 0.78


def at(x, y, d=0):
    return (x * SCALE, d * SCALE, (437 - y) * SCALE)


# name: (x, y, d, radius across, radius deep); limbs exist once per side, mirrored on x. The skin modifier orients a
# leg by the sideways edge from the pelvis to the hip, which turns across and deep: the legs are round, and the toe's
# radii are given in that turned frame.
CENTRE = {
    'pelvis': (0, 282, 0, 40, 27),
    'spine': (0, 250, 2, 38, 25),
    'chest': (0, 200, 4, 44, 28),
    'neck': (0, 134, 6, 18, 16),
    'jaw': (0, 106, 0, 30, 44),
    'head': (0, 76, -8, 46, 47),
    'crown': (0, 34, 12, 35, 31),
}
SIDE = {
    'shoulder': (48, 158, 4, 16, 16),
    'elbow': (58, 222, 4, 11, 11),
    'wrist': (62, 280, 2, 9, 9),
    'hand': (63, 302, 0, 11, 9),
    'hip': (21, 318, 0, 20, 20),
    'knee': (21, 365, 2, 17, 17),
    'ankle': (22, 418, 6, 13, 13),
    'toe': (34, 428, -54, 14, 24),
    'ear': (45, 76, -2, 9, 6),
}
CHAINS = [
    ['pelvis', 'spine', 'chest', 'neck', 'jaw', 'head', 'crown'],
    ['chest', 'shoulder', 'elbow', 'wrist', 'hand'],
    ['pelvis', 'hip', 'knee', 'ankle', 'toe'],
    ['head', 'ear'],
]


def points():
    table = {name: values for name, values in CENTRE.items()}
    for name, (x, y, d, rx, rd) in SIDE.items():
        table[f'{name}.L'] = (x, y, d, rx, rd)
        table[f'{name}.R'] = (-x, y, d, rx, rd)
    return table


def side_of(name, chain_side):
    return name if name in CENTRE else f'{name}.{chain_side}'


def skinned(name, members, grow=0):
    """One mesh grown over the named points with the skin modifier, rounded by subdivision and applied."""
    table = points()
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    index, vertices, edges = {}, [], []
    for chain in CHAINS:
        for chain_side in ('L', 'R'):
            names = [side_of(n, chain_side) for n in chain]
            for a, b in zip(names, names[1:]):
                if a not in members or b not in members:
                    continue
                for n in (a, b):
                    if n not in index:
                        index[n] = len(vertices)
                        vertices.append(at(*table[n][:3]))
                if (index[a], index[b]) not in edges:
                    edges.append((index[a], index[b]))
    mesh.from_pydata(vertices, edges, [])
    obj.modifiers.new('skin', 'SKIN')
    for n, i in index.items():
        rx, rd = table[n][3:]
        obj.data.skin_vertices[0].data[i].radius = ((rx + grow) * SCALE * ROUNDING, (rd + grow) * SCALE * ROUNDING)
    for i in roots(len(vertices), edges):
        obj.data.skin_vertices[0].data[i].use_root = True
    obj.modifiers.new('round', 'SUBSURF').levels = 2
    apply_all(obj)
    return obj


def roots(count, edges):
    """The skin modifier needs one root per connected piece, or it shapes the pieces without one at random."""
    group = list(range(count))

    def find(i):
        while group[i] != i:
            i = group[i]
        return i

    for a, b in edges:
        group[find(a)] = find(b)
    return sorted({min(i for i in range(count) if find(i) == g) for g in {find(i) for i in range(count)}})


def apply_all(obj):
    bpy.context.view_layer.objects.active = obj
    for modifier in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=modifier.name)


def hair():
    """A cap over the skull, cut by a plane from the hairline at the forehead to the nape, with the quiff and the
    tufts of the reference grown out of it: each pushes the surface outward around one direction from the head."""
    mesh = bpy.data.meshes.new('hair')
    obj = bpy.data.objects.new('hair', mesh)
    bpy.context.scene.collection.objects.link(obj)
    shape = bmesh.new()
    bmesh.ops.create_uvsphere(shape, u_segments=48, v_segments=24, radius=1)
    bmesh.ops.scale(shape, vec=(47 * SCALE, 49 * SCALE, 46 * SCALE), verts=shape.verts)
    centre = Vector(at(0, 68, 2))
    bmesh.ops.translate(shape, vec=centre, verts=shape.verts)
    # (direction from the head, height in pixels, sharpness): the quiff over the forehead, then the crown's tufts.
    growths = [((-0.15, -0.55, 0.82), 34, 6), ((0.35, 0.25, 0.9), 18, 30), ((-0.3, 0.45, 0.84), 16, 30),
               ((0.05, 0.75, 0.66), 14, 30), ((0.0, 0.0, 1.0), 10, 3)]
    for vertex in shape.verts:
        out = (vertex.co - centre).normalized()
        push = sum(height * max(0.0, out.dot(Vector(d).normalized())) ** sharp for d, height, sharp in growths)
        vertex.co += out * push * SCALE
    front, back = at(0, 46, -50), at(0, 112, 50)
    normal = (0, back[2] - front[2], -(back[1] - front[1]))
    cut = bmesh.ops.bisect_plane(shape, geom=shape.verts[:] + shape.edges[:] + shape.faces[:], plane_co=front,
                                 plane_no=normal, clear_outer=True)
    bmesh.ops.holes_fill(shape, edges=[e for e in cut['geom_cut'] if isinstance(e, bmesh.types.BMEdge)])
    shape.to_mesh(mesh)
    shape.free()
    return obj


def shoes():
    """A pair of flat, long rounded boxes on the floor; a skin end would round the heel into a ball."""
    mesh = bpy.data.meshes.new('shoes')
    obj = bpy.data.objects.new('shoes', mesh)
    bpy.context.scene.collection.objects.link(obj)
    shape = bmesh.new()
    for side in (1, -1):
        shoe = bmesh.ops.create_cube(shape, size=2)['verts']
        bmesh.ops.scale(shape, vec=(15 * SCALE, 34 * SCALE, 12 * SCALE), verts=shoe)
        bmesh.ops.translate(shape, vec=at(22 * side, 425, -10), verts=shoe)
    bmesh.ops.bevel(shape, geom=shape.edges[:], offset=8 * SCALE, segments=3, affect='EDGES')
    shape.to_mesh(mesh)
    shape.free()
    return obj


def face(body):
    """The face as its own part, so faces can be swapped: each feature is a small flattened ball set onto the head's
    surface where a ray from in front of the face meets it. (x, y, across, tall, deep, color) in reference pixels."""
    surface = BVHTree.FromObject(body, bpy.context.evaluated_depsgraph_get())
    features = []
    for side in (1, -1):
        features += [
            (18 * side, 82, 8, 11, 4, 'eye'),
            (16 * side, 79, 3, 3, 3, 'glint'),
            (18 * side, 67, 14, 4, 4, 'brow'),
        ]
    # A feature must be about 2 by 3 sprite pixels to read at 120 pixels tall, so it is drawn larger than life.
    features += [(0, 96, 7, 7, 7, 'nose'), (0, 110, 20, 6, 4, 'mouth'), (0, 108, 14, 3, 3, 'teeth')]
    mesh = bpy.data.meshes.new('face')
    obj = bpy.data.objects.new('face', mesh)
    bpy.context.scene.collection.objects.link(obj)
    shape = bmesh.new()
    for x, y, across, tall, deep, color in features:
        start = Vector(at(x, y, -200))
        hit = surface.ray_cast(start, Vector((0, 1, 0)))[0]
        if hit is None:
            continue
        # The glint and the teeth sit a little in front of the eye and the mouth they belong to.
        lift = 3 if color in ('glint', 'teeth') else 1.5
        ball = bmesh.ops.create_uvsphere(shape, u_segments=12, v_segments=6, radius=1)['verts']
        bmesh.ops.scale(shape, vec=(across / 2 * SCALE, deep / 2 * SCALE, tall / 2 * SCALE), verts=ball)
        bmesh.ops.translate(shape, vec=hit - Vector((0, lift * SCALE, 0)), verts=ball)
        layer = shape.faces.layers.int.get('color') or shape.faces.layers.int.new('color')
        for f in {f for v in ball for f in v.link_faces}:
            f[layer] = FACE_COLORS.index(color)
    shape.to_mesh(mesh)
    shape.free()
    return obj


FACE_COLORS = ['eye', 'glint', 'brow', 'nose', 'mouth', 'teeth']


def armature():
    """Exactly the spec's joints; a bone is named after the joint it starts at."""
    data = bpy.data.armatures.new('rig')
    rig = bpy.data.objects.new('rig', data)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    table = points()
    bones = {}

    def bone(name, start, end, parent=None):
        b = data.edit_bones.new(name)
        b.head, b.tail = at(*table[start][:3]), at(*table[end][:3])
        if parent is not None:
            b.parent = bones[parent]
            b.use_connect = False
        bones[name] = b

    bone('pelvis', 'pelvis', 'spine')
    bone('spine', 'spine', 'chest', 'pelvis')
    bone('chest', 'chest', 'neck', 'spine')
    bone('neck', 'neck', 'jaw', 'chest')
    bone('head', 'jaw', 'crown', 'neck')
    for s in ('L', 'R'):
        bone(f'shoulder.{s}', f'shoulder.{s}', f'elbow.{s}', 'chest')
        bone(f'elbow.{s}', f'elbow.{s}', f'wrist.{s}', f'shoulder.{s}')
        bone(f'wrist.{s}', f'wrist.{s}', f'hand.{s}', f'elbow.{s}')
        bone(f'hip.{s}', f'hip.{s}', f'knee.{s}', 'pelvis')
        bone(f'knee.{s}', f'knee.{s}', f'ankle.{s}', f'hip.{s}')
        bone(f'ankle.{s}', f'ankle.{s}', f'toe.{s}', f'knee.{s}')
    bpy.ops.object.mode_set(mode='OBJECT')
    return rig


def bind(rig, parts):
    bpy.ops.object.select_all(action='DESELECT')
    for part in parts:
        part.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')


def clothing(name, body, rig, regions, offset):
    """A garment cut from the body: the vertices that belong most to one of the region's bones, up to the given share
    of that bone's length, moved outward by the offset in reference pixels. It keeps the body's weights, so it moves
    with the rig, and it cannot cross the skin."""
    obj = body.copy()
    obj.data = body.data.copy()
    obj.name = obj.data.name = name
    bpy.context.scene.collection.objects.link(obj)
    groups = {g.index: g.name for g in obj.vertex_groups}
    bones = rig.data.bones
    shape = bmesh.new()
    shape.from_mesh(obj.data)
    deform = shape.verts.layers.deform.active
    drop = []
    for vertex in shape.verts:
        weights = vertex[deform]
        if not weights:
            drop.append(vertex)
            continue
        bone = groups[max(weights.keys(), key=lambda g: weights[g])]
        if bone not in regions:
            drop.append(vertex)
            continue
        head, tail = bones[bone].head_local, bones[bone].tail_local
        share = (vertex.co - head).dot(tail - head) / (tail - head).length_squared
        if share > regions[bone]:
            drop.append(vertex)
    bmesh.ops.delete(shape, geom=drop, context='VERTS')
    shape.normal_update()
    for vertex in shape.verts:
        vertex.co += vertex.normal * offset * SCALE
    shape.to_mesh(obj.data)
    shape.free()
    return obj


def to_bone(obj, rig, bone):
    """Rigid parts follow one bone as a whole instead of being bent by weights."""
    world = obj.matrix_world.copy()
    obj.parent = rig
    obj.parent_type = 'BONE'
    obj.parent_bone = bone
    bpy.context.view_layer.update()
    obj.matrix_world = world


# The shoes cover the feet, so the body ends at the ankles.
body = skinned('body', set(points()) - {'toe.L', 'toe.R'})
details = [face(body), hair()]
rig = armature()
bind(rig, [body])
for detail in details:
    to_bone(detail, rig, 'head')
# The top hangs over the waistband: it lies further out than the trousers and covers the pelvis as well. Sleeves end
# halfway down the upper arm, the trousers at the ankle.
top = clothing('top', body, rig, {'pelvis': 1, 'spine': 1, 'chest': 1, 'shoulder.L': 0.45, 'shoulder.R': 0.45}, 5)
bottom = clothing('bottom', body, rig, {'pelvis': 1, 'hip.L': 1, 'hip.R': 1, 'knee.L': 1, 'knee.R': 1}, 3)
feet = shoes()
bind(rig, [feet])
