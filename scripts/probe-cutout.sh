#!/usr/bin/env bash
# probe-cutout.sh — the Blender cutout red once and green once per case on synthetic turnarounds: two figures on the
# key color come out as two transparent views, so do two on a mottled green and two that touch, a grey background is
# refused, and so is a turnaround with more figures than the template has views.
set -uo pipefail

root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$root" ] || { echo "probe-cutout.sh: not a git repository." >&2; exit 1; }
blender="${PIX_BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"
[ -x "$blender" ] || { echo "probe-cutout.sh: Blender is missing at $blender." >&2; exit 1; }

# shellcheck source=scripts/lib/probe.sh
source "$root/scripts/lib/probe.sh"
probe_tree_init cutout
cp "$root/packages/infrastructure/src/adapter/Blender/cutout.py" "$work/"

# A turnaround of two panels, 64 x 32 each: a red figure on the key green, on grey when the last argument is grey, with
# a third figure between them when it is three, on blotches of other greens with a stray speck when it is mottled, and with the two
# figures joined by a thin bridge when it is touching, or with an arm of the first reaching over a foot of the
# second, joined by a thin bridge, when it is overlapping.
cat >"$work/make.py" <<'PY'
import bpy, os, sys
import numpy as np
bg = (0.5, 0.5, 0.5) if sys.argv[-1] == 'grey' else (0.0, 0.694, 0.251)
a = np.zeros((32, 128, 4), np.float32)
a[..., :3] = bg
a[..., 3] = 1
a[8:24, 20:40, :3] = (0.8, 0.2, 0.1)
a[10:26, 84:100, :3] = (0.8, 0.2, 0.1)
if sys.argv[-1] == 'three':
    a[8:24, 56:70, :3] = (0.8, 0.2, 0.1)
if sys.argv[-1] == 'mottled':
    a[0:16, 0:48, :3] = (0.35, 0.62, 0.4)
    a[16:32, 48:128, :3] = (0.2, 0.5, 0.25)
    a[8:24, 20:40, :3] = (0.8, 0.2, 0.1)
    a[10:26, 84:100, :3] = (0.8, 0.2, 0.1)
    a[2:5, 110:114, :3] = (0.45, 0.4, 0.3)
if sys.argv[-1] == 'overlapping':
    a[..., :3] = bg
    a[8:24, 20:40, :3] = a[16:24, 40:50, :3] = (0.8, 0.2, 0.1)
    a[4:28, 52:70, :3] = a[18:20, 50:52, :3] = a[2:6, 44:52, :3] = (0.1, 0.2, 0.8)
if sys.argv[-1] == 'touching':
    a[12:18, 40:84, :3] = (0.8, 0.2, 0.1)
i = bpy.data.images.new('t', 128, 32)
i.colorspace_settings.name = 'Non-Color'
i.pixels.foreach_set(a.ravel())
i.filepath_raw = os.path.abspath('t.png')
i.file_format = 'PNG'
i.save()
PY
probe_tree_commit
make="$blender -b --factory-startup -P make.py --"
cut="$blender -b --factory-startup -P cutout.py -- t.png 2 '#00B140' out 2>/dev/null | grep '^CUTOUT'"

probe "two figures on the key color come out as two views" green "$make green >/dev/null 2>&1 && $cut | grep -q 'view-1.png' && test -f out/view-0.png"
probe "a grey background is refused" red "$make grey >/dev/null 2>&1 && $cut | grep -q 'written'"
probe "two figures on a mottled green come out as two views of the figures alone" green "$make mottled >/dev/null 2>&1 && $cut | grep -q 'view-1.png' && file out/view-0.png | grep -q ' 20 x 16'"
probe "two touching figures come out as two views" green "$make touching >/dev/null 2>&1 && $cut | grep -q 'view-1.png'"
probe "overlapping figures each keep all of their own pixels" green "$make overlapping >/dev/null 2>&1 && $cut | grep -q 'view-1.png' && file out/view-0.png | grep -Eq ' 3[01] x 16' && file out/view-1.png | grep -Eq ' 2[56] x 26'"
probe "three figures for two views are refused" red "$make three >/dev/null 2>&1 && $cut | grep -q 'written'"

echo
probe_done
