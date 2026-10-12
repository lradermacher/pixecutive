// main.ts — the asset pipeline's entry: hands the process's arguments, environment and streams to runPipeline.
//   pnpm assets status <figure>
import { runPipeline } from './runPipeline.ts';

process.exitCode = runPipeline(process.argv.slice(2), process.env, process.stdout, process.stderr);
