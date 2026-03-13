import { Type, type Static } from "@sinclair/typebox";
import { StringEnum, type CustomTool } from "@oh-my-pi/pi-coding-agent";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as store from "./piwork-store";
import Replicate from "replicate";

const GenerateMediaParams = Type.Object({
	action: StringEnum(["run", "check", "cancel"] as const, {
		description:
			"run: execute a Replicate model (blocks until done). check: poll prediction status. cancel: cancel a running prediction.",
	}),
	model: Type.Optional(
		Type.String({
			description:
				"Replicate model (e.g. 'bytedance/seedream-4.5', 'minimax/video-01-live'). Required for run.",
		}),
	),
	input: Type.Optional(
		Type.Record(Type.String(), Type.Unknown(), {
			description:
				"Model-specific input object (e.g. { prompt, aspect_ratio }). Required for run.",
		}),
	),
	prediction_id: Type.Optional(
		Type.String({ description: "Prediction ID for check/cancel actions." }),
	),
});

type GenerateMediaInput = Static<typeof GenerateMediaParams>;

let _client: Replicate | null = null;
const getClient = () => {
	const token = process.env.REPLICATE_API_TOKEN;
	if (!token) throw new Error("Replicate API key not configured. Add it in Settings.");
	if (!_client) _client = new Replicate({ auth: token });
	return _client;
};

const extractUrls = (output: unknown): string[] => {
	if (!output) return [];
	if (typeof output === "string") return [output];
	if (Array.isArray(output)) return output.flatMap(extractUrls);
	if (output instanceof URL) return [output.href];
	if (typeof output === "object" && output !== null) {
		if ("url" in output && typeof (output as any).url === "function")
			return [String((output as any).url())];
		if ("href" in output) return [String((output as any).href)];
		if ("uri" in output) return [String((output as any).uri)];
	}
	return [String(output)];
};

const inferMediaKind = (url: string): "image" | "video" => {
	const lower = url.toLowerCase();
	if (/\.(mp4|webm|mov|avi|mkv)(\?|$)/.test(lower)) return "video";
	return "image";
};

const inferExtension = (url: string, kind: "image" | "video"): string => {
	const match = url.match(/\.(\w+)(\?|$)/);
	if (match) return `.${match[1]}`;
	return kind === "video" ? ".mp4" : ".webp";
};

const downloadToTemp = async (url: string, ext: string): Promise<string> => {
	const resp = await fetch(url);
	if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
	const tmpPath = join(tmpdir(), `piwork-replicate-${Date.now()}${ext}`);
	await Bun.write(tmpPath, await resp.arrayBuffer());
	return tmpPath;
};

const jsonContent = (value: unknown) => ({
	content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

const textContent = (text: string) => ({
	content: [{ type: "text" as const, text }],
});

export const createReplicateTool = (
	chatId: string,
	options?: {
		onArtifactWrite?: (artifactId: string, action: "create" | "update") => void;
	},
): CustomTool<typeof GenerateMediaParams> => ({
	name: "generate_media",
	label: "Generate Media",
	description:
		"Generate images or videos using any Replicate model. Use 'run' to execute a model, 'check' to poll status, 'cancel' to abort.",
	parameters: GenerateMediaParams,

	async execute(_toolCallId, params: GenerateMediaInput) {
		try {
			switch (params.action) {
				case "run": {
					if (!params.model) return textContent("Error: model is required for run.");
					if (!params.input) return textContent("Error: input is required for run.");

					const replicate = getClient();
					const output = await replicate.run(params.model as `${string}/${string}`, {
						input: params.input as Record<string, unknown>,
					});
					const urls = extractUrls(output);
					if (urls.length === 0) {
						return textContent("Error: model returned no output URLs.");
					}

					const firstUrl = urls[0]!;
					const kind = inferMediaKind(firstUrl);
					const ext = inferExtension(firstUrl, kind);
					const sourcePath = await downloadToTemp(firstUrl, ext);

					const promptText =
						typeof params.input.prompt === "string"
							? params.input.prompt
							: "";
					const title = promptText
						? promptText.slice(0, 60).trim()
						: `${kind === "video" ? "Video" : "Image"} from ${params.model}`;

					const artifact = await store.importArtifactFile({
						chatId,
						sourcePath,
						title,
						kind,
						tags: ["generated"],
					});
					options?.onArtifactWrite?.(artifact.id, "create");

					return jsonContent({
						model: params.model,
						urls,
						artifact: { id: artifact.id, title: artifact.title, kind: artifact.kind },
					});
				}

				case "check": {
					if (!params.prediction_id)
						return textContent("Error: prediction_id is required for check.");
					const replicate = getClient();
					const prediction = await replicate.predictions.get(params.prediction_id);
					const urls = extractUrls(prediction.output);
					return jsonContent({
						id: prediction.id,
						status: prediction.status,
						urls: urls.length > 0 ? urls : undefined,
						error: prediction.error || undefined,
					});
				}

				case "cancel": {
					if (!params.prediction_id)
						return textContent("Error: prediction_id is required for cancel.");
					const replicate = getClient();
					await replicate.predictions.cancel(params.prediction_id);
					return jsonContent({ canceled: true, id: params.prediction_id });
				}

				default:
					return textContent(`Unknown generate_media action: ${params.action}`);
			}
		} catch (error) {
			return textContent(
				`Error: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	},
});
