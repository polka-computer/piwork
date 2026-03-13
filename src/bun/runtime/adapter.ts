import type { OmpPromptResponse, OmpPromptRequest, OmpPromptOptions } from "../../shared/omp";

export interface RuntimeRunHandle {
	promise: Promise<OmpPromptResponse>;
	cancel: () => void;
}

export interface AiRuntimeAdapter {
	readonly name: string;
	startRun(request: OmpPromptRequest, options: OmpPromptOptions): RuntimeRunHandle;
}
