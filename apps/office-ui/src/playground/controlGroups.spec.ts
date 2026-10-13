import { HeadPartKind } from '@pixecutive/protocol';
import { describe, expect, it } from 'vitest';
import { controlGroups } from './controlGroups.ts';
import { Facing } from './facing.enum.ts';
import { fixtureManifest } from './fixtureManifest.ts';
import { Playback } from './playback.enum.ts';
import { Playground } from './playground.ts';

/** The fixture with hair 1 and 2 and brows 3 on every motion of M, the lift of hair 1, and a hat open on top. */
function dressed(): typeof fixtureManifest {
	const box = { x: 0, y: 0, width: 10, height: 5 };
	const m = fixtureManifest.figures['m'];
	const motions = Object.fromEntries(
		Object.entries(m?.motions ?? {}).map(([name, motion]) => [
			name,
			{
				...motion,
				parts: {
					[HeadPartKind.Hair]: {
						'1': { file: 'm/head/hair-1.png', ...box },
						'2': { file: 'm/head/hair-2.png', ...box },
					},
					[HeadPartKind.Brows]: { '3': { file: 'm/head/brows-3.png', ...box } },
				},
			},
		]),
	);
	return {
		...fixtureManifest,
		figures: { ...fixtureManifest.figures, m: { head: { lift: { '1': 12 }, openTop: [12] }, motions } },
	};
}

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
	it('offers all and every motion of the manifest, both facings, the mouth, both playbacks, the zooms and the clock', () => {
		expect(controlGroups(new Playground(fixtureManifest)).map((g) => [g.title, g.options.map((o) => o.text)])).toEqual([
			['Motion', ['all', 'idle', 'walk']],
			['Facing', ['front-left', 'front-right (mirrored)']],
			['Mouth', ['closed', 'speaking']],
			['On the spot', ['loop', 'back and forth']],
			['Zoom', ['1×', '2×', '4×']],
			['Clock', ['play', 'step']],
		]);
	});

	it('marks the playground start as chosen: all, front-left, closed, back and forth, 2×, play', () => {
		const chosen = controlGroups(new Playground(fixtureManifest)).map(
			(g) => g.options.filter((o) => o.chosen()).map((o) => o.text)[0],
		);
		expect(chosen).toEqual(['all', 'front-left', 'closed', 'back and forth', '2×', 'play']);
	});

	it('sets the playground when an option is chosen', () => {
		const playground = new Playground(fixtureManifest);
		for (const [title, text] of [
			['Motion', 'walk'],
			['Facing', 'front-right (mirrored)'],
			['Mouth', 'speaking'],
			['On the spot', 'loop'],
			['Zoom', '4×'],
		] as const)
			option(playground, title, text).choose();
		expect([playground.motion, playground.facing, playground.speaking, playground.playback, playground.zoom]).toEqual([
			'walk',
			Facing.FrontRight,
			true,
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

	it('offers a row per figure and kind it has, with none first, and wearing a variant chooses it', () => {
		const playground = new Playground(dressed());
		const rows = controlGroups(playground).filter((group) => group.title.startsWith('M '));
		const hair = rows.find((group) => group.title === 'M hair');
		hair?.options[2]?.choose();
		expect([
			rows.map((group) => group.title),
			hair?.options.map((o) => o.text),
			playground.looks['m'],
			hair?.options.map((o) => o.chosen()),
		]).toEqual([['M hair', 'M brows'], ['none', '1', '2'], { [HeadPartKind.Hair]: 2 }, [false, false, true]]);
	});
});
