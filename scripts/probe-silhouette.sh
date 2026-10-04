#!/usr/bin/env bash
# probe-silhouette.sh — the silhouette measure red and green on synthetic shapes: a cube against a matching square
# reaches 0.9, against a triangle it stays below; a figure facing -Y matches a side view that faces left, not its mirror.
set -uo pipefail

root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$root" ] || { echo "probe-silhouette.sh: not a git repository." >&2; exit 1; }
blender="${PIX_BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"
[ -x "$blender" ] || { echo "probe-silhouette.sh: Blender is missing at $blender." >&2; exit 1; }

# shellcheck source=scripts/lib/probe.sh
source "$root/scripts/lib/probe.sh"
probe_tree_init silhouette
cp "$root/packages/infrastructure/src/adapter/Blender/silhouette.py" "$work/"
cat >"$work/cube.py" <<'PY'
import bpy
bpy.ops.mesh.primitive_cube_add(size=1)
PY
cat >"$work/foot.py" <<'PY'
import bpy
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 1.5), scale=(1, 1, 3))
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -1, 0.25), scale=(1, 1, 0.5))
PY
# A reference view as the cutout writes it: the shape opaque, the rest transparent; a square, a triangle, or a
# side view with the foot to the left or to the right.
cat >"$work/view.py" <<'PY'
import bpy, os, sys
import numpy as np
shape = sys.argv[-1]
a = np.zeros((64, 64, 4), np.float32)
if shape == 'square':
    a[8:56, 8:56] = (0.8, 0.2, 0.1, 1)
elif shape == 'foot-left':
    a[8:56, 24:40] = a[8:16, 8:24] = (0.8, 0.2, 0.1, 1)
elif shape == 'foot-right':
    a[8:56, 8:24] = a[8:16, 24:40] = (0.8, 0.2, 0.1, 1)
else:
    for y in range(48):
        a[8 + y, 32 - y // 2:32 + y // 2 + 1] = (0.8, 0.2, 0.1, 1)
os.makedirs('views', exist_ok=True)
i = bpy.data.images.new('v', 64, 64, alpha=True)
i.colorspace_settings.name = 'Non-Color'
i.pixels.foreach_set(a.ravel())
i.filepath_raw = os.path.abspath('views/view-0.png')
i.file_format = 'PNG'
i.save()
PY
probe_tree_commit

view="$blender -b --factory-startup -P view.py --"
measure="$blender -b --factory-startup -P silhouette.py -- cube.py views front 2>/dev/null | grep '^SILHOUETTE' | sed 's/^SILHOUETTE //'"
at_least="python3 -c 'import json,sys; sys.exit(0 if json.load(sys.stdin)[\"front\"] >= 0.9 else 1)'"

probe "a cube against a matching square scores at least 0.9" green "$view square >/dev/null 2>&1 && $measure | $at_least"
probe "a cube against a triangle scores below 0.9" red "$view triangle >/dev/null 2>&1 && $measure | $at_least"

side="$blender -b --factory-startup -P silhouette.py -- foot.py views side 2>/dev/null | grep '^SILHOUETTE' | sed 's/^SILHOUETTE //'"
side_at_least="python3 -c 'import json,sys; sys.exit(0 if json.load(sys.stdin)[\"side\"] >= 0.9 else 1)'"
probe "a figure facing -Y matches a side view facing left" green "$view foot-left >/dev/null 2>&1 && $side | $side_at_least"
probe "a figure facing -Y does not match the mirrored side view" red "$view foot-right >/dev/null 2>&1 && $side | $side_at_least"

echo
probe_done
