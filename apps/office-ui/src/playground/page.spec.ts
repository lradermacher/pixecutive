import { describe, expect, it } from 'vitest';
import { fixtureManifest } from './fixtureManifest.ts';
import { startPlayground } from './page.ts';

/** A 2D context that records its calls as text. */
class FakeContext {
	readonly calls: string[] = [];
	imageSmoothingEnabled = true;
	private composite = 'source-over';
	get globalCompositeOperation(): string {
		return this.composite;
	}
	set globalCompositeOperation(mode: string) {
		if (mode !== this.composite) this.calls.push(`composite ${mode}`);
		this.composite = mode;
	}
	setTransform(...values: number[]): void {
		this.calls.push(`transform ${values.join(' ')}`);
	}
	clearRect(): void {
		this.calls.push('clear');
	}
	drawImage(image: FakeElement, ...box: number[]): void {
		const smooth = this.imageSmoothingEnabled ? 'smooth' : 'crisp';
		this.calls.push(`draw ${smooth} ${image.tag}${image.src ? ` ${image.src}` : ''} ${box.join(' ')}`);
	}
}

/** The few element members the page uses. */
class FakeElement {
	children: FakeElement[] = [];
	className = '';
	textContent = '';
	src = '';
	width = 0;
	height = 0;
	readonly complete = true;
	readonly naturalWidth = 1;
	readonly context = new FakeContext();
	private readonly listeners: (() => void)[] = [];
	readonly style: { width?: string } = {};
	readonly classList = {
		toggle: (name: string, on: boolean): void => {
			const names = this.className.split(' ').filter((n) => n !== '' && n !== name);
			this.className = [...names, ...(on ? [name] : [])].join(' ');
		},
	};
	constructor(readonly tag: string) {}
	append(...nodes: FakeElement[]): void {
		this.children.push(...nodes);
	}
	replaceChildren(...nodes: FakeElement[]): void {
		this.children = nodes;
	}
	addEventListener(_type: string, listener: () => void): void {
		this.listeners.push(listener);
	}
	/** Runs every listener: a click on a button, a failed load on an image. */
	click(): void {
		for (const listener of this.listeners) listener();
	}
	getContext(): FakeContext {
		return this.context;
	}
	/** Every element below this one, depth first. */
	all(): FakeElement[] {
		return this.children.flatMap((child) => [child, ...child.all()]);
	}
}

/** A window serving `manifest` (or failing to), whose animation frames run when the spec says. */
function fakeWindow(manifest: unknown): {
	win: Window;
	body: FakeElement;
	created: FakeElement[];
	frame: (ms: number) => void;
} {
	const body = new FakeElement('body');
	const created: FakeElement[] = [];
	let pending: ((ms: number) => void) | null = null;
	const create = (tag: string): FakeElement => {
		const node = new FakeElement(tag);
		created.push(node);
		return node;
	};
	const win = {
		document: { body, createElement: create },
		fetch: (path: string): Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }> =>
			manifest instanceof Error
				? Promise.reject(manifest)
				: Promise.resolve({
						ok: manifest !== undefined,
						status: manifest === undefined ? 404 : 200,
						json: (): Promise<unknown> => Promise.resolve(path.endsWith('manifest.json') ? manifest : null),
					}),
		requestAnimationFrame: (callback: (ms: number) => void): void => {
			pending = callback;
		},
	};
	const frame = (ms: number): void => {
		const callback = pending;
		pending = null;
		callback?.(ms);
	};
	return { win: win as unknown as Window, body, created, frame };
}

const copy = (): unknown => JSON.parse(JSON.stringify(fixtureManifest));
const button = (body: FakeElement, text: string): FakeElement | undefined =>
	body.all().find((node) => node.tag === 'button' && node.textContent === text);

describe('startPlayground', () => {
	it('shows why a manifest is refused instead of the stage', async () => {
		const { win, body } = fakeWindow({ ...(copy() as object), version: 2 });
		await startPlayground(win);
		expect(body.all().map((node) => [node.className, node.textContent.slice(0, 19)])).toEqual([
			['reason', 'No stage: version: '],
		]);
	});

	it('says when the manifest cannot be loaded', async () => {
		const { win, body } = fakeWindow(new TypeError('Failed to fetch'));
		await startPlayground(win);
		expect(body.children[0]?.textContent).toBe(
			'No stage: assets/figures/manifest.json cannot be loaded: Failed to fetch',
		);
	});

	it('names the status when the manifest is not served', async () => {
		const { win, body } = fakeWindow(undefined);
		await startPlayground(win);
		expect(body.children[0]?.textContent).toBe('No stage: assets/figures/manifest.json answered 404');
	});

	it('names an image the server does not have, instead of leaving it out silently', async () => {
		const { win, body, created, frame } = fakeWindow(copy());
		await startPlayground(win);
		frame(0);
		created.find((node) => node.src.endsWith('walk/00.png'))?.click();
		frame(10);
		expect(body.all().find((node) => node.className === 'warning')?.textContent).toBe(
			'Not served, left out: m/body/walk/00.png',
		);
	});

	it('draws one tile per figure and motion: the figure assembled smoothly, then zoomed crisp', async () => {
		const { win, body, frame } = fakeWindow(copy());
		await startPlayground(win);
		frame(0);
		const tiles = body.all().filter((node) => node.className === 'tile');
		expect([tiles.map((t) => [t.width, t.height]), tiles[0]?.context.calls]).toEqual([
			[
				[178, 402],
				[188, 402],
			],
			['transform 1 0 0 1 0 0', 'clear', 'transform 2 0 0 2 0 0', 'draw crisp canvas 0 0'],
		]);
	});

	it('assembles each figure from the images under the served asset folder, loading each image once', async () => {
		const { win, created, frame } = fakeWindow(copy());
		await startPlayground(win);
		frame(0);
		frame(50);
		const images = created.filter((node) => node.tag === 'img').map((node) => node.src);
		const sprite = created.find((node) => node.tag === 'canvas' && node.className === '' && node.width === 89);
		// idle frames 0 and 1 with blank, eyes and mouth; walk frame 0 with its eyes and mouth
		expect([images.length, new Set(images).size, sprite?.context.calls.find((c) => c.includes('blank'))]).toEqual([
			8,
			8,
			'draw smooth img assets/figures/m/face/idle/blank.png 34 24 10 8',
		]);
	});

	it('captions each tile with its frame and hold as the clock runs', async () => {
		const { win, body, frame } = fakeWindow(copy());
		await startPlayground(win);
		frame(0);
		frame(50);
		const captions = body.all().filter((node) => node.className === 'caption');
		expect(captions.map((c) => c.textContent)).toEqual([
			'M · idle · front-left · frame 1 / 3 · hold 1',
			'M · walk · front-left · frame 0 / 2 · hold 2',
		]);
	});

	it('lays the stage out again for a chosen motion and mirrors it for front-right', async () => {
		const { win, body, frame } = fakeWindow(copy());
		await startPlayground(win);
		button(body, 'walk')?.click();
		button(body, 'front-right (mirrored)')?.click();
		frame(0);
		const tiles = body.all().filter((node) => node.className === 'tile');
		expect([tiles.length, tiles[0]?.context.calls.at(-2), button(body, 'walk')?.className]).toEqual([
			1,
			'transform -2 0 0 2 188 0',
			'choice chosen',
		]);
	});

	it('draws the speaking mouth once the figures speak', async () => {
		const { win, body, created, frame } = fakeWindow(copy());
		await startPlayground(win);
		button(body, 'speaking')?.click();
		frame(0);
		frame(50);
		const sprite = created.filter((node) => node.tag === 'canvas' && node.className === '' && node.width === 89).at(-1);
		expect(sprite?.context.calls.at(-1)).toBe('draw smooth img assets/figures/m/face/idle/mouth-open.png 49 24 10 11');
	});

	it('makes each tile as wide as its canvas, so a changing caption never moves the figure', async () => {
		const { win, body } = fakeWindow(copy());
		await startPlayground(win);
		const figures = body.all().filter((node) => node.className === 'figure');
		expect(figures.map((figure) => figure.style.width)).toEqual(['178px', '188px']);
	});

	it('draws the head part a figure is made to wear, from the served asset folder, after its face', async () => {
		const manifest = copy() as { figures: { m: { motions: Record<string, { parts?: unknown }> } } };
		const hair = { '1': { file: 'm/head/idle/hair-1.png', x: 0, y: 0, width: 10, height: 6 } };
		for (const motion of Object.values(manifest.figures.m.motions)) motion.parts = { hair };
		const { win, body, created, frame } = fakeWindow(manifest);
		await startPlayground(win);
		button(body, '1')?.click();
		frame(0);
		const drawn = created
			.filter((node) => node.tag === 'canvas' && node.className === '')
			.flatMap((c) => c.context.calls);
		expect(drawn.some((call) => call.startsWith('draw smooth img assets/figures/m/head/idle/hair-1.png'))).toBe(true);
	});

	it('grows a tile by the room its head parts need above the sprite', async () => {
		const manifest = copy() as { figures: { m: { motions: Record<string, { parts?: unknown }> } } };
		const hat = { '4': { file: 'm/head/idle/hat-4.png', x: 0, y: -100, width: 10, height: 6 } };
		for (const motion of Object.values(manifest.figures.m.motions)) motion.parts = { hat };
		const { win, body } = fakeWindow(manifest);
		await startPlayground(win);
		const tiles = body.all().filter((node) => node.tag === 'canvas' && node.className === 'tile');
		expect([tiles.length, tiles.every((tile) => tile.height > 402)]).toEqual([2, true]);
	});
});
