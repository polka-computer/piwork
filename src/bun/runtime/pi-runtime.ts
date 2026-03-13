import { Effect } from "effect";
import { runOmpPrompt, type OmpPromptOptions, type OmpPromptRequest } from "../../shared/omp";
import type { AiRuntimeAdapter, RuntimeRunHandle } from "./adapter";

export class PiRuntimeAdapter implements AiRuntimeAdapter {
	readonly name = "pi";

	startRun(request: OmpPromptRequest, options: OmpPromptOptions): RuntimeRunHandle {
		const controller = new AbortController();
		const promise = Effect.runPromise(
			runOmpPrompt(request, options.customTools, {
				...options,
				abortSignal: controller.signal,
			}),
		);

		return {
			promise,
			cancel: () => controller.abort(),
		};
	}
}
