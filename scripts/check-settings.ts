// check-settings.ts — rejects a .claude/settings.json that allows bypassing permissions, lifts the limit of two
// agents, allows a path outside this repo, or wires a hook that does not exist or leaves one wired nowhere. Usage: node scripts/check-settings.ts [--all]

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const path = join(root, '.claude', 'settings.json');
const findings: string[] = [];

let settings: { permissions?: { allow?: unknown; disableBypassPermissionsMode?: unknown }; env?: Record<string, unknown>; hooks?: unknown } = {};
try {
	settings = JSON.parse(readFileSync(path, 'utf8')) as typeof settings;
} catch {
	findings.push('.claude/settings.json is missing or not valid JSON');
}
const text = existsSync(path) ? readFileSync(path, 'utf8') : '';
if (/bypassPermissions(?!Mode")/.test(text)) findings.push('bypassPermissions appears as a mode; a session would run without any permission prompt');
if (settings.permissions?.disableBypassPermissionsMode !== 'disable') findings.push('permissions.disableBypassPermissionsMode must be "disable"');
// The harness counts the agents it starts; this value is the limit of ADR 0017.
if (settings.env?.['CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS'] !== '2') findings.push('env.CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS must be "2" (ADR 0017)');
const allow = Array.isArray(settings.permissions?.allow) ? settings.permissions.allow.map(String) : [];
for (const rule of allow.filter((entry) => /\((?:[^)]*\s)?(?:\/|~|\$HOME|\.\.\/)/.test(entry))) {
	findings.push(`allow rule ${rule} reaches outside this repo`);
}
const wired = [...JSON.stringify(settings.hooks ?? {}).matchAll(/\.claude\/hooks\/([\w-]+\.ts)/g)].map((match) => match[1] ?? '');
for (const hook of new Set(wired)) if (!existsSync(join(root, '.claude', 'hooks', hook))) findings.push(`hook .claude/hooks/${hook} is wired but does not exist`);
const hooks = existsSync(join(root, '.claude', 'hooks')) ? readdirSync(join(root, '.claude', 'hooks')).filter((name) => name.endsWith('.ts')) : [];
for (const hook of hooks.filter((name) => !wired.includes(name))) findings.push(`hook .claude/hooks/${hook} exists but is wired nowhere, so it never runs`);

for (const finding of findings) console.log(`⛔ ${finding}`);
if (findings.length > 0) process.exit(1);
console.log(`✅ check-settings: ${new Set(wired).size} hooks wired, no bypass, no allow rule outside the repo`);
