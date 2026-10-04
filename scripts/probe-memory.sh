#!/usr/bin/env bash
# probe-memory.sh — every gate of check-memory and the memory-guard hook red once and green once, on a planted memory
# in a throwaway repo; MEMORY_DIR points there, so the real memory is never written.
set -uo pipefail

root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$root" ] || { echo "probe-memory.sh: not a git repository." >&2; exit 1; }

# shellcheck source=scripts/lib/probe.sh
source "$root/scripts/lib/probe.sh"
probe_tree_init memory
# The memory is ignored inside the tree, so a reset keeps it, and is laid out again from the healthy copy per case.
probe_env() { export MEMORY_DIR="$work/memory"; }
probe_restore_extra() {
	git -C "$work" branch -q -D feat/probe-series 2>/dev/null || true
	rm -rf "${work:?}/memory" && cp -R "$work/memory-healthy" "$work/memory"
}

mkdir -p "$work/.claude/hooks" "$work/scripts/lib" "$work/memory"
cp -R "$root/.claude/rules" "$work/.claude/rules"
cp "$root/.claude/hooks/memory-guard.ts" "$work/.claude/hooks/"
cp "$root/scripts/check-memory.ts" "$work/scripts/"
for part in rules memory hooks frontmatter.ts; do cp -R "$root/scripts/lib/$part" "$work/scripts/lib/"; done
cp "$root/CLAUDE.md" "$work/CLAUDE.md"
mkdir -p "$work/docs" && echo "# Notes" >"$work/docs/notes.md"
printf '/memory/\n/memory-healthy/\n' >"$work/.gitignore"

# $1 file · $2 kind · $3 description · $4 body
note() {
	printf -- '---\nname: %s\ndescription: "%s"\nmetadata:\n  node_type: memory\n  type: %s\n---\n\n%s\n' \
		"${1%.md}" "$3" "$2" "$4" >"$MEMORY_DIR/$1"
}
export MEMORY_DIR="$work/memory"
{
	echo "- [An incident](incident.md) — what went wrong on a deploy"
	echo "- [A preference](preference.md) — how the maintainer likes reviews"
	echo "- [A pointer](pointer.md) — where the dashboard lives"
} >"$MEMORY_DIR/MEMORY.md"
note incident.md feedback "A deploy ran out of memory without an error message" "Plain text. Related: [[pointer]]."
note preference.md project "The maintainer reads reviews on the phone" "Plain text."
note pointer.md reference "The dashboard lives behind the office proxy" "See \`docs/notes.md\`."
probe_tree_commit
cp -R "$work/memory" "$work/memory-healthy"

check='node scripts/check-memory.ts'
guard() {
	printf '{"tool_name":"%s","tool_input":{"file_path":"%s"}}' "${2:-Write}" "$1" | node .claude/hooks/memory-guard.ts
}

echo "── Starting state ──────────────────────────────────────────────────────"
probe "every gate on the planted memory" green "$check"
probe "every gate with --all, as verify-full calls it" green "$check --all"

echo
echo "── budget: the index stays under 100 lines ─────────────────────────────"
probe "an index of 101 lines" red \
	"for i in \$(seq 98); do echo \"- [Entry \$i](incident.md) — hook\" >> \$MEMORY_DIR/MEMORY.md; done; $check budget"
probe "exactly 100 lines are allowed" green \
	"for i in \$(seq 97); do echo \"- [Entry \$i](incident.md) — hook\" >> \$MEMORY_DIR/MEMORY.md; done; $check budget"
probe "the index is missing" red "rm -f \$MEMORY_DIR/MEMORY.md; $check budget"

echo
echo "── frontmatter: name, description and one of four kinds ────────────────"
probe "a file without metadata.type" red \
	"printf -- '---\nname: bare\ndescription: \"x\"\n---\n\nText.\n' > \$MEMORY_DIR/bare.md; $check frontmatter"
probe "a file of the kind rule" red "note rule.md rule 'Something' 'Text.'; $check frontmatter"
probe "a file without description" red \
	"printf -- '---\nname: d\nmetadata:\n  type: user\n---\n\nText.\n' > \$MEMORY_DIR/d.md; $check frontmatter"
probe "a file without name" red \
	"printf -- '---\ndescription: \"x\"\nmetadata:\n  type: user\n---\n\nText.\n' > \$MEMORY_DIR/n.md; $check frontmatter"
probe "the fourth kind, user, is no false alarm" green \
	"note person.md user 'Prefers short answers' 'Text.'; $check frontmatter"
# Quotes and a trailing comment do not belong to the value.
probe "a quoted kind with a comment is read" green \
	"printf -- '---\nname: q\ndescription: \"x\"\nmetadata:\n  type: \"reference\"  # pointer\n---\n\nText.\n' \\
	 > \$MEMORY_DIR/q.md
	 $check frontmatter"
probe "an empty memory directory reports itself" red "MEMORY_DIR=\$PWD/empty; mkdir -p \$MEMORY_DIR; $check frontmatter"
probe "an explicit MEMORY_DIR that does not exist is red" red "MEMORY_DIR=\$PWD/nowhere $check"
probe "a machine without any memory has nothing to judge" green \
	"unset MEMORY_DIR; HOME=\$PWD/home $check | grep -q 'nothing to judge'"

echo
echo "── index: one line per memory, each pointing to a file ─────────────────"
probe "a line in another shape" red "echo 'Remember the dashboard.' >> \$MEMORY_DIR/MEMORY.md; $check index"
probe "a line pointing to a missing file" red "echo '- [Gone](gone.md) — hook' >> \$MEMORY_DIR/MEMORY.md; $check index"
probe "the same file listed twice" red "echo '- [Again](pointer.md) — hook' >> \$MEMORY_DIR/MEMORY.md; $check index"
probe "a heading and a blank line are allowed" green \
	"{ echo '# Memory index'; echo; cat \$MEMORY_DIR/MEMORY.md; } > i && mv i \$MEMORY_DIR/MEMORY.md; $check index"
# The harness writes the file before its index line; red here would hit every ordinary save.
probe "a new file without its index line yet is no finding" green \
	"note fresh.md feedback 'Just written' 'Text.'; $check index"

echo
echo "── duplicate: a rule stands in its carrier, never in memory ────────────"
first() { sed -n '/^# /,$p' "$1" | grep -m1 '^## ' | sed 's/^## //'; }
probe "a rule heading written back as a heading" red \
	"note golden.md feedback 'Rules to keep' \"## \$(first .claude/rules/workflow.md)\"; $check duplicate"
probe "the same rule as description" red \
	"note second.md feedback \"\$(first .claude/rules/basis.md)\" 'Text.'; $check duplicate"
probe "a heading of CLAUDE.md as description" red \
	"note claude.md feedback \"\$(grep -m1 '^## ' CLAUDE.md | sed 's/^## //')\" 'Text.'; $check duplicate"
probe "a long rule line copied into the body" red \
	"long=\$(sed -n '/^# /,\$p' .claude/rules/ops.md | grep -m1 '^[A-Z].\\{60,\\}')
	 note line.md feedback 'Copied' \"\$long\"; $check duplicate"
probe "the same rule reworded with the same opening" red \
	"note reworded.md feedback 'Everything in the repo is English, drafts included' 'Text.'; $check duplicate"
# An incident names the rule it broke as evidence; a quote or a block quote is cited, not stated.
probe "an incident that quotes the broken rule is no duplicate" green \
	"note quote.md feedback 'A deploy built twice' \"I broke \\\"\$(first .claude/rules/basis.md)\\\".\"; $check duplicate"
probe "the rule as a block quote is no duplicate" green \
	"note block.md feedback 'A deploy built twice' \"> \$(first .claude/rules/basis.md)\"; $check duplicate"
probe "an incident that only mentions a rule is no duplicate" green \
	"note mention.md feedback 'Built the picker twice without reading the list' 'The rule lives in rules/basis.md.'
	 $check duplicate"

echo
echo "── paths: a note names no path that exists nowhere ─────────────────────"
probe "a note names a path that exists on no branch" red \
	"note dead.md project 'State' 'Lives in \`docs/MISSING.md\`.'; $check paths"
probe "a bare path outside a code span as well" red \
	"note dead.md project 'State' 'In docs/MISSING.md now.'; $check paths"
probe "a path on another branch is not dead" green \
	"mkdir -p docs/series && echo x > docs/series/script.md
	 git checkout -q -b feat/probe-series && git add docs/series/script.md
	 git -c user.email=p@example.com -c user.name=p commit -qm series
	 git checkout -q - && rm -rf docs/series
	 note branch.md project 'State' 'Lives in \`docs/series/script.md\`.'; $check paths"
probe "a line number, an ellipsis and a placeholder are no paths" green \
	"note forms.md project 'State' 'See \`docs/notes.md:12\`, \`docs/.../x.md\` and \`docs/<name>/\`.'; $check paths"
probe "a URL and a foreign repo are no repo paths" green \
	"note foreign.md reference 'Links' 'See https://example.com/docs/x and \`other-repo/docs/x.md\`.'; $check paths"

echo
echo "── links: every [[link]] points to an existing note ────────────────────"
probe "a link to a note that does not exist" red "note link.md project 'State' 'See [[missing]].'; $check links"
probe "a link inside a code span is no link" green \
	"note link.md project 'State' 'In \`app/[[...slug]]/\`.'; $check links"

echo
echo "── gate names ──────────────────────────────────────────────────────────"
probe "an unknown gate name stops with exit 2" green "$check dupes; [ \$? -eq 2 ]"
probe "a known gate name runs" green "$check links"

echo
echo "── memory-guard: the hook runs the gate on every write into memory ─────"
probe "a note of the kind rule: exit 2 with the finding" red \
	"note bad.md rule 'x' 'Text.'; guard \$MEMORY_DIR/bad.md 2> out; code=\$?; cat out
	 grep -q \"kind 'rule'\" out && [ \$code -eq 2 ] && exit 1; exit 0"
probe "a valid note: exit 0" green "note good.md feedback 'A deploy hung' 'Text.'; guard \$MEMORY_DIR/good.md Edit"
# A stand-in gate leaves a mark; the memory case proves the mark appears, so its absence means something.
stand_in="printf \"import { writeFileSync } from 'node:fs';\\nwriteFileSync('ran', '');\\n\" > scripts/check-memory.ts"
probe "a write into memory runs check-memory" green "$stand_in; guard \$MEMORY_DIR/incident.md && [ -e ran ]"
probe "a write outside memory does not run it" green "$stand_in; echo x > note.md; guard \$PWD/note.md && [ ! -e ran ]"
probe "a tool outside the matcher does not run it" green "$stand_in; guard \$MEMORY_DIR/incident.md Read; [ ! -e ran ]"
probe "a missing gate is no pass" red "rm scripts/check-memory.ts; guard \$MEMORY_DIR/incident.md"
probe "a broken library is no pass" red "echo 'export function (' > scripts/lib/memory/memory-dir.ts; guard note.md"
probe "garbage on stdin stays a silent exit 0" green "printf 'no json' | node .claude/hooks/memory-guard.ts"

echo
probe_done
