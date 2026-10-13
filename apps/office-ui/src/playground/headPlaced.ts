// headPlaced.ts — where the head layers of a figure's look are drawn in one frame, in sprite pixels, back to front:
// beard, the hat's hide, the hair (or the hair drawn under the hat), glasses, hat. A hide cuts the figure instead of
// covering it.
import { type FigureManifest, HeadPartKind } from '@pixecutive/protocol';
import type { PlacedPart } from './facePlaced.ts';
import type { Look } from './look.interface.ts';
import type { ManifestMotion } from './manifestMotion.interface.ts';

/** A placed layer; `cut` takes its pixels out of the figure drawn so far. */
export interface PlacedLayer extends PlacedPart {
	readonly cut?: boolean;
}

/** What holds for a figure's head parts in every motion. */
type FigureHead = NonNullable<FigureManifest['figures'][string]['head']>;

/** The most a hat rises for the hair under it, in still pixels. */
const mostLift = 30;

/** The variant `id` of `kind` in the motion, or nothing when no variant is chosen or the motion lacks it. */
function variant(
	motion: ManifestMotion,
	kind: HeadPartKind,
	id: number | undefined,
): (PlacedPart & { hide?: PlacedPart }) | undefined {
	return id === undefined ? undefined : motion.parts?.[kind]?.[String(id)];
}

/** A hat raised by `lift` sprite pixels and grown with it, its rim rising half as much. */
function raised(hat: PlacedLayer, lift: number): PlacedLayer {
	const grow = (hat.height + 0.5 * lift) / hat.height;
	return {
		...hat,
		x: hat.x - (hat.width * (grow - 1)) / 2,
		y: hat.y - lift,
		width: hat.width * grow,
		height: hat.height * grow,
	};
}

/** How far a hat rises for `hair`, in sprite pixels: the hair's lift, at most the most, at the motion's scale. */
function liftFor(motion: ManifestMotion, head: FigureHead | undefined, hair: number): number {
	const lift = head?.lift[String(hair)] ?? 0;
	return Math.max(0, Math.min(mostLift, lift)) * motion.head.scale;
}

/** The hat of the look: its layer, the hide it cuts, the hairstyle drawn under it, and how far it rises. */
function hatOf(
	motion: ManifestMotion,
	head: FigureHead | undefined,
	look: Look,
): { hat?: PlacedPart; hide?: PlacedPart; pressed?: PlacedPart; lift: number } {
	const hair = look[HeadPartKind.Hair];
	const id = look[HeadPartKind.Hat];
	const hat = variant(motion, HeadPartKind.Hat, id);
	if (hat === undefined || id === undefined) return { lift: 0 };
	const open = (head?.openTop ?? []).includes(id);
	if (hair === undefined) return { hat, ...(hat.hide ? { hide: hat.hide } : {}), lift: 0 };
	if (open) return { hat, lift: 0 };
	const pressed = variant(motion, HeadPartKind.HairUnderHat, hair);
	const hide = hat.hide ? { hide: hat.hide } : {};
	return pressed ? { hat, ...hide, pressed, lift: 0 } : { hat, ...hide, lift: liftFor(motion, head, hair) };
}

/**
 * The head layers of `look` placed on the head origin of `frame`. A hat over hair rises by the hair's lift and grows
 * with it, its rim half as much, unless it is open on top or the hairstyle has its own drawing under the hat; its hide
 * is cut from the figure unless an open hat sits on hair.
 */
export function headPlaced(
	motion: ManifestMotion,
	frame: number,
	head: FigureHead | undefined,
	look: Look,
): PlacedLayer[] {
	const [x, y] = motion.head.origin[frame] ?? [0, 0];
	const on = (p: PlacedPart): PlacedLayer => ({
		file: p.file,
		x: x + p.x,
		y: y + p.y,
		width: p.width,
		height: p.height,
	});
	const { hat, hide, pressed, lift } = hatOf(motion, head, look);
	const layers = [
		variant(motion, HeadPartKind.Beard, look[HeadPartKind.Beard]),
		hide,
		pressed ?? variant(motion, HeadPartKind.Hair, look[HeadPartKind.Hair]),
		variant(motion, HeadPartKind.Glasses, look[HeadPartKind.Glasses]),
	];
	return layers
		.flatMap((p): PlacedLayer[] => (p === undefined ? [] : [p === hide ? { ...on(p), cut: true } : on(p)]))
		.concat(hat ? [raised(on(hat), lift)] : []);
}
