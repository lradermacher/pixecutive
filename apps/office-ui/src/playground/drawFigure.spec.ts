import { FacePart, HeadPartKind } from '@pixecutive/protocol';
import { describe, expect, it } from 'vitest';
import { drawFigure, type SpriteCanvas } from './drawFigure.ts';
import { fixtureManifest } from './fixtureManifest.ts';

/** Records every call as text; images are their file names. */
class RecordingCanvas implements SpriteCanvas<string> {
	readonly calls: string[] = [];
	private smoothing = false;
	private composite = 'source-over';

	get globalCompositeOperation(): string {
		return this.composite;
	}

	set globalCompositeOperation(mode: string) {
		if (mode !== this.composite) this.calls.push(`composite ${mode}`);
		this.composite = mode;
	}

	get imageSmoothingEnabled(): boolean {
		return this.smoothing;
	}

	set imageSmoothingEnabled(on: boolean) {
		this.smoothing = on;
		this.calls.push(`smoothing ${String(on)}`);
	}

	setTransform(...values: number[]): void {
		this.calls.push(`transform ${values.join(' ')}`);
	}

	clearRect(...box: number[]): void {
		this.calls.push(`clear ${box.join(' ')}`);
	}

	drawImage(image: string, ...box: number[]): void {
		this.calls.push(`${image} ${box.join(' ')}`);
	}
}

const idle = fixtureManifest.figures['m']?.motions['idle'];

describe('drawFigure', () => {
	it('draws the body frame at sprite size, then the face parts on its head origin, smoothly', () => {
		const canvas = new RecordingCanvas();
		if (idle) drawFigure(canvas, (file) => file, 'idle', idle, 2);
		expect(canvas.calls).toEqual([
			'transform 1 0 0 1 0 0',
			'clear 0 0 89 201',
			'smoothing true',
			'm/body/idle/02.png 0 0 89 201',
			'm/face/idle/blank.png 35 24 10 8',
			'm/face/idle/eyes.png 41 24 10 8',
			'm/face/idle/mouth.png 50 24 10 8',
		]);
	});

	it('leaves out an image that is not loaded yet', () => {
		const canvas = new RecordingCanvas();
		if (idle) drawFigure(canvas, (file) => (file.includes('/face/') ? undefined : file), 'idle', idle, 0);
		expect(canvas.calls.filter((call) => call.startsWith('m/'))).toEqual(['m/body/idle/00.png 0 0 89 201']);
	});

	it('hands the fractional boxes of the manifest to the canvas unrounded, for it to scale smoothly', () => {
		const canvas = new RecordingCanvas();
		const mouth = { file: 'm/face/idle/mouth.png', x: 97.5, y: 87.75, width: 17.25, height: 8.5 };
		if (idle)
			drawFigure(
				canvas,
				(file) => file,
				'idle',
				{ ...idle, head: { ...idle.head, origin: [[-48.25, -36.5]] }, face: { mouth } },
				0,
			);
		expect(canvas.calls.at(-1)).toBe('m/face/idle/mouth.png 49.25 51.25 17.25 8.5');
	});

	it('draws the mouth in the state asked for', () => {
		const canvas = new RecordingCanvas();
		if (idle) drawFigure(canvas, (file) => file, 'idle', idle, 0, FacePart.MouthHalf);
		expect(canvas.calls.at(-1)).toBe('m/face/idle/mouth-half.png 49 24 10 9');
	});

	it('draws the head parts of the look after the face, cutting the hat hide out of the figure', () => {
		const canvas = new RecordingCanvas();
		const box = { x: 0, y: 0, width: 10, height: 5 };
		const parts = {
			[HeadPartKind.Hair]: { '1': { file: 'm/head/idle/hair-1.png', ...box } },
			[HeadPartKind.Hat]: {
				'4': { file: 'm/head/idle/hat-4.png', ...box, hide: { file: 'm/head/idle/hat-4-hide.png', ...box } },
			},
		};
		const look = { [HeadPartKind.Hair]: 1, [HeadPartKind.Hat]: 4 };
		if (idle)
			drawFigure(canvas, (file) => file, 'walk', { ...idle, parts }, 0, FacePart.Mouth, look, {
				lift: {},
				openTop: [],
			});
		expect(canvas.calls.slice(-5)).toEqual([
			'composite destination-out',
			'm/head/idle/hat-4-hide.png -48 -36 10 5',
			'composite source-over',
			'm/head/idle/hair-1.png -48 -36 10 5',
			'm/head/idle/hat-4.png -48 -36 10 5',
		]);
	});
});
