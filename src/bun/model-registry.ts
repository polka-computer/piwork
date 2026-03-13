import {
	ModelRegistry,
	discoverAuthStorage,
} from "@oh-my-pi/pi-coding-agent";
import type { AuthStorage } from "@oh-my-pi/pi-coding-agent";
import type { AvailableModel, ModelStatus } from "../shared/view-rpc";

let _registry: ModelRegistry | null = null;
let _initPromise: Promise<ModelRegistry> | null = null;
let _authStorage: AuthStorage | null = null;

const API_KEY_PROVIDERS = [
	{ id: "openrouter", label: "OpenRouter", category: "model" as const, envVar: "OPENROUTER_API_KEY" },
	{ id: "anthropic", label: "Anthropic", category: "model" as const, envVar: "ANTHROPIC_API_KEY" },
	{ id: "openai", label: "OpenAI", category: "model" as const, envVar: "OPENAI_API_KEY" },
	{ id: "together", label: "Together AI", category: "model" as const, envVar: "TOGETHER_API_KEY" },
	{ id: "perplexity", label: "Perplexity", category: "model" as const, envVar: "PERPLEXITY_API_KEY" },
	{ id: "cerebras", label: "Cerebras", category: "model" as const, envVar: "CEREBRAS_API_KEY" },
	{ id: "google", label: "Google (Gemini)", category: "research" as const, envVar: "GOOGLE_API_KEY" },
	{ id: "exa", label: "Exa", category: "research" as const, envVar: "EXA_API_KEY" },
	{ id: "brave", label: "Brave Search", category: "research" as const, envVar: "BRAVE_API_KEY" },
	{ id: "tavily", label: "Tavily", category: "research" as const, envVar: "TAVILY_API_KEY" },
	{ id: "jina", label: "Jina", category: "research" as const, envVar: "JINA_API_KEY" },
	{ id: "kagi", label: "Kagi", category: "research" as const, envVar: "KAGI_API_KEY" },
	{ id: "replicate", label: "Replicate", category: "research" as const, envVar: "REPLICATE_API_TOKEN" },
];

const mirrorKeyToEnv = (providerId: string, apiKey: string | undefined) => {
	const provider = API_KEY_PROVIDERS.find((p) => p.id === providerId);
	if (!provider?.envVar) return;
	if (apiKey) {
		Bun.env[provider.envVar] = apiKey;
		process.env[provider.envVar] = apiKey;
	} else {
		delete Bun.env[provider.envVar];
		delete process.env[provider.envVar];
	}
	if (providerId === "google" && apiKey) {
		Bun.env.GEMINI_API_KEY = apiKey;
		process.env.GEMINI_API_KEY = apiKey;
	}
};

async function init(): Promise<ModelRegistry> {
	_authStorage = await discoverAuthStorage();
	// Mirror existing keys to env so research tools work immediately
	for (const provider of API_KEY_PROVIDERS) {
		if (_authStorage.hasAuth(provider.id)) {
			try {
				const auth = await _authStorage.get(provider.id);
				if (auth && "key" in auth && typeof auth.key === "string") {
					mirrorKeyToEnv(provider.id, auth.key);
				}
			} catch {
				// auth retrieval may fail for some providers
			}
		}
	}
	const registry = new ModelRegistry(_authStorage);
	await registry.refresh();
	return registry;
}

const toAvailableModels = (
	registry: ModelRegistry,
): AvailableModel[] => {
	const available = registry.getAvailable();
	return available.map((model: { provider: string; id: string; name?: string }) => ({
		provider: model.provider,
		id: model.id,
		name: model.name ?? model.id,
	}));
};

export async function getModelRegistry(): Promise<ModelRegistry> {
	if (_registry) return _registry;

	if (!_initPromise) {
		_initPromise = init().then((r) => {
			_registry = r;
			return r;
		}).catch((error) => {
			_registry = null;
			_initPromise = null;
			throw error;
		});
	}

	return _initPromise;
}

export async function listAvailableModels(): Promise<AvailableModel[]> {
	const status = await getModelStatus();
	return status.models;
}

export async function getModelStatus(refresh = false): Promise<ModelStatus> {
	if (refresh) {
		_registry = null;
		_initPromise = null;
	}

	try {
		const registry = await getModelRegistry();
		return {
			available: true,
			models: toAvailableModels(registry),
			checkedAt: new Date().toISOString(),
		};
	} catch (error) {
		return {
			available: false,
			models: [],
			error: error instanceof Error ? error.message : String(error),
			checkedAt: new Date().toISOString(),
		};
	}
}

export async function listApiKeyProviders() {
	if (!_authStorage) await getModelRegistry();
	return API_KEY_PROVIDERS.map((p) => ({
		provider: p.id,
		label: p.label,
		configured: _authStorage!.hasAuth(p.id),
		category: p.category,
	}));
}

export async function setProviderApiKey(provider: string, apiKey: string) {
	if (!_authStorage) await getModelRegistry();
	await _authStorage!.set(provider, { type: "api_key", key: apiKey });
	mirrorKeyToEnv(provider, apiKey);
	const providerDef = API_KEY_PROVIDERS.find((p) => p.id === provider);
	if (providerDef?.category === "model") {
		_registry = null;
		_initPromise = null;
	}
}

export async function removeProviderApiKey(provider: string) {
	if (!_authStorage) await getModelRegistry();
	await _authStorage!.remove(provider);
	mirrorKeyToEnv(provider, undefined);
	const providerDef = API_KEY_PROVIDERS.find((p) => p.id === provider);
	if (providerDef?.category === "model") {
		_registry = null;
		_initPromise = null;
	}
}
