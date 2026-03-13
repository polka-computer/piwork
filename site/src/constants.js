export const VERSION = '1.0.0'

export const LINKS = {
  github: 'https://github.com/polka-computer/piwork',
  issues: 'https://github.com/polka-computer/piwork/issues',
  releases: 'https://github.com/polka-computer/piwork/releases',
  dmg: 'https://github.com/polka-computer/piwork/releases/latest/download/stable-macos-arm64-piwork.dmg',
  discord: 'https://discord.gg/PLACEHOLDER',
  twitter: 'https://x.com/Jonovono',
  ohmypi: 'https://github.com/can1357/oh-my-pi',
}

export const PROVIDERS = [
  { name: 'Anthropic', desc: 'Claude Opus, Sonnet, Haiku — or use your Claude Pro/Max subscription' },
  { name: 'OpenAI', desc: 'GPT-4.1, o3, o4-mini — or use your ChatGPT Plus/Pro subscription' },
  { name: 'OpenRouter', desc: 'Claude, Gemini, DeepSeek, Grok & 100+ models' },
  { name: 'Google', desc: 'Gemini 2.5 Pro, Flash, and more' },
  { name: 'GitHub Copilot', desc: 'Use your existing Copilot subscription' },
  { name: 'Cursor', desc: 'Use your Cursor Pro subscription' },
  { name: 'Together', desc: 'Llama, Mixtral, open-source models' },
  { name: 'Perplexity', desc: 'Online models with built-in search' },
  { name: 'Cerebras', desc: 'Ultra-fast inference' },
  { name: 'Ollama', desc: 'Run local models — Llama, Mistral, Phi' },
]

export const TOOLS = [
  { icon: '\u{1F50D}', name: 'piwork_search', desc: 'BM25 + semantic hybrid search across all indexed workspaces' },
  { icon: '\u{1F4C2}', name: 'piwork_resources', desc: 'List workspaces, browse files, read content from @alias folders' },
  { icon: '\u{1F4E6}', name: 'piwork_artifacts', desc: 'Create, read, update, and tag artifacts saved under ~/piwork' },
  { icon: '\u{1F3E0}', name: 'piwork_home', desc: 'Memory, daily notes, table of contents, and saved links' },
  { icon: '\u{1F3A8}', name: 'generate_media', desc: 'Generate images and video via Replicate models' },
  { icon: '\u{1F310}', name: 'web_search', desc: 'Search the web for current events and recent information' },
  { icon: '\u{1F5A5}', name: 'browser', desc: 'Navigate and interact with web pages' },
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
    desc: 'Every generated file saved as a tagged, browsable artifact under ~/piwork. Markdown, CSV, JSON, images, video.',
  },
  {
    icon: '\u{1F916}',
    title: 'Any model, any subscription',
    desc: 'Use API keys or log in with your Claude, ChatGPT, Copilot, or Cursor subscription. Switch models anytime.',
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
  {
    icon: '\u{1F3A8}',
    title: 'Media generation',
    desc: 'Generate images and video with Replicate models. Auto-saved as tagged artifacts.',
  },
  {
    icon: '\u{1F310}',
    title: 'Web search & browse',
    desc: 'Search the web and scrape pages. The AI finds current information before answering.',
  },
]
