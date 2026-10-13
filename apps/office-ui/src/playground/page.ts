// page.ts — the playground page: loads the manifest through the protocol's schema, builds the controls and one tile
// per shown figure, and draws every tile at each animation frame. Images are loaded once and drawn once complete.
import { drawFigure } from './drawFigure.ts';
import { controlGroups } from './controlGroups.ts';
import { Playground } from './playground.ts';
import { type ManifestReading, readManifest } from './readManifest.ts';
import { tileTransform } from './tileTransform.ts';

/** Where the figures' assets are served, relative to the page. */
const assets = 'assets/figures/';

/** A shown tile: the canvas on the stage, the canvas the figure is assembled on, and its caption. */
interface Shown {
	readonly canvas: HTMLCanvasElement;
	readonly sprite: HTMLCanvasElement;
	readonly caption: HTMLElement;
}

/** One button of a choice and whether it is the chosen one now. */
interface Choice {
	readonly button: HTMLButtonElement;
	readonly chosen: () => boolean;
}

function element<K extends keyof HTMLElementTagNameMap>(
	doc: Document,
	tag: K,
	className: string,
	text = '',
): HTMLElementTagNameMap[K] {
	const node = doc.createElement(tag);
	node.className = className;
	node.textContent = text;
	return node;
}

/** The manifest checked by the protocol's schema, or why there is none: not loaded, or refused. */
async function loadManifest(win: Window): Promise<ManifestReading> {
	let json: unknown;
	try {
		const answer = await win.fetch(`${assets}manifest.json`);
		if (!answer.ok) return { reason: `${assets}manifest.json answered ${String(answer.status)}` };
		json = await answer.json();
	} catch (failure) {
		return { reason: `${assets}manifest.json cannot be loaded: ${(failure as Error).message}` };
	}
	return readManifest(json);
}

/** Starts the playground in `win`: a refused manifest shows its reason instead of the stage. */
export async function startPlayground(win: Window): Promise<void> {
	const doc = win.document;
	const reading = await loadManifest(win);
	if ('reason' in reading) {
		doc.body.append(element(doc, 'p', 'reason', `No stage: ${reading.reason}`));
		return;
	}
	const playground = new Playground(reading.manifest);
	const images = new Map<string, HTMLImageElement>();
	const missing = new Set<string>();
	const image = (file: string): HTMLImageElement | undefined => {
		let loaded = images.get(file);
		if (!loaded) {
			loaded = doc.createElement('img');
			loaded.addEventListener('error', () => missing.add(file));
			loaded.src = `${assets}${file}`;
			images.set(file, loaded);
		}
		return loaded.complete && loaded.naturalWidth > 0 ? loaded : undefined;
	};

	const choices: Choice[] = [];
	const controls = element(doc, 'div', 'controls');
	const stage = element(doc, 'div', 'stage');
	const warning = element(doc, 'p', 'warning');
	let shown: Shown[] = [];

	const layout = (): void => {
		shown = playground.tiles().map((tile) => {
			const canvas = element(doc, 'canvas', 'tile');
			canvas.width = tile.motion.width * playground.zoom;
			canvas.height = tile.motion.height * playground.zoom;
			const sprite = doc.createElement('canvas');
			sprite.width = tile.motion.width;
			sprite.height = tile.motion.height;
			return { canvas, sprite, caption: element(doc, 'figcaption', 'caption') };
		});
		stage.replaceChildren(
			...shown.map(({ canvas, caption }) => {
				const figure = element(doc, 'figure', 'figure');
				// the tile is as wide as its canvas, so a caption that grows with the frame number never moves the figure
				figure.style.width = `${String(canvas.width)}px`;
				figure.append(canvas, caption);
				return figure;
			}),
		);
	};

	const draw = (): void => {
		playground.tiles().forEach((tile, k) => {
			const place = shown[k];
			const spriteCanvas = place?.sprite.getContext('2d');
			const tileCanvas = place?.canvas.getContext('2d');
			if (!place || !spriteCanvas || !tileCanvas) return;
			drawFigure(spriteCanvas, image, tile.name, tile.motion, tile.frame, tile.mouth);
			tileCanvas.setTransform(1, 0, 0, 1, 0, 0);
			tileCanvas.clearRect(0, 0, place.canvas.width, place.canvas.height);
			tileCanvas.imageSmoothingEnabled = false;
			tileCanvas.setTransform(...tileTransform(tile.motion.width, playground.zoom, playground.facing));
			tileCanvas.drawImage(place.sprite, 0, 0);
			place.caption.textContent = tile.label;
		});
		for (const { button, chosen } of choices) button.classList.toggle('chosen', chosen());
		warning.textContent = missing.size > 0 ? `Not served, left out: ${[...missing].join(', ')}` : '';
	};

	for (const { title, options } of controlGroups(playground)) {
		const box = element(doc, 'div', 'group');
		box.append(element(doc, 'span', 'title', title));
		for (const { text, chosen, choose } of options) {
			const button = element(doc, 'button', 'choice', text);
			button.addEventListener('click', () => {
				choose();
				layout();
				draw();
			});
			choices.push({ button, chosen });
			box.append(button);
		}
		controls.append(box);
	}

	const note = element(
		doc,
		'p',
		'note',
		'Every motion plays at 24 ticks per second with its holds; the face parts sit on the head origin of each frame. A manifest the protocol schema refuses shows its reason instead of the stage.',
	);
	doc.body.append(controls, warning, stage, note);
	layout();
	let last: number | null = null;
	const frame = (ms: number): void => {
		if (last !== null) playground.advance(ms - last);
		last = ms;
		draw();
		win.requestAnimationFrame(frame);
	};
	win.requestAnimationFrame(frame);
}
