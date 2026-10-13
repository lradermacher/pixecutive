import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type CutFrames, FigureException, FigureExceptionKey, FigureName, Motion } from '@pixecutive/core';
import { describe, expect, it } from 'vitest';
import { MotionWorkFilesAdapter } from './motionWork-files.adapter.ts';

const cut: CutFrames = {
	plan: {
		sprites: [{ source: 13, hold: 2, shiftX: 0, shiftY: 1 }],
		margin: { top: 2, bottom: 0, left: 2, right: 2 },
		height: 200,
		driftPerVideoFrame: 7.25,
	},
	result: { frames: ['/r/clips/m-walk/00.png'], scale: 0.3345, width: 94, height: 201 },
};
const track = { scale: 0.345, origin: [[-46.8, -33.3]] as [number, number][], earOffset: [0.5] };

async function failure(run: Promise<unknown>): Promise<[FigureExceptionKey, string] | null> {
	const error: unknown = await run.then(
		() => null,
		(caught: unknown) => caught,
	);
	return error instanceof FigureException ? [error.key, error.detail] : null;
}

describe('MotionWorkFilesAdapter', () => {
	it('gives back the cut and the track it kept', async () => {
		const work = new MotionWorkFilesAdapter(mkdtempSync(join(tmpdir(), 'work-')));
		await work.saveCut(FigureName.M, Motion.Walk, cut);
		await work.saveTrack(FigureName.M, Motion.Walk, track);
		expect([await work.loadCut(FigureName.M, Motion.Walk), await work.loadTrack(FigureName.M, Motion.Walk)]).toEqual([
			cut,
			track,
		]);
	});

	it('drops the head track when a new cut is kept, so an export cannot pair them', async () => {
		const work = new MotionWorkFilesAdapter(mkdtempSync(join(tmpdir(), 'work-')));
		await work.saveCut(FigureName.M, Motion.Idle, cut);
		await work.saveTrack(FigureName.M, Motion.Idle, track);
		await work.saveCut(FigureName.M, Motion.Idle, cut);
		expect(await failure(work.loadTrack(FigureName.M, Motion.Idle))).toEqual([
			FigureExceptionKey.InvalidJob,
			'no track of m idle: run `pnpm assets track m idle` first',
		]);
	});

	it('names the command to run first when its step is missing', async () => {
		const work = new MotionWorkFilesAdapter(mkdtempSync(join(tmpdir(), 'work-')));
		expect(await failure(work.loadCut(FigureName.F, Motion.Idle))).toEqual([
			FigureExceptionKey.InvalidJob,
			'no cut of f idle: run `pnpm assets frames f idle` first',
		]);
	});

	it('refuses a file that holds no track', async () => {
		const dir = mkdtempSync(join(tmpdir(), 'work-'));
		mkdirSync(join(dir, 'm-idle'));
		writeFileSync(join(dir, 'm-idle', 'track.json'), '{"scale": 0}');
		expect((await failure(new MotionWorkFilesAdapter(dir).loadTrack(FigureName.M, Motion.Idle)))?.[0]).toBe(
			FigureExceptionKey.StorageFailed,
		);
	});

	it('names a work folder it cannot write with the storage key', async () => {
		const blocked = join(mkdtempSync(join(tmpdir(), 'work-')), 'file');
		writeFileSync(blocked, 'not a folder');
		const result = await failure(new MotionWorkFilesAdapter(blocked).saveCut(FigureName.M, Motion.Idle, cut));
		expect(result?.[0]).toBe(FigureExceptionKey.StorageFailed);
	});
});
