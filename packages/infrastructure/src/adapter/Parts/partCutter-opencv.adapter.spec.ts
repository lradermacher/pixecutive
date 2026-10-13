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

/** The files of the synthetic scene. */
interface Scene {
	readonly dir: string;
	readonly green: string;
	readonly open: string;
	readonly mask: string;
	readonly hair: string;
	readonly cap: string;
	readonly glasses: string;
	readonly empty: string;
	readonly blank: string;
	readonly eyes: string;
	readonly brows: string;
	readonly nose: string;
	readonly mouth: string;
	readonly browsDrawn: string;
	readonly beard: string;
	readonly hairExtra: string;
}

/**
 * A bald head on the light blue background, its skin flat key green, two dark eyes as its features, and three
 * drawings of the image model on it: brown hair over the skull, a red cap over the skull, dark frames around the
 * eyes. Drawn by Python into a temp folder, so no image enters the repo; `measure` answers per layer the pixels with
 * opacity inside and outside the shape that was drawn.
 */
async function scene(): Promise<Scene> {
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
			'Image.fromarray(np.zeros((200, 200, 4), np.uint8)).save(f"{d}/empty.png")',
			'blank = head((230, 170, 130)); Image.fromarray(blank).save(f"{d}/blank.png")',
			'def part(box, name):',
			'    a = np.zeros((200, 200, 4), np.uint8); l, t, r, b = box; a[t:b, l:r] = (20, 20, 20, 255)',
			'    Image.fromarray(a).save(f"{d}/{name}.png")',
			'part((80, 96, 90, 103), "eyes"); part((80, 88, 90, 91), "brows"); part((98, 106, 102, 114), "nose"); part((92, 122, 108, 125), "mouth")',
			'thick = head((230, 170, 130)); thick[86:92, 78:92] = (20, 20, 20); thick[106:115, 96:105] = (20, 20, 20)',
			'Image.fromarray(thick).save(f"{d}/brows-drawn.png")',
			'beard = green.copy(); cv2.ellipse(beard, (100, 128), (30, 12), 0, 0, 180, (70, 45, 25), -1)',
			'beard[98:103, 80:90] = (70, 45, 25); beard[106:114, 98:102] = (70, 45, 25); beard[70:120, 120:125] = (70, 45, 25)',
			'Image.fromarray(beard).save(f"{d}/beard.png")',
			'extra = hair.copy(); cv2.rectangle(extra, (160, 55), (172, 70), (90, 55, 30), -1)',
			'cv2.rectangle(extra, (160, 55), (172, 70), (25, 15, 10), 1); Image.fromarray(extra).save(f"{d}/hair-extra.png")',
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
		empty: at('empty.png'),
		blank: at('blank.png'),
		eyes: at('eyes.png'),
		brows: at('brows.png'),
		nose: at('nose.png'),
		mouth: at('mouth.png'),
		browsDrawn: at('brows-drawn.png'),
		beard: at('beard.png'),
		hairExtra: at('hair-extra.png'),
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

/** The pixels of an image that are flat magenta, and those with any opacity. */
async function pixels(image: string): Promise<{ magenta: number; opaque: number }> {
	const dir = mkdtempSync(join(tmpdir(), 'pixels-'));
	const script = join(dir, 'pixels.py');
	writeFileSync(
		script,
		[
			'import sys, json, numpy as np',
			'from PIL import Image',
			'a = np.asarray(Image.open(sys.argv[1]).convert("RGBA")).astype(int)',
			'magenta = (a[..., 0] > 200) & (a[..., 1] < 80) & (a[..., 2] > 200)',
			'print(json.dumps({"magenta": int(magenta.sum()), "opaque": int((a[..., 3] > 0).sum())}))',
		].join('\n'),
	);
	const out = await runPythonStep(python, script, [image]);
	return JSON.parse(out.stdout) as { magenta: number; opaque: number };
}

const failureKey = (running: Promise<unknown>): Promise<unknown> =>
	running.then(
		() => 'resolved',
		(failure: unknown) => (failure instanceof FigureException ? failure.key : failure),
	);

describe('PartCutterOpencvAdapter cutting', () => {
	it(
		'puts the still box into every grid cell and splits a drawn grid back into stills, in folders it makes',
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
			const grid = join(s.dir, 'new', 'grid.png');
			const outs = [join(s.dir, 'stills', 'one.png'), join(s.dir, 'stills', 'two.png')];
			await cutter.grid({ still: s.green, layout, cells, out: grid });
			await cutter.split({ grid, layout, cells, base: s.green, outs });
			expect(outs.map((path) => existsSync(path))).toEqual([true, true]);
		},
		PYTHON_START_MS,
	);

	it(
		'keys hair out of its drawing over the skull, none of the green skin or the background',
		async () => {
			const s = await scene();
			const out = join(s.dir, 'hair-1.png');
			const result = await cutter.keyCut({
				kind: HeadPartKind.Hair,
				values: values.key,
				green: s.green,
				mask: s.mask,
				drawing: s.hair,
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
			const out = join(s.dir, 'hat-1.png');
			const hide = join(s.dir, 'hat-1-hide.png');
			const result = await cutter.hatCut({
				values: values.hat,
				greenOpen: s.green,
				green: s.green,
				mask: s.mask,
				drawing: s.cap,
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
			const out = join(s.dir, 'glasses-1.png');
			await cutter.glassesCut({ values: values.glasses, green: s.green, drawing: s.glasses, out });
			const seen = await opacity(out, [72, 88, 128, 110]);
			expect([seen.inside > 100, seen.outside]).toEqual([true, 0]);
		},
		PYTHON_START_MS,
	);
});

describe('PartCutterOpencvAdapter measuring and preparing', () => {
	it(
		'measures the skull top on the open still and the first row of each layer, none for an empty one',
		async () => {
			const s = await scene();
			const out = join(s.dir, 'hair-1.png');
			await cutter.keyCut({
				kind: HeadPartKind.Hair,
				values: values.key,
				green: s.green,
				mask: s.mask,
				drawing: s.hair,
				out,
			});
			const [skull, [first, empty]] = await Promise.all([
				cutter.skullTop(s.open, 60),
				cutter.firstRows([out, s.empty]),
			]);
			expect([
				skull >= 58 && skull <= 61,
				first !== null && first !== undefined && first >= 48 && first <= 52,
				empty,
			]).toEqual([true, true, null]);
		},
		PYTHON_START_MS,
	);

	it(
		'answers the cut-failed key when the drawing is missing',
		async () => {
			const s = await scene();
			const missing = cutter.glassesCut({
				values: values.glasses,
				green: s.green,
				drawing: join(s.dir, 'none.png'),
				out: join(s.dir, 'x.png'),
			});
			expect(await failureKey(missing)).toBe(FigureExceptionKey.CutFailed);
		},
		PYTHON_START_MS,
	);

	it(
		'keys a beard out of the lower face only, never over the eyes, brows or nose',
		async () => {
			const s = await scene();
			const out = join(s.dir, 'beard-1.png');
			await cutter.keyCut({
				kind: HeadPartKind.Beard,
				values: values.key,
				green: s.green,
				mask: s.mask,
				drawing: s.beard,
				out,
				features: [s.eyes, s.brows, s.nose],
			});
			// the beard drawn at rows 116 to 140, with its outline and soft ring; the strokes over the eye and the nose go
			const seen = await opacity(out, [66, 112, 136, 146]);
			const [eye, nose] = [await opacity(out, [80, 98, 90, 103]), await opacity(out, [98, 106, 102, 114])];
			// a stroke from the beard up the forehead keeps only its part in the lower face
			const forehead = await opacity(out, [118, 66, 127, 92]);
			expect([seen.inside > 300, eye.inside, nose.inside, forehead.inside]).toEqual([true, 0, 0, 0]);
		},
		PYTHON_START_MS,
	);

	it(
		'cuts hair under a hat only where the hairstyle without the hat lies',
		async () => {
			const s = await scene();
			const hair = join(s.dir, 'hair-1.png');
			const hat = join(s.dir, 'hat-4.png');
			await cutter.keyCut({
				kind: HeadPartKind.Hair,
				values: values.key,
				green: s.green,
				mask: s.mask,
				drawing: s.hair,
				out: hair,
			});
			await cutter.hatCut({
				values: values.hat,
				greenOpen: s.green,
				green: s.green,
				mask: s.mask,
				drawing: s.cap,
				out: hat,
				hide: join(s.dir, 'hide.png'),
			});
			const out = join(s.dir, 'hair-under-hat-1.png');
			await cutter.keyCut({
				kind: HeadPartKind.HairUnderHat,
				values: values.key,
				green: s.green,
				mask: s.mask,
				drawing: s.hairExtra,
				out,
				hairless: hair,
				hat,
				open: s.open,
			});
			// the hairstyle's own area grown by 7 pixels, and the band just below the hat; the strand beside it goes
			const seen = await opacity(out, [48, 42, 154, 86]);
			const strand = await opacity(out, [158, 52, 175, 73]);
			expect([seen.inside > 1000, seen.outside, strand.inside]).toEqual([true, 0, 0]);
		},
		PYTHON_START_MS,
	);
});

describe('PartCutterOpencvAdapter on face variants and fits', () => {
	it(
		'cuts a face variant as the features nearest the wanted default part: the thicker brows, not the new nose',
		async () => {
			const s = await scene();
			const out = join(s.dir, 'brows-1.png');
			const result = await cutter.variantCut({
				part: HeadPartKind.Brows,
				values: values.variant,
				open: s.open,
				blank: s.blank,
				mask: s.mask,
				defaults: { brows: s.brows, eyes: s.eyes, nose: s.nose, mouth: s.mouth },
				drawing: s.browsDrawn,
				out,
			});
			const seen = await opacity(out, [74, 82, 96, 95]);
			expect([result.pixels > 20, seen.inside > 20, seen.outside]).toEqual([true, true, 0]);
		},
		PYTHON_START_MS,
	);

	it(
		'lays the shrunk hat flat magenta on a hairstyle, and fits a layer of another figure by scale and shift',
		async () => {
			const s = await scene();
			const hat = join(s.dir, 'hat-4.png');
			await cutter.hatCut({
				values: values.hat,
				greenOpen: s.green,
				green: s.green,
				mask: s.mask,
				drawing: s.cap,
				out: hat,
				hide: join(s.dir, 'hide.png'),
			});
			const input = join(s.dir, 'input.png');
			const fitted = join(s.dir, 'fitted.png');
			await cutter.underHat({ hair: s.hair, hat, shrink: 5, out: input });
			await cutter.fit({ part: hat, scale: 0.5, dx: 0, dy: 40, out: fitted });
			const moved = await opacity(fitted, [0, 0, 200, 60]);
			const [painted, original, half] = [await pixels(input), await pixels(hat), await pixels(fitted)];
			expect([painted.magenta > 100, moved.inside, half.opaque < original.opaque * 0.4, half.opaque > 0]).toEqual([
				true,
				0,
				true,
				true,
			]);
		},
		PYTHON_START_MS,
	);
});
