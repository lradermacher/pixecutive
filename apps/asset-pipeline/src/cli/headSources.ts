// headSources.ts — the files a head-part cut reads, by the role they play: the figure's head stills, and the blank
// head, its mask and the default face parts from the figure's face spec.
import { join } from 'node:path';
import {
	FigureException,
	FigureExceptionKey,
	type FiguresSpec,
	type FigureName,
	HeadPartKind,
	type HeadSources,
} from '@pixecutive/core';
import type { HeadSpec } from './figureHead.ts';

/** The default face parts a variant is cut against. */
const defaults = [HeadPartKind.Brows, HeadPartKind.Eyes, HeadPartKind.Nose, HeadPartKind.Mouth] as const;

/**
 * The cut's sources of `figure`, under the figure sources folder `sources`.
 * @throws {FigureException} the invalid configuration key when the face spec lacks the blank head's mask.
 */
export function headSources(sources: string, figures: FiguresSpec, figure: FigureName, head: HeadSpec): HeadSources {
	const face = figures[figure]?.face ?? {};
	const mask = face.blank?.mask;
	if (face.blank === undefined || mask === undefined) {
		throw new FigureException(
			FigureExceptionKey.InvalidConfig,
			`the face spec of ${figure} has no blank head with its mask`,
		);
	}
	const at = (file: string): string => join(sources, file);
	return {
		open: at(head.open),
		green: at(head.green),
		greenAccessory: at(head.greenAccessory),
		greenOpen: at(head.greenOpen),
		blank: at(face.blank.image),
		mask: at(mask),
		defaults: Object.fromEntries(
			defaults.flatMap((part) => {
				const image = face[part]?.image;
				return image === undefined ? [] : [[part, at(image)]];
			}),
		),
	};
}
