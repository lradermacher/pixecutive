#!/usr/bin/env bash
# probe-cutout.sh — the Blender cutout red once and green once per case on synthetic turnarounds: two figures on the
# key color come out as two transparent views, and a grey background is refused.
set -uo pipefail

root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$root" ] || { echo "probe-cutout.sh: not a git repository." >&2; exit 1; }
blender="${PIX_BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"
[ -x "$blender" ] || { echo "probe-cutout.sh: Blender is missing at $blender." >&2; exit 1; }

# shellcheck source=scripts/lib/probe.sh
source "$root/scripts/lib/probe.sh"
probe_tree_init cutout
cp "$root/packages/infrastructure/src/adapter/Blender/cutout.py" "$work/"
probe_tree_commit

# A turnaround of two panels, 64 x 32 each: a red figure on the key green, or on grey when the last argument is grey.
cat >"$work/make.py" <<'PY'
import bpy, os, sys
import numpy as np
bg = (0.5, 0.5, 0.5) if sys.argv[-1] == 'grey' else (0.0, 0.694, 0.251)
a = np.zeros((32, 128, 4), np.float32)
a[..., :3] = bg
a[..., 3] = 1
a[8:24, 20:40, :3] = (0.8, 0.2, 0.1)
a[10:26, 84:100, :3] = (0.8, 0.2, 0.1)
i = bpy.data.images.new('t', 128, 32)
i.colorspace_settings.name = 'Non-Color'
i.pixels.foreach_set(a.ravel())
i.filepath_raw = os.path.abspath('t.png')
i.file_format = 'PNG'
i.save()
PY
make="$blender -b --factory-startup -P make.py --"
cut="$blender -b --factory-startup -P cutout.py -- t.png 2 '#00B140' out 2>/dev/null | grep '^CUTOUT'"

probe "two figures on the key color come out as two views" green "$make green >/dev/null 2>&1 && $cut | grep -q 'view-1.png' && test -f out/view-0.png"
probe "a grey background is refused" red "$make grey >/dev/null 2>&1 && $cut | grep -q 'written'"

echo
probe_done
