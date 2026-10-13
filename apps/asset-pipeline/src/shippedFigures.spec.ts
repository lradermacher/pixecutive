import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { figureManifestSchema } from '@pixecutive/protocol';
import { describe, expect, it } from 'vitest';

/** The office's asset folder of the figures, as `pnpm assets export` fills it. */
const root = resolve(import.meta.dirname, '../../office-ui/assets/figures');
/** The office's limit for one asset file (ops rule): 256 KB. */
const fileLimitBytes = 256 * 1024;

const manifest = figureManifestSchema.parse(JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8')));
const named = Object.values(manifest.figures).flatMap((figure) =>
	Object.values(figure.motions).flatMap((motion) => [
		...motion.frames.map((frame) => frame.file),
		...Object.values(motion.face).map((part) => part.file),
		...Object.values(motion.parts ?? {}).flatMap((variants) =>
			Object.values(variants).flatMap((part) => [part.file, ...(part.hide ? [part.hide.file] : [])]),
		),
	]),
);
const shipped = readdirSync(root, { recursive: true, withFileTypes: true })
	.filter((entry) => entry.isFile() && entry.name.endsWith('.png'))
	.map((entry) => relative(root, join(entry.parentPath, entry.name)));

describe('the shipped figures', () => {
	it('carry a manifest the protocol accepts, with both base figures walking and idling at least', () => {
		expect(Object.keys(manifest.figures).sort()).toEqual(['f', 'm']);
		for (const figure of Object.values(manifest.figures))
			expect(Object.keys(figure.motions)).toEqual(expect.arrayContaining(['idle', 'walk']));
	});

	it('name only files that are there, and every image there is named', () => {
		expect(named.filter((file) => !existsSync(join(root, file)))).toEqual([]);
		expect(shipped.filter((file) => !named.includes(file))).toEqual([]);
	});

	it('carry the same head parts on every motion of a figure, and a lift for each of its hairstyles', () => {
		for (const figure of Object.values(manifest.figures)) {
			const kinds = Object.values(figure.motions).map((motion) =>
				Object.entries(motion.parts ?? {})
					.map(([kind, variants]) => `${kind} ${Object.keys(variants).join(',')}`)
					.sort(),
			);
			const hair = Object.keys(figure.motions['idle']?.parts?.hair ?? {});
			expect([
				new Set(kinds.map((k) => k.join('|'))).size,
				hair.length > 0,
				Object.keys(figure.head?.lift ?? {}),
			]).toEqual([1, true, hair]);
		}
	});

	it('keep every file within the office limit, the manifest too', () => {
		expect([...shipped, 'manifest.json'].filter((file) => statSync(join(root, file)).size > fileLimitBytes)).toEqual(
			[],
		);
	});
});
