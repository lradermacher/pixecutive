import { describe, expect, it } from 'vitest';
import { FacePart } from '@pixecutive/protocol';
import { fixtureManifest } from './fixtureManifest.ts';
import { Playback } from './playback.enum.ts';
import { Playground } from './playground.ts';

const tickMs = 1000 / 24;

describe('Playground', () => {
	it('shows every motion of every figure when no motion is chosen, and one motion when it is', () => {
		const playground = new Playground(fixtureManifest);
		const all = playground.tiles().map((tile) => [tile.figure, tile.name]);
		playground.motion = 'walk';
		expect([all, playground.tiles().map((tile) => tile.name)]).toEqual([
			[
				['m', 'idle'],
				['m', 'walk'],
			],
			['walk'],
		]);
	});

	it('counts 24 ticks per second of real time and stands still while paused', () => {
		const playground = new Playground(fixtureManifest);
		playground.advance(1000);
		const afterSecond = playground.tick;
		playground.paused = true;
		playground.advance(1000);
		expect([afterSecond, playground.tick]).toEqual([24, 24]);
	});

	it('plays a motion on the spot back and forth by default and a walk always round', () => {
		const playground = new Playground(fixtureManifest);
		playground.advance(3 * tickMs + 1);
		const back = playground.tiles().map((tile) => tile.frame);
		playground.playback = Playback.Loop;
		expect([back, playground.tiles().map((tile) => tile.frame)]).toEqual([
			[1, 1],
			[0, 1],
		]);
	});

	it('labels each tile with figure, motion, facing, frame and hold', () => {
		const playground = new Playground(fixtureManifest);
		playground.motion = 'walk';
		expect(playground.tiles()[0]?.label).toBe('M · walk · front-left · frame 0 / 2 · hold 2');
	});

	it('steps to the next tick at which a shown tile changes its frame, and pauses', () => {
		const playground = new Playground(fixtureManifest);
		playground.motion = 'walk';
		playground.step();
		const first = [playground.tick, playground.tiles()[0]?.frame];
		playground.step();
		expect([playground.paused, first, [playground.tick, playground.tiles()[0]?.frame]]).toEqual([true, [2, 1], [5, 0]]);
	});

	it('goes on from the stepped tick when played again', () => {
		const playground = new Playground(fixtureManifest);
		playground.step();
		playground.paused = false;
		playground.advance(tickMs);
		expect(playground.tick).toBe(2);
	});

	it('closes every mouth until the figures speak, then follows the speaking rhythm on every motion', () => {
		const playground = new Playground(fixtureManifest);
		playground.advance(tickMs + 1);
		const closed = playground.tiles().map((tile) => tile.mouth);
		playground.speaking = true;
		expect([closed, playground.tiles().map((tile) => tile.mouth)]).toEqual([
			[FacePart.Mouth, FacePart.Mouth],
			[FacePart.MouthOpen, FacePart.MouthOpen],
		]);
	});

	it('steps to the next mouth change while speaking, even when no frame changes', () => {
		const playground = new Playground(fixtureManifest);
		playground.motion = 'walk';
		playground.speaking = true;
		playground.step();
		expect([playground.tick, playground.tiles()[0]?.mouth, playground.tiles()[0]?.frame]).toEqual([
			1,
			FacePart.MouthOpen,
			0,
		]);
	});
});
