import './App.css'
import { LINKS, TOOLS, FEATURES, PROVIDERS } from './constants'

function Nav() {
  return (
    <nav className="nav">
      <div className="nav-inner">
        <a href="#" className="nav-logo">
          <img src={import.meta.env.BASE_URL + 'icon.png'} alt="piwork" className="nav-icon" />
          <span className="nav-name">piwork</span>
        </a>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#search">Search</a>
          <a href="#ai">AI</a>
          <a href={LINKS.github} target="_blank" rel="noopener">GitHub</a>
          <a href={LINKS.discord} target="_blank" rel="noopener">Discord</a>
          <a href={LINKS.dmg} className="btn btn-sm">
            Download
          </a>
        </div>
      </div>
    </nav>
  )
}

function Hero() {
  return (
    <section className="hero">
      <div className="hero-glow" />
      <div className="hero-content">
        <div className="hero-badge">
          <span className="badge-dot" />
          Desktop App &middot; macOS
        </div>
        <h1 className="hero-title">
          Your AI workspace for
          <br />
          <span className="hero-highlight">everyday tasks</span>
        </h1>
        <p className="hero-subtitle">
          A native desktop app that indexes your folders, chats with any model,
          and saves every artifact locally. Like Codex for the rest of your work.
          <br />
          <span className="hero-dim">Powered by <a href={LINKS.ohmypi} target="_blank" rel="noopener">Oh My Pi</a>.</span>
        </p>
        <div className="hero-actions">
          <a href={LINKS.dmg} className="btn btn-lg">
            <span className="btn-icon">&darr;</span>
            Download for Mac
          </a>
          <a href={LINKS.github} className="btn btn-lg btn-outline" target="_blank" rel="noopener">
            View on GitHub
          </a>
        </div>
        <div className="hero-platforms">
          macOS &middot; Electrobun &middot; Local-first
        </div>
      </div>
      <div className="hero-visual">
        <div className="hero-window">
          <div className="window-bar">
            <span className="window-dot red" />
            <span className="window-dot yellow" />
            <span className="window-dot green" />
            <span className="window-title">piwork</span>
          </div>
          <div className="window-body">
            {/* Left sidebar */}
            <div className="mock-sidebar">
              <div className="mock-sidebar-header">
                <span className="mock-sidebar-brand">PIWORK</span>
                <span className="mock-sidebar-icons">&#9881;</span>
              </div>
              <div className="mock-new-chat">+ New chat</div>

              <div className="mock-docs-card">
                <div className="mock-docs-icon">&#128196;</div>
                <div className="mock-docs-info">
                  <div className="mock-docs-title">Documents</div>
                  <div className="mock-docs-sub">Browse generated files</div>
                </div>
                <span className="mock-docs-count">5</span>
              </div>

              <div className="mock-sidebar-section">
                <div className="mock-sidebar-section-head">
                  <span>Chats</span>
                  <span className="mock-section-count">7</span>
                </div>
                <div className="mock-search-box">Search chats</div>
              </div>

              <div className="mock-sidebar-group">
                <div className="mock-group-label"><span className="mock-group-dot draft" /> Drafts <span className="mock-section-count">1</span></div>
                <div className="mock-chat-item draft-item">
                  <span className="mock-chat-dot draft" /> New thread
                  <span className="mock-chat-time">48m</span>
                </div>
              </div>

              <div className="mock-sidebar-group">
                <div className="mock-group-label"><span className="mock-group-dot completed" /> Completed <span className="mock-section-count">5</span></div>
                <div className="mock-chat-item active">
                  <span className="mock-chat-dot completed" /> create me some cute cat ascii art
                  <span className="mock-chat-time">now</span>
                </div>
                <div className="mock-chat-item">
                  <span className="mock-chat-dot completed" /> lets use replicate api to make an image ...
                  <span className="mock-chat-time">47m</span>
                </div>
                <div className="mock-chat-item">
                  <span className="mock-chat-dot completed" /> make me some cute ascii cats
                  <span className="mock-chat-time">1h</span>
                </div>
                <div className="mock-chat-item">
                  <span className="mock-chat-dot completed" /> summarize https://malus.sh/
                  <span className="mock-chat-time">3h</span>
                </div>
              </div>

              <div className="mock-sidebar-group">
                <div className="mock-group-label"><span className="mock-group-dot archived" /> Archived <span className="mock-section-count">1</span></div>
              </div>
            </div>

            {/* Center chat area */}
            <div className="mock-center">
              <div className="mock-center-header">
                <span className="mock-chat-title-text">create me some cute cat ascii art</span>
                <button className="mock-retry-btn">Retry</button>
              </div>
              <div className="mock-messages">
                <div className="mock-msg-block">
                  <div className="mock-msg-label">You &middot; openrouter/google/gemini-3-flash-preview</div>
                  <div className="mock-msg user">create me some cute cat ascii art</div>
                </div>
                <div className="mock-msg-block">
                  <div className="mock-msg-label">piwork &middot; openrouter/google/gemini-3-flash-preview &middot; 11.8s</div>
                  <div className="mock-msg ai">
                    I've created another set of cute ASCII cats for you! &#128568;
                    <br /><br />
                    Check out <span className="mock-link">More Cute ASCII Cats</span> to see the love cat, a cat in a box, and more. Enjoy!
                    <br />
                    <div className="mock-open-artifact-btn">Open More Cute ASCII Cats</div>
                  </div>
                </div>
              </div>
              <div className="mock-input-area">
                <div className="mock-input-field">
                  Ask piwork. Use @alias to reference indexed folders.
                  <span className="mock-cursor" />
                </div>
                <div className="mock-input-actions">
                  <span className="mock-input-chip">@ Mention</span>
                  <span className="mock-input-chip">+ Attach</span>
                  <span className="mock-input-chip model-chip-select">&#9737; Google: Gemini 3 Fl...</span>
                  <button className="mock-send-btn">Send</button>
                </div>
              </div>
            </div>

            {/* Right attachments pane */}
            <div className="mock-artifacts">
              <div className="mock-artifacts-header">
                <span>ATTACHMENTS</span>
                <span className="mock-section-count">1</span>
              </div>
              <div className="mock-artifacts-list">
                <div className="mock-artifact-card">
                  <div className="mock-artifact-top">
                    <div className="mock-artifact-title">More Cute ASCII Cats</div>
                    <div className="mock-artifact-time">now</div>
                  </div>
                  <div className="mock-artifact-tags">
                    <span className="mock-tag type">MARKDOWN</span>
                    <span className="mock-tag">#ascii</span>
                    <span className="mock-tag">#cats</span>
                    <span className="mock-tag dim">more...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Features() {
  return (
    <section className="section" id="features">
      <div className="section-inner">
        <div className="section-header">
          <span className="section-label">Features</span>
          <h2 className="section-title">Everything you need. Nothing you don't.</h2>
          <p className="section-subtitle">
            Index folders, chat with AI, save artifacts. All local, all yours.
          </p>
        </div>
        <div className="features-grid">
          {FEATURES.map((f, i) => (
            <div className="feature-card" key={i}>
              <div className="feature-icon">{f.icon}</div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function AISection() {
  return (
    <section className="section section-dark" id="ai">
      <div className="section-inner">
        <div className="section-header">
          <span className="section-label">AI Integration</span>
          <h2 className="section-title">
            Any model. Any subscription.
            <br />
            <span className="highlight-text">One workspace that gets things done.</span>
          </h2>
          <p className="section-subtitle">
            Bring your own API key or log in with your existing Claude, ChatGPT, Copilot, or Cursor subscription. Pick your model and switch anytime.
            Built on <a href={LINKS.ohmypi} target="_blank" rel="noopener">Oh My Pi</a> &mdash; the open-source AI agent framework.
          </p>
        </div>

        <div className="ai-layout">
          <div className="ai-models">
            <h3 className="ai-section-title">Providers</h3>
            <div className="model-list">
              {PROVIDERS.map((p, i) => (
                <div className="model-chip" key={i}>
                  <span className="model-provider">{p.name}</span>
                  <span className="model-name">{p.desc}</span>
                </div>
              ))}
              <div className="model-chip model-custom">
                <span className="model-provider">+</span>
                <span className="model-name">Any OpenAI-compatible endpoint</span>
              </div>
            </div>
          </div>

          <div className="ai-tools">
            <h3 className="ai-section-title">Tools</h3>
            <p className="ai-tools-desc">
              The AI doesn't just chat &mdash; it <em>acts</em>. With {TOOLS.length} specialized tools,
              it can search your files, create artifacts, browse the web, and generate media.
            </p>
            <div className="tools-grid">
              {TOOLS.map((t, i) => (
                <div className="tool-card" key={i}>
                  <span className="tool-icon">{t.icon}</span>
                  <div>
                    <div className="tool-name">{t.name}</div>
                    <div className="tool-desc">{t.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function SearchSection() {
  return (
    <section className="section" id="search">
      <div className="section-inner">
        <div className="section-header">
          <span className="section-label">Hybrid Search</span>
          <h2 className="section-title">
            Index any folder. Search <span className="highlight-text">everything</span> instantly.
          </h2>
          <p className="section-subtitle">
            Point piwork at a folder, give it an @alias. QMD indexes it with BM25 + local semantic embeddings.
            The AI searches before it answers.
          </p>
        </div>

        <div className="search-demo">
          <div className="search-window">
            <div className="search-window-bar">
              <span className="window-dot red" />
              <span className="window-dot yellow" />
              <span className="window-dot green" />
            </div>
            <div className="search-flow">
              {/* Step 1: User asks */}
              <div className="search-step">
                <div className="search-step-label">
                  <span className="search-step-num">1</span>
                  You ask
                </div>
                <div className="search-bubble user">
                  What's the auth flow in <span className="mock-at">@docs</span>?
                </div>
              </div>

              {/* Step 2: piwork searches */}
              <div className="search-step">
                <div className="search-step-label">
                  <span className="search-step-num">2</span>
                  piwork searches
                </div>
                <div className="search-results-card">
                  <div className="search-results-header">
                    <span className="search-results-icon">&#128269;</span>
                    piwork_search <span className="search-results-dim">&middot; @docs &middot; "auth flow"</span>
                  </div>
                  <div className="search-result-row">
                    <span className="search-result-file">auth/jwt-handler.ts</span>
                    <span className="search-result-score">0.94</span>
                  </div>
                  <div className="search-result-row">
                    <span className="search-result-file">middleware/verify.ts</span>
                    <span className="search-result-score">0.87</span>
                  </div>
                  <div className="search-result-row">
                    <span className="search-result-file">docs/auth-overview.md</span>
                    <span className="search-result-score">0.82</span>
                  </div>
                  <div className="search-result-meta">
                    BM25 + semantic &middot; 3 results &middot; 24ms
                  </div>
                </div>
              </div>

              {/* Step 3: AI creates */}
              <div className="search-step">
                <div className="search-step-label">
                  <span className="search-step-num">3</span>
                  AI creates an artifact
                </div>
                <div className="search-bubble ai">
                  The auth flow uses JWT tokens with refresh rotation.
                  I've summarized the key files and created an artifact.
                  <div className="search-artifact-badge">
                    &#128230; auth-flow-summary.md
                    <span className="search-artifact-saved">saved to ~/piwork</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="search-pills">
            <div className="search-pill">
              <span className="search-pill-icon">&#128193;</span>
              <div>
                <div className="search-pill-title">@alias workspaces</div>
                <div className="search-pill-desc">Add any folder as a read-only @mention</div>
              </div>
            </div>
            <div className="search-pill">
              <span className="search-pill-icon">&#9889;</span>
              <div>
                <div className="search-pill-title">QMD indexing</div>
                <div className="search-pill-desc">BM25 keyword + on-device semantic vectors</div>
              </div>
            </div>
            <div className="search-pill">
              <span className="search-pill-icon">&#128274;</span>
              <div>
                <div className="search-pill-title">Fully local</div>
                <div className="search-pill-desc">No files leave your machine, ever</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Download() {
  return (
    <section className="section section-dark" id="download">
      <div className="section-inner section-center">
        <div className="pi-symbol">&pi;</div>
        <h2 className="section-title">Ready to work?</h2>
        <p className="section-subtitle">
          Download piwork for free. Bring your API key or log in with your existing AI subscription.
        </p>
        <div className="download-buttons">
          <a href={LINKS.dmg} className="btn btn-xl">
            <span className="btn-icon">&darr;</span>
            Download for macOS
          </a>
          <a href={LINKS.discord} className="btn btn-xl btn-outline" target="_blank" rel="noopener">
            Join Discord
          </a>
        </div>
        <p className="download-note">
          macOS &middot; Free &middot; Local-first
        </p>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <img src={import.meta.env.BASE_URL + 'icon.png'} alt="piwork" className="footer-icon" />
          <span>piwork</span>
        </div>
        <div className="footer-links">
          <a href={LINKS.github} target="_blank" rel="noopener">GitHub</a>
          <a href={LINKS.discord} target="_blank" rel="noopener">Discord</a>
          <a href={LINKS.issues} target="_blank" rel="noopener">Issues</a>
          <a href={LINKS.ohmypi} target="_blank" rel="noopener">Oh My Pi</a>
        </div>
        <div className="footer-copy">
          Built by <a href={LINKS.twitter} target="_blank" rel="noopener">@Jonovono</a>
        </div>
      </div>
    </footer>
  )
}

export default function App() {
  return (
    <>
      <Nav />
      <Hero />
      <Features />
      <AISection />
      <SearchSection />
      <Download />
      <Footer />
    </>
  )
}
