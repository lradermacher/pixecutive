import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { FigureException, FigureExceptionKey, HeadPartKind, headCutConfigSchema } from '@pixecutive/core';
import { describe, expect, it } from 'vitest';
import { runPythonStep } from '../Python/pythonStep.ts';
import { PartCutterOpencvAdapter } from './partCutter-opencv.adapter.ts';

const python = { uv: 'uv', project: resolve(import.meta.dirname, '../../..') };
const cutter = new PartCutterOpencvAdapter({ python, script: resolve(import.meta.dirname, 'parts.py') });
const values = headCutConfigSchema.parse({});
/** A real Python start loads OpenCV; under a full parallel test run that takes longer than 5 s. */
const PYTHON_START_MS = 30_000;

/**
 * A bald head on the light blue background, its skin flat key green, two dark eyes as its features, and three
 * drawings of the image model on it: brown hair over the skull, a red cap over the skull, dark frames around the
 * eyes. Drawn by Python into a temp folder, so no image enters the repo; `measure` answers per layer the pixels with
 * opacity inside and outside the shape that was drawn.
 */
async function scene(): Promise<Record<string, string>> {
	const dir = mkdtempSync(join(tmpdir(), 'parts-'));
	const maker = join(dir, 'make.py');
	writeFileSync(
		maker,
		[
			'import sys, cv2, numpy as np',
			'from PIL import Image',
			'd = sys.argv[1]',
			'bg = (186, 212, 226)',
			'def head(skin):',
			'    s = np.full((200, 200, 3), bg, np.uint8)',
			'    cv2.circle(s, (100, 100), 40, skin, -1); cv2.circle(s, (100, 100), 40, (30, 20, 20), 2)',
			'    cv2.rectangle(s, (40, 140), (160, 199), (30, 20, 20), 2)',
			'    for x in (85, 115): cv2.rectangle(s, (x - 4, 96), (x + 4, 102), (20, 20, 20), -1)',
			'    return s',
			'green = head((0, 255, 0)); Image.fromarray(green).save(f"{d}/green.png")',
			'Image.fromarray(head((230, 170, 130))).save(f"{d}/open.png")',
			'm = np.zeros((200, 200), np.uint8)',
			'for x in (85, 115): m[96:103, x - 4:x + 5] = 255',
			'Image.fromarray(m).save(f"{d}/mask.png")',
			'hair = green.copy(); cv2.ellipse(hair, (100, 72), (44, 22), 0, 180, 360, (90, 55, 30), -1)',
			'cv2.ellipse(hair, (100, 72), (44, 22), 0, 180, 360, (25, 15, 10), 2); Image.fromarray(hair).save(f"{d}/hair.png")',
			'cap = green.copy(); cv2.ellipse(cap, (100, 68), (44, 26), 0, 180, 360, (180, 30, 30), -1)',
			'cv2.ellipse(cap, (100, 68), (44, 26), 0, 180, 360, (25, 15, 10), 2); Image.fromarray(cap).save(f"{d}/cap.png")',
			'glasses = green.copy()',
			'for x in (85, 115): cv2.rectangle(glasses, (x - 10, 92), (x + 10, 106), (20, 20, 20), 2)',
			'cv2.line(glasses, (95, 96), (105, 96), (20, 20, 20), 2); Image.fromarray(glasses).save(f"{d}/glasses.png")',
		].join('\n'),
	);
	await runPythonStep(python, maker, [dir]);
	const at = (name: string): string => join(dir, name);
	return {
		dir,
		green: at('green.png'),
		open: at('open.png'),
		mask: at('mask.png'),
		hair: at('hair.png'),
		cap: at('cap.png'),
		glasses: at('glasses.png'),
	};
}

/** Per layer the pixels with some opacity inside the box (left, top, right, bottom) and outside it. */
async function opacity(layer: string, box: readonly number[]): Promise<{ inside: number; outside: number }> {
	const dir = mkdtempSync(join(tmpdir(), 'measure-'));
	const script = join(dir, 'measure.py');
	writeFileSync(
		script,
		[
			'import sys, json, numpy as np',
			'from PIL import Image',
			'a = np.asarray(Image.open(sys.argv[1]).convert("RGBA"))[..., 3] > 0',
			'l, t, r, b = json.loads(sys.argv[2]); box = np.zeros(a.shape, bool); box[t:b, l:r] = True',
			'print(json.dumps({"inside": int((a & box).sum()), "outside": int((a & ~box).sum())}))',
		].join('\n'),
	);
	const out = await runPythonStep(python, script, [layer, JSON.stringify(box)]);
	return JSON.parse(out.stdout) as { inside: number; outside: number };
}

const failureKey = (running: Promise<unknown>): Promise<unknown> =>
	running.then(
		() => 'resolved',
		(failure: unknown) => (failure instanceof FigureException ? failure.key : failure),
	);

describe('PartCutterOpencvAdapter', () => {
	it(
		'puts the still box into every grid cell and splits a drawn grid back into stills of the base',
		async () => {
			const s = await scene();
			const layout = {
				columns: 2,
				rows: 1,
				width: 256,
				height: 128,
				box: { left: 50, top: 50, right: 150, bottom: 150 },
			};
			const cells = [
				{ left: 0, top: 0, right: 128, bottom: 128 },
				{ left: 128, top: 0, right: 256, bottom: 128 },
			];
			const grid = join(s.dir ?? '', 'grid.png');
			const outs = [join(s.dir ?? '', 'one.png'), join(s.dir ?? '', 'two.png')];
			await cutter.grid({ still: s.green ?? '', layout, cells, out: grid });
			await cutter.split({ grid, layout, cells, base: s.green ?? '', outs });
			expect(outs.map((path) => existsSync(path))).toEqual([true, true]);
		},
		PYTHON_START_MS,
	);

	it(
		'keys hair out of its drawing over the skull, none of the green skin or the background',
		async () => {
			const s = await scene();
			const out = join(s.dir ?? '', 'hair-1.png');
			const result = await cutter.keyCut({
				kind: HeadPartKind.Hair,
				values: values.key,
				green: s.green ?? '',
				mask: s.mask ?? '',
				drawing: s.hair ?? '',
				out,
			});
			const seen = await opacity(out, [54, 48, 146, 74]);
			expect([result.pixels > 1000, seen.inside > 1000, seen.outside < 60]).toEqual([true, true, true]);
		},
		PYTHON_START_MS,
	);

	it(
		'cuts a cap and writes its hide',
		async () => {
			const s = await scene();
			const out = join(s.dir ?? '', 'hat-1.png');
			const hide = join(s.dir ?? '', 'hat-1-hide.png');
			const result = await cutter.hatCut({
				values: values.hat,
				greenOpen: s.green ?? '',
				green: s.green ?? '',
				mask: s.mask ?? '',
				drawing: s.cap ?? '',
				out,
				hide,
			});
			const seen = await opacity(out, [54, 40, 146, 70]);
			expect([result.pixels > 1000, seen.inside > 1000, seen.outside < 60, existsSync(hide)]).toEqual([
				true,
				true,
				true,
				true,
			]);
		},
		PYTHON_START_MS,
	);

	it(
		'cuts glasses around the eyes and nothing elsewhere',
		async () => {
			const s = await scene();
			const out = join(s.dir ?? '', 'glasses-1.png');
			await cutter.glassesCut({ values: values.glasses, green: s.green ?? '', drawing: s.glasses ?? '', out });
			const seen = await opacity(out, [72, 88, 128, 110]);
			expect([seen.inside > 100, seen.outside]).toEqual([true, 0]);
		},
		PYTHON_START_MS,
	);

	it(
		'measures the skull top on the open still and the first row of a layer',
		async () => {
			const s = await scene();
			const out = join(s.dir ?? '', 'hair-1.png');
			await cutter.keyCut({
				kind: HeadPartKind.Hair,
				values: values.key,
				green: s.green ?? '',
				mask: s.mask ?? '',
				drawing: s.hair ?? '',
				out,
			});
			const [skull, first] = await Promise.all([cutter.skullTop(s.open ?? '', 60), cutter.firstRow(out)]);
			expect([skull >= 58 && skull <= 61, first !== null && first >= 48 && first <= 52]).toEqual([true, true]);
		},
		PYTHON_START_MS,
	);

	it(
		'answers the cut-failed key when the drawing is missing',
		async () => {
			const s = await scene();
			const missing = cutter.glassesCut({
				values: values.glasses,
				green: s.green ?? '',
				drawing: join(s.dir ?? '', 'none.png'),
				out: join(s.dir ?? '', 'x.png'),
			});
			expect(await failureKey(missing)).toBe(FigureExceptionKey.CutFailed);
		},
		PYTHON_START_MS,
	);
});
