import { describe, expect, it } from 'vitest';
import type { HandPaintJob } from '../../domain/Figure/handPaintJob.interface.ts';
import type { IHandPainter } from '../../port/outgoing/handPainter.interface.ts';
import { PaintHandsService } from './paintHands.service.ts';

/** Keeps every job it was handed. */
class InMemoryHandPainter implements IHandPainter {
	readonly jobs: HandPaintJob[] = [];
	paint(job: HandPaintJob): Promise<void> {
		this.jobs.push(job);
		return Promise.resolve();
	}
}

const box = { left: 420, top: 360, right: 600, bottom: 460 };

describe('PaintHandsService', () => {
	it('frames every state by the sprite own hands, the states in turn, each for its ticks', () => {
		const service = new PaintHandsService(new InMemoryHandPainter());
		expect(service.sequence(10, 2, 1)).toEqual([null, 0, null, 1, null, 0, null, 1, null, 0]);
		expect(service.sequence(8, 2, 2)).toEqual([null, null, 0, 0, null, null, 1, 1]);
	});

	it('hands the painter the sprites, the still, the box, the states and the sequence', async () => {
		const painter = new InMemoryHandPainter();
		const sequence = await new PaintHandsService(painter).paint({
			frames: ['00.png', '01.png', '02.png'],
			scale: 0.35,
			still: 'm/type-start.png',
			hands: { box, states: ['m/a.png'], ticks: 1 },
		});
		expect([sequence, painter.jobs]).toEqual([
			[null, 0, null],
			[
				{
					frames: ['00.png', '01.png', '02.png'],
					still: 'm/type-start.png',
					scale: 0.35,
					box,
					states: ['m/a.png'],
					sequence: [null, 0, null],
				},
			],
		]);
	});
});
