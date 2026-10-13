// main.ts — the asset pipeline's entry: hands the process's arguments, environment and streams to runPipeline.
//   pnpm assets render <prompt file> <input image> <seed> [<width>x<height>] · pnpm assets status
//   pnpm assets clip|frames|track|export <figure> <motion>
import { runPipeline } from './runPipeline.ts';

process.exitCode = await runPipeline(process.argv.slice(2), process.env, process.stdout, process.stderr);
