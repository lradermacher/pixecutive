// mfluxProgress.ts — how a tqdm progress bar of mflux shows its step, the one pattern both the lock and the complaint use.

/**
 * A tqdm bar's count, such as ` 3/8 [00:41<01:23, 20.8s/it]`: the step it reached and the steps of the bar. The
 * elapsed and remaining time after the bracket tell it apart from a message such as `shape 1/2 [batch]`.
 */
export const mfluxProgress = /([0-9]+)\/([0-9]+) \[[0-9:?]+<[0-9:?]+[^\]]*\]/;
