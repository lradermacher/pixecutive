// visionAnswer.ts — reads a vision model's yes or no answer; anything that is not a clear yes counts as no.

/** Whether the answer starts with yes, ignoring case, spaces and punctuation; doubt fails the feature. */
export function visionAnswer(answer: string): boolean {
	return /^\W*yes\b/i.test(answer.trim());
}
