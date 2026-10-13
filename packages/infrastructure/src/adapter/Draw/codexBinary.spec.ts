import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { codexBinary } from './codexBinary.ts';

/** A home whose VS Code holds the ChatGPT extensions `versions`, each with its CLI. */
function home(versions: string[]): string {
	const dir = mkdtempSync(join(tmpdir(), 'home-'));
	for (const version of versions) {
		const bin = join(dir, '.vscode', 'extensions', `openai.chatgpt-${version}-darwin-arm64`, 'bin', 'macos-aarch64');
		mkdirSync(bin, { recursive: true });
		writeFileSync(join(bin, 'codex'), '#!/bin/sh\n');
	}
	return dir;
}

describe('codexBinary', () => {
	it('takes the CLI of the newest extension by version, 26.1007 after 26.930', () => {
		const dir = home(['26.930.51102', '26.1007.21434']);
		expect(codexBinary(dir)).toBe(
			join(dir, '.vscode', 'extensions', 'openai.chatgpt-26.1007.21434-darwin-arm64', 'bin', 'macos-aarch64', 'codex'),
		);
	});

	it('answers null when no extension is installed', () => {
		expect(codexBinary(home([]))).toBeNull();
	});
});
