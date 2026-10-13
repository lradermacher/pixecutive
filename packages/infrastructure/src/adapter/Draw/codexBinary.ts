// codexBinary.ts — where this Mac's Codex CLI is: the one the newest ChatGPT extension of VS Code ships.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** The extension folders' prefix and the CLI's place inside one. */
const extension = 'openai.chatgpt-';
const inside = ['bin', 'macos-aarch64', 'codex'];

/**
 * The Codex CLI of the newest extension under `home`'s VS Code extensions, compared by version; null when none is
 * installed.
 */
export function codexBinary(home: string): string | null {
	const folder = join(home, '.vscode', 'extensions');
	const versions = existsSync(folder) ? readdirSync(folder).filter((name) => name.startsWith(extension)) : [];
	const newest = versions.sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).at(-1);
	const binary = newest === undefined ? null : join(folder, newest, ...inside);
	return binary !== null && existsSync(binary) ? binary : null;
}
