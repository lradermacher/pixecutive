import { describe, expect, it } from 'vitest';
import { drawFigure, type SpriteCanvas } from './drawFigure.ts';
import { fixtureManifest } from './fixtureManifest.ts';

/** Records every call as text; images are their file names. */
class RecordingCanvas implements SpriteCanvas<string> {
	readonly calls: string[] = [];
	private smoothing = false;

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
});
