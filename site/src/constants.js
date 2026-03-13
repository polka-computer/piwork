export const VERSION = '0.1.0'

export const LINKS = {
  github: 'https://github.com/polka-computer/piwork',
  issues: 'https://github.com/polka-computer/piwork/issues',
  releases: 'https://github.com/polka-computer/piwork/releases',
  dmg: 'https://github.com/polka-computer/piwork/releases/latest/download/stable-macos-arm64-piwork.dmg',
  openRouter: 'https://openrouter.ai',
  twitter: 'https://x.com/Jonovono',
}

export const PROVIDERS = [
  { name: 'OpenRouter', desc: 'Claude, Gemini, DeepSeek, Grok & more' },
  { name: 'Anthropic', desc: 'Claude Opus 4.6, Sonnet 4.5, Haiku 4.5' },
  { name: 'OpenAI', desc: 'GPT-5.2, GPT-4.1 & more' },
  { name: 'Together', desc: 'Llama, Mixtral, open-source models' },
  { name: 'Perplexity', desc: 'Online models with built-in search' },
  { name: 'Cerebras', desc: 'Ultra-fast inference' },
]

export const TOOLS = [
  { icon: '\u{1F50D}', name: 'piwork_search', desc: 'BM25 + semantic hybrid search across all indexed workspaces' },
  { icon: '\u{1F4C2}', name: 'piwork_resources', desc: 'List workspaces, browse files, read content from @alias folders' },
  { icon: '\u{1F4E6}', name: 'piwork_artifacts', desc: 'Create, read, update, and tag artifacts saved under ~/piwork' },
  { icon: '\u{1F3E0}', name: 'piwork_home', desc: 'Memory, daily notes, table of contents, and saved links' },
  { icon: '\u{1F3A8}', name: 'generate_media', desc: 'Generate images and video via Replicate models' },
]

export const FEATURES = [
  {
    icon: '\u{1F4C1}',
    title: 'Index any folder',
    desc: 'Add read-only folders with @alias. Reference them in chat with @mentions. Your files stay where they are.',
  },
  {
    icon: '\u{1F50D}',
    title: 'Hybrid search',
    desc: 'BM25 keyword + on-device semantic search powered by local embeddings. No cloud dependency.',
  },
  {
    icon: '\u{1F4E6}',
    title: 'AI artifacts',
    desc: 'Every generated file saved as a tagged, browsable artifact under ~/piwork. Markdown, CSV, JSON, images.',
  },
  {
    icon: '\u{1F916}',
    title: 'Multi-model',
    desc: 'OpenRouter, Anthropic, OpenAI, Together, Perplexity, Cerebras. Bring your key, pick your model.',
  },
  {
    icon: '\u{1F9E0}',
    title: 'Personal knowledge',
    desc: 'Memory, daily notes, links, table of contents \u2014 all managed by AI and stored locally.',
  },
  {
    icon: '\u{1F512}',
    title: 'Local-first',
    desc: 'Everything stays on your machine. SQLite + local embeddings. No data leaves your device.',
  },
]
