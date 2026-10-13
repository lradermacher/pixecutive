import { chmodSync, existsSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { FigureException, FigureExceptionKey } from '@pixecutive/core';
import { describe, expect, it } from 'vitest';
import { ImageEditorCodexAdapter } from './imageEditor-codex.adapter.ts';

/** A codex that records its arguments, then runs `body`, with `$dir` the folder after `-C` and `$in` the input. */
function fakeCodex(body: string): { binary: string; args: () => string[] } {
	const dir = mkdtempSync(join(tmpdir(), 'codex-'));
	const binary = join(dir, 'codex');
	writeFileSync(
		binary,
		[
			'#!/bin/sh',
			`printf '%s\\n' "$@" > "${join(dir, 'args.txt')}"`,
			'dir=""; in=""; while [ $# -gt 1 ]; do [ "$1" = "-C" ] && dir="$2"; [ "$1" = "-i" ] && in="$2"; shift; done',
			body,
		].join('\n'),
	);
	chmodSync(binary, 0o755);
	return { binary, args: () => readFileSync(join(dir, 'args.txt'), 'utf8').trim().split('\n') };
}

/** A template and an output in a fresh folder. */
function job(): { input: string; prompt: string; output: string } {
	const dir = mkdtempSync(join(tmpdir(), 'draw-'));
	const input = join(dir, 'm-green-head.png');
	writeFileSync(input, 'template');
	return { input, prompt: 'Give every head a different hairstyle.', output: join(dir, 'hair-natural.png') };
}

const failureKey = (running: Promise<void>): Promise<unknown> =>
	running.then(
		() => 'resolved',
		(failure: unknown) => (failure instanceof FigureException ? failure.key : failure),
	);

describe('ImageEditorCodexAdapter', () => {
	it('hands codex the template, the folder and the framed prompt, and resolves once the drawing is there', async () => {
		const codex = fakeCodex('cp "$in" "$dir/hair-natural.png"; echo hair-natural.png');
		const edit = job();
		await new ImageEditorCodexAdapter(codex.binary).edit(edit);
		const args = codex.args();
		expect([
			readFileSync(edit.output, 'utf8'),
			args.slice(0, 9),
			args.at(-1)?.startsWith('Use your image generation tool to edit the attached image. Give every head'),
			args
				.at(-1)
				?.endsWith(
					'Save the resulting image as the file hair-natural.png in the current directory and reply only with its file name.',
				),
		]).toEqual([
			'template',
			[
				'exec',
				'--skip-git-repo-check',
				'--ephemeral',
				'-s',
				'workspace-write',
				'-C',
				dirname(edit.output),
				'-i',
				edit.input,
			],
			true,
			true,
		]);
	});

	it('makes the output folder before codex is started in it', async () => {
		const codex = fakeCodex(
			'[ -d "$dir" ] || { echo "Error: No such file or directory (os error 2)" >&2; exit 1; }; cp "$in" "$dir/1.png"',
		);
		const edit = job();
		const deeper = { ...edit, output: join(dirname(edit.output), 'hair', '1.png') };
		await new ImageEditorCodexAdapter(codex.binary).edit(deeper);
		expect(readFileSync(deeper.output, 'utf8')).toBe('template');
	});

	it('answers the quota key when codex says the usage limit is reached', async () => {
		const codex = fakeCodex('echo "ERROR: You\'ve hit your usage limit." >&2; exit 1');
		expect(await failureKey(new ImageEditorCodexAdapter(codex.binary).edit(job()))).toBe(FigureExceptionKey.DrawQuota);
	});

	it('takes a drawing left from an earlier call for none, so a used-up quota is still named', async () => {
		const codex = fakeCodex('echo "ERROR: You\'ve hit your usage limit." >&2; exit 1');
		const edit = job();
		writeFileSync(edit.output, 'an earlier drawing');
		utimesSync(edit.output, new Date(Date.now() - 60_000), new Date(Date.now() - 60_000));
		expect(await failureKey(new ImageEditorCodexAdapter(codex.binary).edit(edit))).toBe(FigureExceptionKey.DrawQuota);
	});

	it('answers the draw-failed key when codex ends without the drawing, also with exit 0', async () => {
		const codex = fakeCodex('echo "done"');
		const edit = job();
		expect([await failureKey(new ImageEditorCodexAdapter(codex.binary).edit(edit)), existsSync(edit.output)]).toEqual([
			FigureExceptionKey.DrawFailed,
			false,
		]);
	});

	it('answers the draw-failed key when codex cannot be started', async () => {
		expect(await failureKey(new ImageEditorCodexAdapter(join(tmpdir(), 'no-such-codex')).edit(job()))).toBe(
			FigureExceptionKey.DrawFailed,
		);
	});
});
