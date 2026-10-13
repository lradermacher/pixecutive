import { describe, expect, it } from 'vitest';
import { HeadPartsService } from './headParts.service.ts';

const head = { columns: 3, rows: 3, width: 1024, height: 1024, box: { left: 120, top: 60, right: 400, bottom: 340 } };
const tall = { columns: 3, rows: 2, width: 1024, height: 1024, box: { left: 110, top: 60, right: 390, bottom: 480 } };

describe('HeadPartsService', () => {
	const service = new HeadPartsService();

	it('splits a grid image evenly, rounded, so a 1024 image of three cells starts them at 0, 341 and 683', () => {
		expect([0, 1, 2, 4, 8].map((i) => service.cell(head, i))).toEqual([
			{ left: 0, top: 0, right: 341, bottom: 341 },
			{ left: 341, top: 0, right: 683, bottom: 341 },
			{ left: 683, top: 0, right: 1024, bottom: 341 },
			{ left: 341, top: 341, right: 683, bottom: 683 },
			{ left: 683, top: 683, right: 1024, bottom: 1024 },
		]);
	});

	it('gives a tall grid cells of half the height', () => {
		expect([service.cell(tall, 3), service.cells(tall)]).toEqual([{ left: 0, top: 512, right: 341, bottom: 1024 }, 6]);
	});

	it('lifts a hat by the hair above the skull, never below the skull and never more than the most', () => {
		expect([service.lift(107, 95, 30), service.lift(107, 115, 30), service.lift(107, 60, 30)]).toEqual([12, 0, 30]);
	});
});
