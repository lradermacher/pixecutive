#!/usr/bin/env bash
# probe-check-comments.sh — rejects a check-comments that misses a broken comment rule or flags a correct comment.
# cspell:ignore Quinlan
set -uo pipefail

root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$root" ] || { echo "probe-check-comments.sh: not a git repository." >&2; exit 1; }
# shellcheck source=scripts/lib/probe.sh
source "$root/scripts/lib/probe.sh"
probe_tree_init check-comments

mkdir -p "$work/scripts/lib/comments" "$work/.fixtures" "$work/src"
cp "$root/scripts/check-comments.ts" "$work/scripts/"
cp "$root/scripts/lib/comments/"*.ts "$work/scripts/lib/comments/"
echo ".fixtures/" >"$work/.git/info/exclude"
echo "export const base = 1;" >"$work/src/base.ts"
git -C "$work" add -A
git -C "$work" -c user.email=zelda@example.com -c user.name="Zelda Quinlan" commit -q -m base
PROBE_CLEAN_EXCLUDES=(.fixtures)

# Writes stdin into a named fixture outside the cases, so every case starts from the same bytes.
fixture() { cat >"$work/.fixtures/$1"; }
check='node scripts/check-comments.ts'
# Copies a fixture to its place in the tree, then runs the gate on that path; the change wrote every line of it.
run() { echo "mkdir -p \"\$(dirname '$2')\" && cp .fixtures/$1 '$2' && $check '$2'"; }

fixture date-red.ts <<'EOF'
// Fixed on 2026-09-05: the limit is eight.
const limit = 8;
EOF
fixture date-green.ts <<'EOF'
// The limit is eight lines because longer blocks go unread.
const limit = 8;
EOF
fixture person-red.ts <<'EOF'
// Zelda wanted it this way.
const limit = 8;
EOF
fixture person-tool.ts <<'EOF'
// Claude Code reads this file at start.
const limit = 8;
EOF
fixture person-model.ts <<'EOF'
// Claude decided this.
const limit = 8;
EOF
fixture person-file.ts <<'EOF'
// The template lives in claude.md.
const limit = 8;
EOF
fixture ticket-red.ts <<'EOF'
// Introduced with PIX-12.
const limit = 8;
EOF
fixture ticket-open.ts <<'EOF'
// open: the second service is missing (PIX-12)
const limit = 8;
EOF
fixture retrospect-red.ts <<'EOF'
// Previously a second counter ran here.
const limit = 8;
EOF
fixture retrospect-renamed.ts <<'EOF'
// The value was renamed from size.
const limit = 8;
EOF
fixture retrospect-green.ts <<'EOF'
// The counter runs over raw values so an outlier stays visible.
const limit = 8;
EOF
fixture banner-long.ts <<'EOF'
// ==========================
const limit = 8;
EOF
fixture banner-short.ts <<'EOF'
// --- Limits ---
const limit = 8;
EOF
fixture trailing-red.ts <<'EOF'
const limit = 8; // eight lines
EOF
fixture trailing-directive.ts <<'EOF'
const limit: number = 8; // eslint-disable-line no-magic-numbers -- the limit is the documented maximum
EOF
fixture marker-todo.ts <<'EOF'
// TODO: add the second service.
const limit = 8;
EOF
fixture marker-todo-card.ts <<'EOF'
// TODO: add the second service (PIX-12).
const limit = 8;
EOF
fixture marker-fixme.ts <<'EOF'
// FIXME later.
const limit = 8;
EOF
fixture directive-bare.ts <<'EOF'
// eslint-disable-next-line no-console
console.log(1);
EOF
fixture directive-reason.ts <<'EOF'
// eslint-disable-next-line no-console -- the script reports to the console
console.log(1);
EOF
fixture directive-ts.ts <<'EOF'
// @ts-expect-error
const limit: number = 'eight';
EOF
fixture dead-code.ts <<'EOF'
// const limit = 8;
const limit = 9;
EOF

echo "── Prohibitions ────────────────────────────────────────────────────────"
probe "a date is rejected" red "$(run date-red.ts src/a.ts)"
probe "a reason in the present tense passes" green "$(run date-green.ts src/a.ts)"
probe "a git author's name is rejected" red "$(run person-red.ts src/a.ts)"
probe "the tool name Claude Code passes" green "$(run person-tool.ts src/a.ts)"
probe "a model named as a decider is rejected" red "$(run person-model.ts src/a.ts)"
probe "a file name containing a name passes" green "$(run person-file.ts src/a.ts)"
probe "a card key as history is rejected" red "$(run ticket-red.ts src/a.ts)"
probe "a card key on an open point passes" green "$(run ticket-open.ts src/a.ts)"
probe "a retrospective is rejected" red "$(run retrospect-red.ts src/a.ts)"
probe "a rename told as history is rejected" red "$(run retrospect-renamed.ts src/a.ts)"
probe "a statement about today passes" green "$(run retrospect-green.ts src/a.ts)"
probe "a long banner is rejected" red "$(run banner-long.ts src/a.ts)"
probe "a short banner around a title is rejected" red "$(run banner-short.ts src/a.ts)"
probe "an end-of-line comment is rejected" red "$(run trailing-red.ts src/a.ts)"
probe "an end-of-line directive with a reason passes" green "$(run trailing-directive.ts src/a.ts)"
probe "a TODO without a card is rejected" red "$(run marker-todo.ts src/a.ts)"
probe "a TODO with a card passes" green "$(run marker-todo-card.ts src/a.ts)"
probe "FIXME is rejected" red "$(run marker-fixme.ts src/a.ts)"
probe "eslint-disable without a reason is rejected" red "$(run directive-bare.ts src/a.ts)"
probe "eslint-disable with a reason passes" green "$(run directive-reason.ts src/a.ts)"
probe "a bare @ts-expect-error is rejected" red "$(run directive-ts.ts src/a.ts)"
probe "commented-out code is rejected" red "$(run dead-code.ts src/a.ts)"

fixture regex-plain.ts <<'EOF'
const secure = /^https?:\/\//.test(process.argv[2] ?? '');
EOF
fixture regex-trailing.ts <<'EOF'
const secure = /^https?:\/\//.test(process.argv[2] ?? ''); // really at the end of the line
EOF
fixture regex-space.ts <<'EOF'
const parts = (process.argv[2] ?? '').split(/ +/); // really at the end of the line
EOF
fixture regex-division.ts <<'EOF'
const half = 10 / 2;
const third = half / 3;
EOF
fixture css-template.ts <<'EOF'
const sheet = `
  .box { width: calc(100% / 3); } /* fixed on 2026-09-05
   * one more line in the block
   */
`;
EOF
fixture shell-heredoc.sh <<'EOF'
#!/usr/bin/env bash
cat <<NOTE
Issue #12 and foo # bar
NOTE
EOF
fixture shell-multiline.sh <<'EOF'
#!/usr/bin/env bash
echo "first line
second # line"
EOF
fixture shell-trailing.sh <<'EOF'
#!/usr/bin/env bash
echo ok  # at the end of the line
EOF
fixture shell-count.sh <<'EOF'
#!/usr/bin/env bash
echo "$# ${#HOME} a#b"; n=$#
EOF

echo
echo "── Reading a line ──────────────────────────────────────────────────────"
probe "a regex literal is not a comment" green "$(run regex-plain.ts src/a.ts)"
probe "a comment behind a regex literal is found" red "$(run regex-trailing.ts src/a.ts)"
probe "a regex starting with a space does not hide a comment" red "$(run regex-space.ts src/a.ts)"
probe "a division is not a regex literal" green "$(run regex-division.ts src/a.ts)"
probe "a division in a CSS template does not hide a block" red "$(run css-template.ts src/a.ts)"
probe "# in a heredoc body is text" green "$(run shell-heredoc.sh src/a.sh)"
probe "# in the continuation of a string is text" green "$(run shell-multiline.sh src/a.sh)"
probe "a shell comment at the end of a line is found" red "$(run shell-trailing.sh src/a.sh)"
probe "\$# and \${#x} are not comments" green "$(run shell-count.sh src/a.sh)"

fixture head-long.ts <<'EOF'
// one
// two
// three
// four

const limit = 8;
EOF
fixture body-long.ts <<'EOF'
/** Returns the limit. */
export function limit(): number {
	// one
	// two
	// three
	// four
	return 8;
}
EOF
fixture body-short.ts <<'EOF'
/** Returns the limit. */
export function limit(): number {
	// one
	// two
	// three
	return 8;
}
EOF
fixture body-data.ts <<'EOF'
const limits = {
	// one
	// two
	// three
	// four
	upper: 8,
};
EOF
fixture gate-bare.ts <<'EOF'
const limit = 8;
EOF
fixture gate-head.ts <<'EOF'
// check-limit.ts — rejects a limit above eight.
const limit = 8;
EOF
fixture jsdoc-missing.ts <<'EOF'
export function limit(): number {
	return 8;
}
EOF
fixture jsdoc-present.ts <<'EOF'
/** Returns the documented maximum. */
export function limit(): number {
	return 8;
}
EOF
fixture throws-missing.ts <<'EOF'
/** Returns the limit for a size. */
export function limit(size: number): number {
	if (size < 0) throw new Error('negative size');
	return 8;
}
EOF
fixture throws-present.ts <<'EOF'
/**
 * Returns the limit for a size.
 * @throws Error when the size is negative.
 */
export function limit(size: number): number {
	if (size < 0) throw new Error('negative size');
	return 8;
}
EOF

echo
echo "── Lengths, heads and contracts ────────────────────────────────────────"
probe "a file head of four lines is rejected" red "$(run head-long.ts src/a.ts)"
probe "a long head in an audit of everything only warns" green \
	"cp .fixtures/head-long.ts src/a.ts && git add src/a.ts && git -c user.email=z@example.com -c user.name=Z commit -q -m head && $check --all"
probe "a body comment of four lines is rejected" red "$(run body-long.ts src/a.ts)"
probe "a body comment of three lines passes" green "$(run body-short.ts src/a.ts)"
probe "four comment lines above a data entry pass" green "$(run body-data.ts src/a.ts)"
probe "a gate without a head is rejected" red "$(run gate-bare.ts scripts/check-limit.ts)"
probe "a gate with a head passes" green "$(run gate-head.ts scripts/check-limit.ts)"
probe "an export without JSDoc is rejected" red "$(run jsdoc-missing.ts src/a.ts)"
probe "an export with JSDoc passes" green "$(run jsdoc-present.ts src/a.ts)"
probe "a throwing export without @throws is rejected" red "$(run throws-missing.ts src/a.ts)"
probe "a throwing export with @throws passes" green "$(run throws-present.ts src/a.ts)"

echo
echo "── Only what the change wrote ──────────────────────────────────────────"
probe "a committed violation the change did not touch is not reported" green \
	"cp .fixtures/date-red.ts src/a.ts && git add src/a.ts && git -c user.email=z@example.com -c user.name=Z commit -q -m old && echo 'const other = 1;' >> src/a.ts && $check src/a.ts"
probe "a violation the change wrote is reported" red \
	"cp .fixtures/date-green.ts src/a.ts && git add src/a.ts && git -c user.email=z@example.com -c user.name=Z commit -q -m old && echo '// Fixed on 2026-09-06.' >> src/a.ts && $check src/a.ts"
probe "--staged reports a staged violation" red "cp .fixtures/date-red.ts src/a.ts && git add src/a.ts && $check --staged"

probe "a named path that does not exist is red, never skipped" red "node scripts/check-comments.ts no/such/file.ts"

echo
probe_done
