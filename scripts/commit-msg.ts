// commit-msg.ts — rejects a commit message without a Conventional Commits subject, with more than two text lines,
// without exactly one Co-Authored-By line, or with what the history guard forbids.
// Usage: node scripts/commit-msg.ts <message file>

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { readLocalConfig } from './lib/guard/read-local-config.ts';
import { scanText } from './lib/guard/scan-text.ts';

const maxTextLines = 2;
const subjectPattern = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9._/-]+\))?!?: .+/;

const file = process.argv[2] ?? '';
if (!existsSync(file)) process.exit(0);
// Git removes `#` lines itself, and everything from the scissors line of `commit -v` on is the diff, not the message.
const kept = readFileSync(file, 'utf8').split(/^# -+ >8 -+$/m)[0] ?? '';
const body = kept.split('\n').filter((line) => !line.startsWith('#'));
const subject = body.find((line) => line.trim() !== '') ?? '';
const findings: string[] = [];
// The message enters the public history as surely as the diff, so it gets the same scan, generated messages included.
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const config = readLocalConfig(root);
findings.push(...config.problems, ...scanText(body.map((text, index) => ({ location: `message:${index + 1}`, text })), config));
if (subject === '' || /^(Merge |Revert |fixup! |squash! |amend! )/.test(subject)) {
	for (const finding of findings) console.error(`⛔ ${finding}`);
	process.exit(findings.length > 0 ? 1 : 0);
}

if (!subjectPattern.test(subject)) {
	findings.push(`no Conventional Commits prefix: "${subject}" — expected e.g. feat(pix-42): agents pause when offline`);
}
const coAuthors = body.filter((line) => /^Co-Authored-By:/i.test(line));
if (!coAuthors.some((line) => /^Co-Authored-By:\s*.+<.+@.+>/i.test(line))) {
	findings.push('the Co-Authored-By line is missing — form: Co-Authored-By: <Name> <mail@example.com>');
} else if (coAuthors.length > 1) {
	findings.push(`${coAuthors.length} Co-Authored-By lines; exactly one is allowed`);
}
const textLines = body.filter((line) => line.trim() !== '' && !/^Co-Authored-By:/i.test(line)).length;
if (textLines > maxTextLines) {
	findings.push(`${textLines} text lines; at most ${maxTextLines}: say what and why, not the history of the work`);
}
for (const finding of findings) console.error(`⛔ ${finding}`);
process.exit(findings.length > 0 ? 1 : 0);
