import type {
	ApiKeyProviderStatus,
	AppInfo,
	DashboardState,
	UpdateStatusEntry,
	WorkspaceSummary,
} from "../../shared/view-rpc";

export default function SettingsPane({
	dashboard,
	appInfo,
	latestUpdateStatus,
	needsWorkspaceSetup,
	modelUnavailable,
	workspaceDrafts,
	apiKeyProviders,
	apiKeyDrafts,
	onAddWorkspace,
	onRefreshStatus,
	onToggleSemanticSearch,
	onApiKeyDraftChange,
	onSaveApiKey,
	onRemoveApiKey,
	onCheckForUpdates,
	onDownloadUpdate,
	onApplyUpdate,
	onWorkspaceAliasChange,
	onSaveWorkspace,
	onRemoveWorkspace,
}: {
	dashboard: DashboardState | null;
	appInfo: AppInfo | null;
	latestUpdateStatus?: UpdateStatusEntry;
	needsWorkspaceSetup: boolean;
	modelUnavailable: boolean;
	workspaceDrafts: Record<string, string>;
	apiKeyProviders: ApiKeyProviderStatus[];
	apiKeyDrafts: Record<string, string>;
	onAddWorkspace: () => void;
	onRefreshStatus: () => void;
	onToggleSemanticSearch: (enabled: boolean) => void;
	onApiKeyDraftChange: (provider: string, value: string) => void;
	onSaveApiKey: (provider: string) => void;
	onRemoveApiKey: (provider: string) => void;
	onCheckForUpdates: () => void;
	onDownloadUpdate: () => void;
	onApplyUpdate: () => void;
	onWorkspaceAliasChange: (workspaceId: string, value: string) => void;
	onSaveWorkspace: (workspace: WorkspaceSummary) => void;
	onRemoveWorkspace: (workspaceId: string) => void;
}) {
	const modelStatus = appInfo?.modelStatus;
	const qmdStatus = appInfo?.qmd;

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/6 px-3 py-2.5">
				<div>
					<h1 className="text-[13px] font-semibold text-[var(--text-primary)]">Setup and indexed folders</h1>
					<p className="mt-1 max-w-2xl text-[12px] leading-5 text-[var(--text-muted)]">
						piwork reads from indexed folders, keeps them read-only, and writes every generated artifact into its managed home folder.
					</p>
				</div>
				<button type="button" onClick={onAddWorkspace} className="secondary-button shrink-0">
					Index Folder
				</button>
			</div>
			<div className="scroll-region flex-1 px-3 py-2">
				<div className="mx-auto flex max-w-[920px] flex-col gap-2">
					<div className="settings-card">
						<div className="flex flex-wrap items-start justify-between gap-3">
							<div className="max-w-[520px]">
								<p className="text-[10px] uppercase tracking-[0.24em] text-[var(--text-dim)]">
									Launch readiness
								</p>
								<h2 className="mt-1 text-[13px] font-semibold text-[var(--text-primary)]">
									{modelUnavailable ? "Finish model setup before launching into chats." : "piwork is ready to work."}
								</h2>
								<p className="mt-1 text-[12px] leading-5 text-[var(--text-muted)]">
									{modelUnavailable
										? modelStatus?.error || "piwork could not discover your available models. Refresh the app status after fixing your auth or model setup."
										: needsWorkspaceSetup
											? "Indexed folders are optional. You can start chatting and create artifacts now, then add folders later for @alias document context."
											: "You can start a chat, reference an indexed folder with @alias, and create artifacts from the conversation."}
								</p>
							</div>
							<div className="flex flex-wrap items-center gap-2">
								<button type="button" onClick={onAddWorkspace} className="secondary-button">
									Index Folder
								</button>
								<button type="button" onClick={onRefreshStatus} className="secondary-button">
									Refresh Status
								</button>
							</div>
						</div>
						<div className="mt-3 grid gap-2 md:grid-cols-3">
							<div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-3">
								<p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)]">Indexed folders</p>
								<p className="mt-1 text-[12px] text-[var(--text-primary)]">
									{dashboard?.workspaces.length ? `${dashboard.workspaces.length} ready` : "Optional"}
								</p>
								<p className="mt-1 text-[10px] leading-5 text-[var(--text-muted)]">
									Use <code>@alias</code> in chat to reference indexed files without editing them. You can still use piwork without any indexed folder.
								</p>
							</div>
							<div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-3">
								<p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)]">Model access</p>
								<p className="mt-1 text-[12px] text-[var(--text-primary)]">
									{modelStatus?.available
										? `${modelStatus.models.length} model${modelStatus.models.length === 1 ? "" : "s"} available`
										: "Model setup needed"}
								</p>
								<p className="mt-1 text-[10px] leading-5 text-[var(--text-muted)]">
									{modelStatus?.available
										? `Composer selection: ${dashboard?.selectedModelId ?? "Auto"}`
										: modelStatus?.error || "piwork could not load your model registry yet."}
								</p>
							</div>
							<div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-3">
								<p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)]">Semantic search</p>
								<p className="mt-1 text-[12px] text-[var(--text-primary)]">
									{!qmdStatus?.semanticSearchEnabled
										? "Disabled"
										: qmdStatus.status === "embedding"
											? "Building semantic index"
											: qmdStatus.status === "indexing"
												? "Scanning indexed folders"
												: qmdStatus.status === "error"
													? "Setup issue"
													: qmdStatus.hasVectorIndex
														? "Ready"
														: "Waiting for embeddings"}
								</p>
								<p className="mt-1 text-[10px] leading-5 text-[var(--text-muted)]">
									{!qmdStatus?.semanticSearchEnabled
										? "Adds LLM-powered query expansion, vector similarity, and neural reranking on top of keyword search. First enable downloads ~2 GB of local models and builds embeddings. All processing stays on-device."
										: qmdStatus.status === "embedding"
											? `${qmdStatus.needsEmbeddingCount} document${qmdStatus.needsEmbeddingCount === 1 ? "" : "s"} waiting for embeddings.`
											: qmdStatus.status === "indexing"
												? "Refreshing the document index before semantic search is available."
												: qmdStatus.status === "error"
													? qmdStatus.lastError || "Semantic search could not finish setup."
													: qmdStatus.hasVectorIndex
														? `Hybrid BM25 + vector search with LLM reranking across ${qmdStatus.totalDocuments} indexed document${qmdStatus.totalDocuments === 1 ? "" : "s"}. Queries are expanded and reranked locally.`
														: "Enable semantic search after adding folders to build the hybrid index."}
								</p>
								<div className="mt-3 flex items-center gap-2">
									<button
										type="button"
										onClick={() => onToggleSemanticSearch(!(qmdStatus?.semanticSearchEnabled ?? false))}
										className={qmdStatus?.semanticSearchEnabled ? "secondary-button" : "primary-button"}
									>
										{qmdStatus?.semanticSearchEnabled ? "Disable" : "Enable"}
									</button>
									<button type="button" onClick={onRefreshStatus} className="secondary-button">
										Refresh
									</button>
								</div>
								{qmdStatus?.semanticSearchEnabled && qmdStatus.status === "ready" && qmdStatus.hasVectorIndex && (
									<p className="mt-2 text-[10px] leading-4 text-[var(--text-dim)]">
										Active: query expansion, BM25 + vector hybrid retrieval, neural reranking (qwen3-reranker). All on-device.
									</p>
								)}
							</div>
						</div>
					</div>

					<div className="settings-card">
						<div className="flex flex-wrap items-start justify-between gap-3">
							<div className="max-w-[520px]">
								<p className="text-[10px] uppercase tracking-[0.24em] text-[var(--text-dim)]">
									API Keys
								</p>
								<h2 className="mt-1 text-[13px] font-semibold text-[var(--text-primary)]">
									Provider API keys
								</h2>
								<p className="mt-1 text-[12px] leading-5 text-[var(--text-muted)]">
									Add API keys for model providers, research services (web search, Exa, Jina), and image generation. OAuth-based providers (e.g. via <code>omp login</code>) are detected automatically.
								</p>
							</div>
						</div>
						<div className="mt-3 flex flex-col gap-2">
							{apiKeyProviders.filter((p) => p.category !== "research").map((provider) => (
								<div
									key={provider.provider}
									className="flex flex-wrap items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5"
								>
									<span className="min-w-[100px] text-[12px] font-medium text-[var(--text-primary)]">
										{provider.label}
									</span>
									<span
										className={`text-[10px] uppercase tracking-[0.12em] ${
											provider.configured ? "text-[#5cc38a]" : "text-[var(--text-dim)]"
										}`}
									>
										{provider.configured ? "Configured" : "Not set"}
									</span>
									<div className="ml-auto flex items-center gap-2">
										{provider.configured ? (
											<button
												type="button"
												className="ghost-button text-[11px]"
												onClick={() => onRemoveApiKey(provider.provider)}
											>
												Remove
											</button>
										) : (
											<>
												<input
													type="password"
													placeholder="sk-..."
													value={apiKeyDrafts[provider.provider] ?? ""}
													onChange={(event) => onApiKeyDraftChange(provider.provider, event.target.value)}
													className="w-[200px] rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:border-[var(--accent)] focus:outline-none"
												/>
												<button
													type="button"
													className="secondary-button text-[11px]"
													disabled={!apiKeyDrafts[provider.provider]?.trim()}
													onClick={() => onSaveApiKey(provider.provider)}
												>
													Save
												</button>
											</>
										)}
									</div>
								</div>
							))}
							{apiKeyProviders.some((p) => p.category === "research") && (
								<>
									<div className="mt-2 mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
										Research and tools
									</div>
									{apiKeyProviders.filter((p) => p.category === "research").map((provider) => (
										<div
											key={provider.provider}
											className="flex flex-wrap items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5"
										>
											<span className="min-w-[100px] text-[12px] font-medium text-[var(--text-primary)]">
												{provider.label}
											</span>
											<span
												className={`text-[10px] uppercase tracking-[0.12em] ${
													provider.configured ? "text-[#5cc38a]" : "text-[var(--text-dim)]"
												}`}
											>
												{provider.configured ? "Configured" : "Not set"}
											</span>
											<div className="ml-auto flex items-center gap-2">
												{provider.configured ? (
													<button
														type="button"
														className="ghost-button text-[11px]"
														onClick={() => onRemoveApiKey(provider.provider)}
													>
														Remove
													</button>
												) : (
													<>
														<input
															type="password"
															placeholder="sk-..."
															value={apiKeyDrafts[provider.provider] ?? ""}
															onChange={(event) => onApiKeyDraftChange(provider.provider, event.target.value)}
															className="w-[200px] rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:border-[var(--accent)] focus:outline-none"
														/>
														<button
															type="button"
															className="secondary-button text-[11px]"
															disabled={!apiKeyDrafts[provider.provider]?.trim()}
															onClick={() => onSaveApiKey(provider.provider)}
														>
															Save
														</button>
													</>
												)}
											</div>
										</div>
									))}
								</>
							)}
						</div>
					</div>

					<div className="settings-card">
						<div className="flex flex-wrap items-start justify-between gap-3">
							<div>
								<p className="text-[10px] uppercase tracking-[0.24em] text-[var(--text-dim)]">
									App info and updates
								</p>
								<p className="mt-1 text-[12px] text-[var(--text-primary)]">
									{appInfo?.name ?? "piwork"} {appInfo?.version ?? "0.0.0"} · {appInfo?.channel ?? "dev"} · {appInfo?.platform ?? "macos"}/{appInfo?.arch ?? "arm64"}
								</p>
								{appInfo?.dataRoot && (
									<p className="mt-1 break-all text-[10px] text-[var(--text-dim)]">
										Home folder: <code>{appInfo.dataRoot}</code>
									</p>
								)}
								<p className="mt-1 text-[10px] text-[var(--text-muted)]">
									{appInfo?.update.updateReady
										? "An update is ready to install."
										: appInfo?.update.updateAvailable
											? "A newer version is available to download."
											: appInfo?.update.error || latestUpdateStatus?.message || "No update activity yet."}
								</p>
							</div>
							<div className="flex flex-wrap items-center gap-2">
								<button type="button" onClick={onCheckForUpdates} className="secondary-button">
									Check for Updates
								</button>
								<button
									type="button"
									onClick={onDownloadUpdate}
									className="secondary-button"
									disabled={!appInfo?.update.updateAvailable}
								>
									Download Update
								</button>
								<button
									type="button"
									onClick={onApplyUpdate}
									className="primary-button"
									disabled={!appInfo?.update.updateReady}
								>
									Install and Relaunch
								</button>
							</div>
						</div>
						{latestUpdateStatus && (
							<div className="mt-3 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2 text-[10px] text-[var(--text-muted)]">
								<span className="font-medium text-[var(--text-primary)]">{latestUpdateStatus.message}</span>
								{typeof latestUpdateStatus.details?.progress === "number" && (
									<span> · {latestUpdateStatus.details.progress}%</span>
								)}
							</div>
						)}
					</div>

					{dashboard?.workspaces.length ? (
						dashboard.workspaces.map((workspace) => {
							const draftAlias = workspaceDrafts[workspace.id] ?? workspace.alias;
							return (
								<div key={workspace.id} className="settings-card">
									<div className="grid gap-3 md:grid-cols-[1.2fr_1fr_auto]">
										<div>
											<p className="text-[10px] uppercase tracking-[0.24em] text-[var(--text-dim)]">
												Indexed path
											</p>
											<p className="mt-1.5 break-all text-[12px] leading-5 text-[var(--text-primary)]">
												{workspace.path}
											</p>
											<p className="mt-2 text-[10px] text-[var(--text-muted)]">
												{workspace.fileCount} indexed files
											</p>
										</div>
										<div>
											<label className="text-[10px] uppercase tracking-[0.24em] text-[var(--text-dim)]">
												Alias
											</label>
											<div className="mt-1.5 flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-2">
												<span className="text-[12px] text-[var(--text-muted)]">@</span>
												<input
													value={draftAlias}
													onChange={(event) => onWorkspaceAliasChange(workspace.id, event.target.value)}
													className="w-full bg-transparent text-[12px] text-[var(--text-primary)] outline-none"
												/>
											</div>
										</div>
										<div className="flex items-end gap-2 md:flex-col md:items-stretch md:justify-end">
											<button
												type="button"
												onClick={() => onSaveWorkspace(workspace)}
												className="secondary-button"
											>
												Save Alias
											</button>
											<button
												type="button"
												onClick={() => onRemoveWorkspace(workspace.id)}
												className="ghost-button"
											>
												Remove
											</button>
										</div>
									</div>
								</div>
							);
						})
					) : (
						<div className="empty-state">
							<h2 className="text-[13px] font-semibold text-[var(--text-primary)]">No folders indexed yet.</h2>
							<p className="mt-1 max-w-xl text-[12px] leading-5 text-[var(--text-muted)]">
								Add a notes folder, docs folder, or project directory, then reference it in chat with
								an <code>@alias</code>. piwork will keep those files read-only and create any new deliverables in its managed home folder.
							</p>
						</div>
					)}
				</div>
				<p className="mt-4 pb-2 text-center text-[10px] text-[var(--text-dim)]">
					{appInfo?.name ?? "piwork"} v{appInfo?.version ?? "0.0.0"} · {appInfo?.channel ?? "dev"}
				</p>
			</div>
		</div>
	);
}
