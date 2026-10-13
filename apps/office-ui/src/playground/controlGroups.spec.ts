import { describe, expect, it } from 'vitest';
import { controlGroups } from './controlGroups.ts';
import { Facing } from './facing.enum.ts';
import { fixtureManifest } from './fixtureManifest.ts';
import { Playback } from './playback.enum.ts';
import { Playground } from './playground.ts';

/** The option of `title` named `text`. */
function option(
	playground: Playground,
	title: string,
	text: string,
): ReturnType<typeof controlGroups>[number]['options'][number] {
	const found = controlGroups(playground)
		.find((group) => group.title === title)
		?.options.find((o) => o.text === text);
	if (!found) throw new TypeError(`no option ${text} in ${title}`);
	return found;
}

describe('controlGroups', () => {
	it('offers all and every motion of the manifest, both facings, both playbacks, the zooms and the clock', () => {
		expect(controlGroups(new Playground(fixtureManifest)).map((g) => [g.title, g.options.map((o) => o.text)])).toEqual([
			['Motion', ['all', 'idle', 'walk']],
			['Facing', ['front-left', 'front-right (mirrored)']],
			['On the spot', ['loop', 'back and forth']],
			['Zoom', ['1×', '2×', '4×']],
			['Clock', ['play', 'step']],
		]);
	});

	it('marks the playground start as chosen: all, front-left, back and forth, 2×, play', () => {
		const chosen = controlGroups(new Playground(fixtureManifest)).map(
			(g) => g.options.filter((o) => o.chosen()).map((o) => o.text)[0],
		);
		expect(chosen).toEqual(['all', 'front-left', 'back and forth', '2×', 'play']);
	});

	it('sets the playground when an option is chosen', () => {
		const playground = new Playground(fixtureManifest);
		for (const [title, text] of [
			['Motion', 'walk'],
			['Facing', 'front-right (mirrored)'],
			['On the spot', 'loop'],
			['Zoom', '4×'],
		] as const)
			option(playground, title, text).choose();
		expect([playground.motion, playground.facing, playground.playback, playground.zoom]).toEqual([
			'walk',
			Facing.FrontRight,
			Playback.Loop,
			4,
		]);
	});

	it('steps and plays the clock', () => {
		const playground = new Playground(fixtureManifest);
		option(playground, 'Clock', 'step').choose();
		const stepped = [playground.paused, playground.tick];
		option(playground, 'Clock', 'play').choose();
		expect([stepped, playground.paused]).toEqual([[true, 1], false]);
	});
});
