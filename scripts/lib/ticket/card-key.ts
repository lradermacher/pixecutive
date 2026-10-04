// card-key.ts — what a card key is: `PIX-` and digits, nothing else, because it becomes part of a file name.

/** Returns whether `key` is exactly `PIX-<digits>`; a glob character or a numeric issue ID would measure another card. */
export function isCardKey(key: string): boolean {
	return /^PIX-[0-9]+$/.test(key);
}
