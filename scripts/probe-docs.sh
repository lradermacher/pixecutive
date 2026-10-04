#!/usr/bin/env bash
# probe-docs.sh — every check of check-docs red once and green once: ADR frontmatter, Rejected, mechanisms on decision
# points, document classes, in a throwaway repo with a small but real document tree.
set -uo pipefail

root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$root" ] || { echo "probe-docs.sh: not a git repository." >&2; exit 1; }

# shellcheck source=scripts/lib/probe.sh
source "$root/scripts/lib/probe.sh"
probe_tree_init docs

mkdir -p "$work/scripts/lib" "$work/.claude/data" "$work/docs/ADR" "$work/docs/plans" "$work/docs/research"
cp "$root/scripts/check-docs.ts" "$work/scripts/"
cp "$root/scripts/lib/frontmatter.ts" "$root/scripts/lib/data-rows.ts" "$work/scripts/lib/"
cp "$root/.claude/data/document-classes.tsv" "$work/.claude/data/"
printf '%s\n' '# Probe' '' '## Authoritative documents' '' '1. [ADR](docs/ADR/README.md)' '' '## Next' >"$work/CLAUDE.md"
printf '%s\n' '# ADR' >"$work/docs/ADR/README.md"
adr() {
	printf '%s\n' '---' "status: ${1:-accepted}" 'date: 2026-01-01' 'decision-makers: probe' "kind: ${2:-workflow}" 'supersedes: []' \
		'superseded-by: null' '---' '' '# ADR' '' '## Decision' '' '1. **A point.** It holds. `[Gate check-docs]`' \
		'2. **Another point.** It holds too.' '   `[Prose: a judgment]`' '' '## Rejected' '' '- B, because.'
}
adr >"$work/docs/ADR/0001-probe.md"
printf '%s\n' '# Plan' >"$work/docs/plans/PLAN_X.md"
printf '%s\n' '# Analysis' >"$work/docs/research/X.md"
probe_tree_commit
check='node scripts/check-docs.ts'

echo "── The clean tree ──────────────────────────────────────────────────────"
probe "every check" green "$check"
probe "an unknown check stops with exit 2" green "$check nonsense; [ \$? -eq 2 ]"

echo
echo "── adr ─────────────────────────────────────────────────────────────────"
probe "an unknown status" red "adr maybe > docs/ADR/0001-probe.md && $check adr"
probe "an unknown kind" red "adr accepted business > docs/ADR/0001-probe.md && $check adr"
probe "a missing field" red "adr | grep -v '^date:' > docs/ADR/0001-probe.md && $check adr"

echo
echo "── rejected ────────────────────────────────────────────────────────────"
probe "an accepted ADR without the section" red "adr | perl -pe 's/^## Rejected/## Gone/' > docs/ADR/0001-probe.md && $check rejected"
probe "an accepted ADR with an empty section" red "adr | perl -pe 's/^- B, because\\.\$/<!-- nothing -->/' > docs/ADR/0001-probe.md && $check rejected"
probe "a superseded ADR without the section" green "adr superseded | perl -pe 's/^## Rejected/## Gone/' > docs/ADR/0001-probe.md && $check rejected"

echo
echo "── mechanism ───────────────────────────────────────────────────────────"
probe "a decision point without a mechanism" red "adr | perl -pe 's/ \`\\[Gate check-docs\\]\`//' > docs/ADR/0001-probe.md && $check mechanism"
probe "a mechanism on the wrapped next line counts" green "$check mechanism"
probe "a point under Decision drivers is no decision point" green \
	"adr | perl -pe 's/^## Decision\$/## Decision drivers\n\n1. **Driver.** No bracket.\n\n## Decision/' > docs/ADR/0001-probe.md && $check mechanism"

echo
echo "── classes ─────────────────────────────────────────────────────────────"
probe "a document outside every class" red "mkdir -p docs/legal && echo x > docs/legal/X.md && $check classes"
probe "a document in the canon" green "echo x > docs/ADR/notes.md && $check classes"
probe "two classes for one prefix" red "printf 'docs/plans/\tarchive\tx\n' >> .claude/data/document-classes.tsv && $check classes"
probe "canon unknown without the section" red "printf '# Probe\n' > CLAUDE.md && $check classes"

echo
probe_done
