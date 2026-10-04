// check-carriers.ts — rejects a carrier that a rule or an accepted ADR names but that does not exist, and a hook,
// agent or data file that lacks a required field of its template.
// Usage: node scripts/check-carriers.ts [named | hooks | agents | data | --all]; exit 2 on an unknown check.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter } from './lib/frontmatter.ts';

const contractFields = ['rule', 'event', 'matcher', 'stdin', 'exit', 'probe'];
const agentFields = ['name', 'description', 'tools', 'model'];
const dataFields = ['schema', 'read-by', 'adr', 'generated'];
const toolless = new Set(['UserPromptSubmit', 'SessionStart', 'SessionEnd', 'Stop']);

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const findings: string[] = [];
const fail = (finding: string): void => {
	findings.push(finding);
	console.log(`⛔ ${finding}`);
};
const read = (path: string): string => readFileSync(join(root, path), 'utf8');
const files = (dir: string, test: (name: string) => boolean): string[] =>
	existsSync(join(root, dir)) ? readdirSync(join(root, dir)).filter((name) => test(name) && statSync(join(root, dir, name)).isFile()).map((name) => `${dir}/${name}`) : [];

// A name is one word, or carries a dot or dash before free text; `Gate ticket open` names no file, `Gate ticket.ts open` does.
const candidates: Record<string, (name: string) => string[]> = {
	Hook: (name) => [`.claude/hooks/${name}.ts`, `.githooks/${name}`],
	Gate: (name) => [`scripts/${name}`, `scripts/${name}.ts`, `scripts/${name}.sh`],
	Skill: (name) => [`.claude/skills/${name}/SKILL.md`],
	Agent: (name) => [`.claude/agents/${name}.md`],
	Data: (name) => files('.claude/data', (file) => file.startsWith(`${name}.`)),
};

function named(): void {
	const before = findings.length;
	let checked = 0;
	const sources = [
		...files('docs/ADR', (name) => /^\d{4}-.*\.md$/.test(name)).filter((path) => parseFrontmatter(read(path)).data['status'] === 'accepted'),
		...files('.claude/rules', (name) => name.endsWith('.md')),
	];
	const harness = new Set(['Explore', 'Plan', 'general-purpose', 'claude', 'statusline-setup', 'fork', 'workflow-subagent']);
	for (const path of sources) {
		const text = read(path);
		// A point another ADR superseded may name what that ADR removed: `superseded-by: 17 # point 4 only; …`.
		const replaced = new Set((/^superseded-by:\s*\d+\s*#\s*points?\s+([\d, and]+?)\s+only/m.exec(text)?.[1] ?? '').match(/\d+/g) ?? []);
		for (const tag of text.matchAll(/`\[([^\]`]+)\]`/g)) {
			const line = text.slice(0, tag.index).split('\n').length;
			// Only a bracket under `## Decision` itself, before its first subheading, belongs to a numbered point.
			// A heading inside a code fence is no heading.
			const before = text.slice(0, tag.index).replace(/```[\s\S]*?```/g, '');
			const heading = [...before.matchAll(/^#{2,} (.+)$/gm)].at(-1);
			const points = heading?.[0]?.trim() === '## Decision' ? [...before.slice(heading.index).matchAll(/^(\d+)\. \*\*/gm)] : [];
			if (replaced.has(points.at(-1)?.[1] ?? '')) continue;
			for (const part of (tag[1] ?? '').replace(/\s+/g, ' ').split('·')) {
				const match = /^(Hook|Gate|Skill|Agent|Data) (\S+)(.*)$/.exec(part.trim());
				if (!match) continue;
				const [, kind = '', raw = '', rest = ''] = match;
				const name = raw.replace(/[,;]$/, '');
				if (!/^[a-z0-9][a-z0-9._-]*$/.test(name) || (rest.trim() !== '' && !/[.-]/.test(name)) || harness.has(name)) continue;
				checked += 1;
				if (!(candidates[kind]?.(name) ?? []).some((candidate) => existsSync(join(root, candidate)))) {
					fail(`${path}:${line}: [${kind} ${name}] names a carrier that does not exist`);
				}
			}
		}
	}
	if (findings.length === before) console.log(`✅ named: ${checked} named carriers in ${sources.length} files, each exists`);
}

function hooks(): void {
	const before = findings.length;
	const list = files('.claude/hooks', (name) => name.endsWith('.ts'));
	for (const path of list) {
		const contract = /export const contract = \{([\s\S]*?)\} as const;/.exec(read(path))?.[1];
		if (contract === undefined) {
			fail(`${path}: no exported contract object (template .claude/templates/hook.ts)`);
			continue;
		}
		for (const field of contractFields) if (!new RegExp(`^\\s*${field}: '[^']+'`, 'm').test(contract)) {
			// Prompt and session events have no tool to match, so their matcher is the empty string.
			const event = /event: '([^']+)'/.exec(contract)?.[1] ?? '';
			if (field === 'matcher' && /matcher: ''/.test(contract) && toolless.has(event)) continue;
			fail(`${path}: the contract lacks ${field}`);
		}
		const probe = /probe: '([^']+)'/.exec(contract)?.[1] ?? '';
		if (probe !== '' && !existsSync(join(root, probe))) fail(`${path}: the contract names the probe ${probe}, which does not exist`);
	}
	if (findings.length === before) console.log(`✅ hooks: ${list.length} hooks, each with a complete contract and an existing probe`);
}

function agents(): void {
	const before = findings.length;
	const list = files('.claude/agents', (name) => name.endsWith('.md'));
	for (const path of list) {
		const { data } = parseFrontmatter(read(path));
		for (const field of agentFields) if (!(field in data)) fail(`${path}: the required field ${field}: is missing`);
	}
	if (findings.length === before) console.log(`✅ agents: ${list.length} agent definitions with their required fields`);
}

function data(): void {
	const before = findings.length;
	const list = files('.claude/data', () => true);
	for (const path of list) {
		const head = read(path).split('\n').slice(0, 30).join('\n');
		const missing = dataFields.filter((field) => !new RegExp(`^(#\\s*)?${field}:`, 'm').test(head));
		if (missing.length > 0) fail(`${path}: the head lacks ${missing.join(', ')} (template .claude/templates/data.md)`);
	}
	if (findings.length === before) console.log(`✅ data: ${list.length} data files with schema, read-by, adr and generated`);
}

const checks: Record<string, () => void> = { named, hooks, agents, data };
const wanted = process.argv[2] ?? '--all';
if (wanted === '--all') for (const check of Object.values(checks)) check();
else if (checks[wanted]) checks[wanted]();
else {
	console.error(`check-carriers: unknown check '${wanted}'; allowed: ${Object.keys(checks).join(', ')} or --all`);
	process.exit(2);
}
if (findings.length > 0) process.exit(1);
