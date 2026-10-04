// <What this hook rejects, in one line.>

/**
 * The contract the harness relies on. Every field is required; the probe named here must turn this hook red.
 */
export const contract = {
	rule: '<.claude/rules/….md or docs/ADR/….md that this hook enforces>',
	event: '<PreToolUse | PostToolUse | UserPromptSubmit | SessionStart | SessionEnd | SubagentStop>',
	matcher: '<tool pattern, e.g. Edit|Write>',
	stdin: '<the fields of the harness JSON this hook actually reads>',
	exit: '0 = pass · 2 = <what exactly is rejected> · anything else = an error in the hook itself',
	probe: '<scripts/probe-….sh>',
} as const;

// <The check: one thing, not three.>
// A rejection is one line with the way forward, written to stderr, then exit code 2:
// process.stderr.write('⛔ <what is violated>. <what to do>.\n');
// process.exit(2);

/*
EXCLUDED, does not belong in a hook:
  ⛔ multi-line lectures to the model → one line; the rest stands in the rule
  ⛔ failing silently                  → a hook that cannot check says so instead of passing
  ⛔ its own list of paths             → read the data file that belongs to the rule or ADR
*/
