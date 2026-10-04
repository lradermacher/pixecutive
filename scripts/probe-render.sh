#!/usr/bin/env bash
# probe-render.sh — the render guard red once and green once per case in a throwaway repo, with a fake render command
# and a fake memory reading, so no model is loaded.
set -uo pipefail

root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$root" ] || { echo "probe-render.sh: not a git repository." >&2; exit 1; }

# shellcheck source=scripts/lib/probe.sh
source "$root/scripts/lib/probe.sh"
probe_tree_init render

mkdir -p "$work/scripts/lib"
cp "$root/scripts/render.ts" "$work/scripts/"
cp -R "$root/scripts/lib/render" "$work/scripts/lib/"
printf 'x' >"$work/in.png"
printf 'x' >"$work/prompt.txt"
probe_tree_commit
probe_env() { export PIX_RENDER_INTERVAL_MS=100; }

render='node scripts/render.ts run --input in.png --prompt prompt.txt --name probe'
# The fake prints two progress steps like the model and writes the image it was handed as its first argument.
finish='printf " 1/8 [00:01<00:07, 1.0s/it]\r 2/8 [00:02<00:06, 1.0s/it]\n"; sleep 0.3; printf x > "$1"'
slow='printf " 1/8 [00:01<00:07, 1.0s/it]\n"; sleep 2; printf x > "$1"'

echo "── Run ──────────────────────────────────────────────────────────────────"
probe "a finished render leaves the image and a done row" green \
	"PIX_RENDER_MEMORY=1,100 PIX_RENDER_COMMAND='$finish' $render >/dev/null && test -f renders/probe-s11.png && grep -q $'\tdone$' renders/renders.tsv"
probe "the done row carries every column" green \
	"PIX_RENDER_MEMORY=1,100 PIX_RENDER_COMMAND='$finish' $render >/dev/null && awk -F'\t' 'NF != 11 { exit 1 }' renders/renders.tsv"
probe "a start at warning pressure is refused" red "PIX_RENDER_MEMORY=2,100 PIX_RENDER_COMMAND='$finish' $render"
probe "critical pressure while running aborts and names the reason" green \
	"PIX_RENDER_MEMORY='1,100;4,100' PIX_RENDER_COMMAND='$slow' $render; [ \$? -eq 2 ] && grep -q 'ABORT: memory pressure level 4' renders/renders.tsv"
probe "swap beyond the limit while running aborts" green \
	"PIX_RENDER_MEMORY='1,100;1,9000' PIX_RENDER_COMMAND='$slow' $render; [ \$? -eq 2 ] && grep -q 'ABORT: swap' renders/renders.tsv"
probe "a start while a render runs is refused" red \
	"mkdir -p renders && printf other > renders/current.lock && PIX_RENDER_MEMORY=1,100 PIX_RENDER_COMMAND='$finish' $render"

echo "── Status ───────────────────────────────────────────────────────────────"
probe "status names the running render's step" green \
	"(PIX_RENDER_MEMORY=1,100 PIX_RENDER_COMMAND='$slow' $render >/dev/null &) ; sleep 1; PIX_RENDER_MEMORY=1,100 node scripts/render.ts status | grep -q 'running probe·s11 · 1/8'"
probe "status shows the last log rows" green \
	"PIX_RENDER_MEMORY=1,100 PIX_RENDER_COMMAND='$finish' $render >/dev/null && PIX_RENDER_MEMORY=1,100 node scripts/render.ts status | grep -q 'probe·s11'"

echo
probe_done
