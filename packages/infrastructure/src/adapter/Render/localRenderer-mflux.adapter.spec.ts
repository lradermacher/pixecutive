import { spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type RenderJob, RenderException, RenderExceptionKey } from '@pixecutive/core';
import { describe, expect, it } from 'vitest';
import { LocalRendererMfluxAdapter, type MfluxRenderConfig } from './localRenderer-mflux.adapter.ts';

/** A prompt and an input image that exist, as every render now checks before it starts the model. */
const inputs = mkdtempSync(join(tmpdir(), 'inputs-'));
writeFileSync(join(inputs, 'figure.txt'), 'a prompt');
writeFileSync(join(inputs, 'figure.png'), 'an image');
const job: RenderJob = {
	promptFile: join(inputs, 'figure.txt'),
	inputImage: join(inputs, 'figure.png'),
	seed: 11,
	width: 1024,
	height: 768,
};

/**
 * A fake mflux: keeps its arguments, prints a progress step like mflux, waits, then writes the image named after
 * `--output`, or exits with `exitCode` without one.
 */
function fakeMflux(dir: string, sleepSeconds: string, exitCode = 0): string {
	const path = join(dir, 'mflux');
	writeFileSync(
		path,
		[
			'#!/bin/sh',
			`printf '%s\\n' "$@" > "${join(dir, 'args.txt')}"`,
			'out=""; while [ $# -gt 0 ]; do [ "$1" = "--output" ] && out="$2"; shift; done',
			`printf ' 1/8 [00:01<00:07, 1.0s/it]\\n'; sleep ${sleepSeconds}`,
			exitCode === 0 ? 'printf x > "$out"' : `exit ${String(exitCode)}`,
		].join('\n'),
	);
	chmodSync(path, 0o755);
	return path;
}

function adapter(
	readings: readonly { pressure: number; swapMb: number }[],
	sleepSeconds = '0.2',
	exitCode = 0,
	override: (dir: string) => Partial<MfluxRenderConfig> = () => ({}),
): { renderer: LocalRendererMfluxAdapter; dir: string; interrupts: EventEmitter } {
	const dir = mkdtempSync(join(tmpdir(), 'mflux-'));
	const interrupts = new EventEmitter();
	let reads = 0;
	const renderer = new LocalRendererMfluxAdapter({
		rendersDir: dir,
		mflux: fakeMflux(dir, sleepSeconds, exitCode),
		lora: '/hub/lightning.safetensors',
		intervalMs: 50,
		readMemory: (): { pressure: number; swapMb: number } =>
			readings[Math.min(reads++, readings.length - 1)] ?? { pressure: 1, swapMb: 0 },
		clock: { now: (): Date => new Date('2026-10-12T09:30:00.000Z') },
		interrupts,
		...override(dir),
	});
	return { renderer, dir, interrupts };
}

/** The key of the `RenderException` a render rejects with. */
async function failureKey(render: Promise<unknown>): Promise<RenderExceptionKey | null> {
	const failure: unknown = await render.then(
		() => null,
		(error: unknown) => error,
	);
	return failure instanceof RenderException ? failure.key : null;
}

describe('LocalRendererMfluxAdapter', () => {
	it('answers the image and logs a done row with every column', async () => {
		const { renderer, dir } = adapter([{ pressure: 1, swapMb: 100 }]);
		expect(await renderer.render(job)).toEqual({ name: 'figure-s11', image: join(dir, 'figure-s11.png') });
		const row = readFileSync(join(dir, 'renders.tsv'), 'utf8').trim().split('\t');
		expect(row).toHaveLength(11);
		expect([row[0], row[4], row[10]]).toEqual(['2026-10-12 09:30 UTC', '1024x768', 'done']);
	});

	it('hands mflux the job, the LoRA and the side file it writes into', async () => {
		const { renderer, dir } = adapter([{ pressure: 1, swapMb: 100 }]);
		await renderer.render(job);
		const args = readFileSync(join(dir, 'args.txt'), 'utf8').split('\n');
		expect(args.slice(args.indexOf('--seed'), args.indexOf('--seed') + 4)).toEqual([
			'--seed',
			'11',
			'--output',
			join(dir, 'figure-s11.rendering.png'),
		]);
		expect(args[args.indexOf('--lora-paths') + 1]).toBe('/hub/lightning.safetensors');
	});

	it('refuses a start at warning pressure without rendering', async () => {
		const { renderer, dir } = adapter([{ pressure: 2, swapMb: 100 }]);
		expect(await failureKey(renderer.render(job))).toBe(RenderExceptionKey.MemoryPressure);
		expect(() => readFileSync(join(dir, 'renders.tsv'))).toThrow();
	});

	it('aborts at critical pressure while running and logs why', async () => {
		const readings = [
			{ pressure: 1, swapMb: 100 },
			{ pressure: 4, swapMb: 100 },
		];
		const { renderer, dir } = adapter(readings, '2');
		expect(await failureKey(renderer.render(job))).toBe(RenderExceptionKey.Aborted);
		expect(readFileSync(join(dir, 'renders.tsv'), 'utf8')).toContain('ABORT: memory pressure level 4');
	});

	it('aborts when swap grows past the limit', async () => {
		const readings = [
			{ pressure: 1, swapMb: 100 },
			{ pressure: 1, swapMb: 17000 },
		];
		const { renderer, dir } = adapter(readings, '2');
		expect(await failureKey(renderer.render(job))).toBe(RenderExceptionKey.Aborted);
		expect(readFileSync(join(dir, 'renders.tsv'), 'utf8')).toContain('ABORT: swap +16900 MB over the 16384 MB limit');
	});
});

describe('LocalRendererMfluxAdapter when something fails', () => {
	it('answers the failed key and logs why when mflux cannot be started', async () => {
		const { renderer, dir } = adapter([{ pressure: 1, swapMb: 100 }], '0.2', 0, (folder) => ({
			mflux: join(folder, 'no-such-mflux'),
		}));
		expect(await failureKey(renderer.render(job))).toBe(RenderExceptionKey.Failed);
		expect(readFileSync(join(dir, 'renders.tsv'), 'utf8')).toMatch(/\tFAILED: spawn .*ENOENT/);
	});

	it.each([
		['prompt file', { promptFile: join(inputs, 'no-such.txt') }],
		['input image', { inputImage: join(inputs, 'no-such.png') }],
	])('refuses a missing %s before it takes the lock or starts the model', async (_, missing) => {
		const { renderer, dir } = adapter([{ pressure: 1, swapMb: 100 }]);
		expect(await failureKey(renderer.render({ ...job, ...missing }))).toBe(RenderExceptionKey.InvalidJob);
		expect([existsSync(join(dir, 'current.lock')), existsSync(join(dir, 'args.txt'))]).toEqual([false, false]);
	});
});

describe('LocalRendererMfluxAdapter and what mflux says when it fails', () => {
	it('logs the last error line of mflux on one line, past a warning after it', async () => {
		const { renderer, dir } = adapter(
			[{ pressure: 1, swapMb: 100 }],
			'0.2',
			0,
			model(
				"#!/bin/sh\n{ printf ' 2/8 [00:02<00:06, 1.0s/it]\\n'; echo 'RuntimeError: first'; printf 'ValueError: width\\tmust be even\\n'; echo 'UserWarning: resource_tracker'; } >&2\nexit 1\n",
			),
		);
		expect(await failureKey(renderer.render(job))).toBe(RenderExceptionKey.Failed);
		const row = readFileSync(join(dir, 'renders.tsv'), 'utf8').trim().split('\t');
		expect([row.length, row[10]]).toEqual([11, 'FAILED: exit 1: ValueError: width must be even']);
	});

	it.each([
		[
			'a progress line after a plain complaint',
			"{ echo 'model weights look odd'; printf ' 2/8 [00:02<00:06, 1.0s/it]\\n'; } >&2",
			'exit 1: model weights look odd',
		],
		['a line on the standard output only', "echo 'ValueError: printed, not complained'", 'exit 1'],
	])('keeps the right reason with %s', async (_, lines, reason) => {
		const { renderer, dir } = adapter([{ pressure: 1, swapMb: 100 }], '0.2', 0, model(`#!/bin/sh\n${lines}\nexit 1\n`));
		await renderer.render(job).catch(() => null);
		expect(readFileSync(join(dir, 'renders.tsv'), 'utf8').trim().split('\t')[10]).toBe(`FAILED: ${reason}`);
	});

	it('takes no complaint from the standard output and cuts a long one', async () => {
		const long = 'x'.repeat(400);
		const { renderer, dir } = adapter(
			[{ pressure: 1, swapMb: 100 }],
			'0.2',
			0,
			model(`#!/bin/sh\necho 'Saving image...'\necho 'OSError: ${long}' >&2\nexit 2\n`),
		);
		await renderer.render(job).catch(() => null);
		const result = readFileSync(join(dir, 'renders.tsv'), 'utf8').trim().split('\t')[10] ?? '';
		expect([result.startsWith('FAILED: exit 2: OSError: x'), result.length]).toEqual([
			true,
			'FAILED: exit 2: '.length + 300,
		]);
	});

	it('names the signal that ended mflux instead of an exit code', async () => {
		const { renderer, dir } = adapter([{ pressure: 1, swapMb: 100 }], '0.2', 0, model('#!/bin/sh\nkill -ABRT $$\n'));
		expect(await failureKey(renderer.render(job))).toBe(RenderExceptionKey.Failed);
		expect(readFileSync(join(dir, 'renders.tsv'), 'utf8').trim().split('\t')[10]).toBe('FAILED: signal SIGABRT');
	});

	it('answers the failed key and logs the exit code when mflux fails', async () => {
		const { renderer, dir } = adapter([{ pressure: 1, swapMb: 100 }], '0', 3);
		expect(await failureKey(renderer.render(job))).toBe(RenderExceptionKey.Failed);
		expect(readFileSync(join(dir, 'renders.tsv'), 'utf8')).toContain('FAILED: exit 3');
	});
});

describe('LocalRendererMfluxAdapter when its folder or the memory fails', () => {
	it('names the running render with its current step while it runs', async () => {
		const { renderer } = adapter([{ pressure: 1, swapMb: 100 }], '2');
		const running = renderer.render(job);
		// The fake prints its step at once; a loaded machine may still take a moment to start it.
		let seen: string | null = null;
		for (let tries = 0; tries < 40 && seen !== 'figure-s11 1/8'; tries += 1) {
			await new Promise((resolve) => setTimeout(resolve, 50));
			seen = renderer.status().running;
		}
		expect(seen).toBe('figure-s11 1/8');
		await running;
		expect(renderer.status().running).toBeNull();
	});

	it('answers the storage key when the renders folder cannot be made', async () => {
		const { renderer } = adapter([{ pressure: 1, swapMb: 100 }], '0.2', 0, (dir) => {
			writeFileSync(join(dir, 'blocked'), 'a file, not a folder');
			return { rendersDir: join(dir, 'blocked', 'renders') };
		});
		expect(await failureKey(renderer.render(job))).toBe(RenderExceptionKey.StorageFailed);
	});

	it('ends the run with the storage key when the renders folder goes away while mflux runs', async () => {
		const { renderer } = adapter([{ pressure: 1, swapMb: 100 }], '0.2', 0, (dir) => {
			const vanishing = join(dir, 'vanishing-mflux');
			writeFileSync(
				vanishing,
				`#!/bin/sh\nsleep 0.3\nrm -rf "${join(dir, 'renders')}"\nprintf ' 1/8 [00:01<00:07, 1.0s/it]\\n'\nexec sleep 20\n`,
			);
			chmodSync(vanishing, 0o755);
			return { mflux: vanishing, rendersDir: join(dir, 'renders') };
		});
		const startedAt = Date.now();
		expect(await failureKey(renderer.render(job))).toBe(RenderExceptionKey.StorageFailed);
		expect(Date.now() - startedAt).toBeLessThan(5000);
	});

	it('answers the unreadable memory key before a start without its guard', async () => {
		const { renderer } = adapter([], '0.2', 0, () => ({
			readMemory: (): { pressure: number; swapMb: number } => {
				throw new TypeError('sysctl is missing');
			},
		}));
		expect(await failureKey(renderer.render(job))).toBe(RenderExceptionKey.MemoryUnreadable);
	});

	it('never takes an image of an earlier run as the result, and keeps it when the new run fails', async () => {
		const { renderer, dir } = adapter([{ pressure: 1, swapMb: 100 }], '0.2', 0, (folder) => {
			const silent = join(folder, 'silent-mflux');
			writeFileSync(silent, '#!/bin/sh\nexit 0\n');
			chmodSync(silent, 0o755);
			return { mflux: silent };
		});
		writeFileSync(join(dir, 'figure-s11.png'), 'an earlier image');
		expect(await failureKey(renderer.render(job))).toBe(RenderExceptionKey.Failed);
		expect(readFileSync(join(dir, 'renders.tsv'), 'utf8')).toContain('FAILED: no image');
		expect(readFileSync(join(dir, 'figure-s11.png'), 'utf8')).toBe('an earlier image');
	});

	it('replaces an earlier image only with a finished one', async () => {
		const { renderer, dir } = adapter([{ pressure: 1, swapMb: 100 }]);
		writeFileSync(join(dir, 'figure-s11.png'), 'an earlier image');
		await renderer.render(job);
		expect([
			readFileSync(join(dir, 'figure-s11.png'), 'utf8'),
			existsSync(join(dir, 'figure-s11.rendering.png')),
		]).toEqual(['x', false]);
	});
});

describe('LocalRendererMfluxAdapter and its lock', () => {
	it('refuses a second render while one runs', async () => {
		const { renderer, dir } = adapter([{ pressure: 1, swapMb: 100 }]);
		writeFileSync(join(dir, 'current.lock'), `${String(process.pid)}\tother`);
		expect(await failureKey(renderer.render(job))).toBe(RenderExceptionKey.Busy);
	});

	it('clears an empty lock and renders', async () => {
		const { renderer, dir } = adapter([{ pressure: 1, swapMb: 100 }]);
		writeFileSync(join(dir, 'current.lock'), '');
		expect(renderer.status().running).toBeNull();
		expect((await renderer.render(job)).name).toBe('figure-s11');
	});

	it('stays busy while mflux of a lock still runs, though its first process is gone', async () => {
		const { renderer, dir } = adapter([{ pressure: 1, swapMb: 100 }]);
		const gone = spawnSync('true').pid;
		writeFileSync(join(dir, 'current.lock'), `${String(gone)},${String(process.pid)}\tfigure-s9 3/8`);
		expect(await failureKey(renderer.render(job))).toBe(RenderExceptionKey.Busy);
	});

	it('clears a lock whose process is gone and renders', async () => {
		const { renderer, dir } = adapter([{ pressure: 1, swapMb: 100 }]);
		const gone = spawnSync('true').pid;
		writeFileSync(join(dir, 'current.lock'), `${String(gone)}\tfigure-s9 3/8`);
		expect(renderer.status().running).toBeNull();
		expect((await renderer.render(job)).name).toBe('figure-s11');
	});

	it('stops on an interrupt, logs why and leaves no lock behind', async () => {
		const { renderer, dir, interrupts } = adapter([{ pressure: 1, swapMb: 100 }], '2');
		const running = failureKey(renderer.render(job));
		await new Promise((resolve) => setTimeout(resolve, 300));
		interrupts.emit('SIGINT');
		expect(await running).toBe(RenderExceptionKey.Interrupted);
		expect(readFileSync(join(dir, 'renders.tsv'), 'utf8')).toContain('ABORT: interrupted');
		expect(existsSync(join(dir, 'current.lock'))).toBe(false);
	});

	it('ends a model that ignores the first interrupt at the second', async () => {
		const { renderer, interrupts } = adapter([{ pressure: 1, swapMb: 100 }], '0.2', 0, (folder) => {
			const stubborn = join(folder, 'stubborn-mflux');
			writeFileSync(stubborn, "#!/bin/sh\ntrap '' TERM INT\nexec sleep 20\n");
			chmodSync(stubborn, 0o755);
			return { mflux: stubborn };
		});
		const startedAt = Date.now();
		const running = failureKey(renderer.render(job));
		setTimeout(() => interrupts.emit('SIGINT'), 300);
		setTimeout(() => interrupts.emit('SIGINT'), 600);
		expect(await running).toBe(RenderExceptionKey.Interrupted);
		expect(Date.now() - startedAt).toBeLessThan(5000);
	});

	it('shows the running render, the memory and the last log rows', async () => {
		const { renderer, dir } = adapter([{ pressure: 1, swapMb: 100 }]);
		await renderer.render(job);
		writeFileSync(join(dir, 'current.lock'), `${String(process.pid)}\tfigure-s12`);
		const status = renderer.status();
		expect([status.running, status.pressure, status.swapMb, status.lastRows.length]).toEqual(['figure-s12', 1, 100, 1]);
	});
});

/** An mflux written as `script`, for the cases that need a model behaving in one particular way. */
function model(script: string): (folder: string) => Partial<MfluxRenderConfig> {
	return (folder) => {
		const path = join(folder, 'model-mflux');
		writeFileSync(path, script);
		chmodSync(path, 0o755);
		return { mflux: path };
	};
}

/** A model that ignores TERM and INT from its first line, writes its image at once, then waits until it is killed. */
const stubbornWriter = `#!/bin/sh\ntrap '' TERM INT\nout=""; while [ $# -gt 0 ]; do [ "$1" = "--output" ] && out="$2"; shift; done\nprintf x > "$out"\nexec sleep 20\n`;

describe('LocalRendererMfluxAdapter when it is stopped or cannot finish', () => {
	it('names mflux in the lock from the moment it starts', async () => {
		const { renderer, dir } = adapter([{ pressure: 1, swapMb: 100 }], '0.2', 0, model('#!/bin/sh\nexec sleep 1\n'));
		const running = renderer.render(job).catch(() => null);
		await new Promise((resolve) => setTimeout(resolve, 300));
		const [processIds = ''] = readFileSync(join(dir, 'current.lock'), 'utf8').split('\t');
		expect(processIds.split(',')).toHaveLength(2);
		await running;
	});

	it('ends a stubborn model at the second interrupt even after the guard stopped the run', async () => {
		const readings = [
			{ pressure: 1, swapMb: 100 },
			{ pressure: 4, swapMb: 100 },
		];
		// The guard reads after 500 ms, when the model surely ignores TERM already; the interrupts come after it.
		const { renderer, interrupts } = adapter(readings, '0.2', 0, (folder) => ({
			...model(stubbornWriter)(folder),
			intervalMs: 500,
		}));
		const startedAt = Date.now();
		const running = failureKey(renderer.render(job));
		setTimeout(() => interrupts.emit('SIGINT'), 900);
		setTimeout(() => interrupts.emit('SIGINT'), 1200);
		expect(await running).toBe(RenderExceptionKey.Aborted);
		expect(Date.now() - startedAt).toBeLessThan(5000);
	});

	it('answers the failed key and logs why when the model file cannot be run at all', async () => {
		const { renderer, dir } = adapter([{ pressure: 1, swapMb: 100 }], '0.2', 0, model('no shebang, no binary\n'));
		expect(await failureKey(renderer.render(job))).toBe(RenderExceptionKey.Failed);
		expect(readFileSync(join(dir, 'renders.tsv'), 'utf8')).toMatch(/\tFAILED: spawn/);
	});

	it('leaves no unfinished image beside the earlier one after an interrupted run', async () => {
		const { renderer, dir, interrupts } = adapter([{ pressure: 1, swapMb: 100 }], '0.2', 0, model(stubbornWriter));
		writeFileSync(join(dir, 'figure-s11.png'), 'an earlier image');
		const running = failureKey(renderer.render(job));
		setTimeout(() => interrupts.emit('SIGINT'), 300);
		setTimeout(() => interrupts.emit('SIGINT'), 600);
		expect(await running).toBe(RenderExceptionKey.Interrupted);
		expect([
			existsSync(join(dir, 'figure-s11.rendering.png')),
			readFileSync(join(dir, 'figure-s11.png'), 'utf8'),
		]).toEqual([false, 'an earlier image']);
	});

	it('never takes an unfinished image of an earlier killed run as the result', async () => {
		const { renderer, dir } = adapter([{ pressure: 1, swapMb: 100 }], '0.2', 0, model('#!/bin/sh\nexit 0\n'));
		writeFileSync(join(dir, 'figure-s11.rendering.png'), 'left by a killed run');
		expect(await failureKey(renderer.render(job))).toBe(RenderExceptionKey.Failed);
		expect(readFileSync(join(dir, 'renders.tsv'), 'utf8')).toContain('FAILED: no image');
	});

	it('stops the run as an abort when the memory cannot be read while mflux runs', async () => {
		let reads = 0;
		const { renderer, dir } = adapter([], '2', 0, () => ({
			readMemory: (): { pressure: number; swapMb: number } => {
				reads += 1;
				if (reads > 1) throw new TypeError('sysctl is gone');
				return { pressure: 1, swapMb: 100 };
			},
		}));
		expect(await failureKey(renderer.render(job))).toBe(RenderExceptionKey.Aborted);
		expect(readFileSync(join(dir, 'renders.tsv'), 'utf8')).toContain('ABORT: the memory cannot be read');
	});

	it('leaves no interrupt listener behind after a run', async () => {
		const { renderer, interrupts } = adapter([{ pressure: 1, swapMb: 100 }]);
		await renderer.render(job);
		expect(['SIGINT', 'SIGTERM', 'SIGHUP'].map((signal) => interrupts.listenerCount(signal))).toEqual([0, 0, 0]);
	});

	it('logs a finished run whose image cannot be moved into place as a storage failure', async () => {
		const { renderer, dir } = adapter([{ pressure: 1, swapMb: 100 }]);
		mkdirSync(join(dir, 'figure-s11.png'));
		expect(await failureKey(renderer.render(job))).toBe(RenderExceptionKey.StorageFailed);
		expect(readFileSync(join(dir, 'renders.tsv'), 'utf8')).toContain('STORAGE: move the image into place');
	});
});
