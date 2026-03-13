import type { AiRuntimeAdapter } from "./adapter";
import { PiRuntimeAdapter } from "./pi-runtime";

const runtime: AiRuntimeAdapter = new PiRuntimeAdapter();

export const getRuntimeAdapter = (): AiRuntimeAdapter => runtime;
