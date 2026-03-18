import { Component, type ErrorInfo } from "react";
import { Toaster } from "sonner";
import AppSidebar from "./components/AppSidebar";
import ArtifactDetailPane from "./components/ArtifactDetailPane";
import ArtifactModal from "./components/ArtifactModal";
import UpdateDialog from "./components/UpdateDialog";
import ArtifactsPane from "./components/ArtifactsPane";
import ChatArtifactsRail from "./components/ChatArtifactsRail";
import ChatPane from "./components/ChatPane";
import SettingsPane from "./components/SettingsPane";
import TopBar from "./components/TopBar";
import { usePiworkAppController } from "./hooks/usePiworkAppController";

type AppErrorBoundaryState = {
	error?: Error;
};

class AppErrorBoundary extends Component<{ children: React.ReactNode }, AppErrorBoundaryState> {
	state: AppErrorBoundaryState = {};

	static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
		return { error };
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		console.error("[piwork:renderer] uncaught render error", error, info);
	}

	render() {
		if (this.state.error) {
			return (
				<div className="flex h-screen items-center justify-center bg-[var(--bg-canvas)] px-6">
					<div className="w-full max-w-[520px] rounded-2xl border border-[var(--danger-border)] bg-[var(--danger-surface)] p-5 text-left shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
						<div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--danger-strong)]">
							Renderer issue
						</div>
						<div className="mt-2 text-[15px] font-semibold text-[var(--text-primary)]">
							piwork hit an unexpected UI error.
						</div>
						<p className="mt-2 text-[12px] leading-5 text-[var(--text-muted)]">
							{this.state.error.message || "Unknown renderer error"}
						</p>
						<div className="mt-4 flex items-center gap-2">
							<button type="button" onClick={() => window.location.reload()} className="secondary-button">
								Reload
							</button>
						</div>
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}

function AppInner() {
	const app = usePiworkAppController();

	if (!app.bridgeAvailable) {
		return (
			<div className="flex h-screen items-center justify-center bg-[var(--bg-canvas)] px-6 text-center text-sm text-[var(--text-muted)]">
				piwork needs the Electrobun bridge to run.
			</div>
		);
	}

	if (app.isBooting || !app.dashboard) {
		return (
			<div className="flex h-screen items-center justify-center bg-[var(--bg-canvas)]">
				<p className="text-sm text-[var(--text-muted)]">Loading piwork…</p>
			</div>
		);
	}

	return (
		<>
			<div className="flex h-screen flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)]">
				<div className="electrobun-webkit-app-region-drag h-7 shrink-0 border-b border-white/6" />
				<div className="flex min-h-0 flex-1">
					<AppSidebar
						activeView={app.state.activeView}
						activeChatId={app.state.activeChatId ?? undefined}
						dashboard={app.dashboard}
						artifactCount={app.artifactCount}
						collapsedSidebarSections={app.state.collapsedSidebarSections}
						chatSearchQuery={app.state.chatSearchQuery}
						draftChats={app.draftChats}
						chatSections={app.chatSections}
						filteredVisibleChatsLength={app.filteredVisibleChats.length}
						onCreateChat={() => void app.handleCreateChat()}
						onOpenSettings={() => app.setActiveView("settings")}
						onOpenArtifacts={() => app.setActiveView("artifacts")}
						onOpenPiworkFolder={() => void app.handleOpenPiworkFolder()}
						onToggleSidebarSection={app.toggleSidebarSection}
						onChatSearchQueryChange={app.setChatSearchQuery}
						onSelectChat={(chatId) => void app.selectChat(chatId)}
						onArchiveChat={(chatId, archived) => void app.handleArchiveChat(chatId, archived)}
						onDeleteChat={(chatId) => void app.handleDeleteChat(chatId)}
						onArchiveCompletedChats={() => void app.handleArchiveCompletedChats()}
					/>

					<div className="flex min-h-0 min-w-0 flex-1">
						<main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
							<TopBar
								activeView={app.state.activeView}
								activeArtifact={app.activeArtifact}
								activeChat={app.activeChat}
								activeRuntimeActivity={app.activeRuntimeActivity}
								canRetryLastPrompt={app.canRetryLastPrompt}
								onBackToArtifacts={() => app.setActiveView("artifacts")}
								onCancelActiveRun={() => void app.handleCancelActiveRun()}
								onRetryLastPrompt={() => void app.handleRetryLastPrompt()}
							/>
							{app.state.activeView === "chat" && (
								<ChatPane
									activeChat={app.activeChat}
									artifactLookup={app.artifactLookup}
									needsWorkspaceSetup={app.needsWorkspaceSetup}
									modelUnavailable={app.modelUnavailable}
									modelError={app.modelStatus?.error}
									activeRuntimeActivity={app.activeRuntimeActivity}
									composerBlockedReason={app.composerBlockedReason}
									composerIsBusy={app.composerIsBusy}
									composerModelId={app.dashboard.selectedModelId}
									composerWorkspaces={app.dashboard.workspaces}
									composerArtifacts={app.dashboard.artifacts}
									composerFocusToken={app.state.composerFocusToken}
									onOpenArtifact={(artifactId, options) => void app.handleOpenArtifact(artifactId, options)}
									onOpenSettings={() => app.setActiveView("settings")}
									onRefreshStatus={() => void app.refreshAppInfo()}
									onModelChange={(modelId) => void app.handleSelectedModelChange(modelId)}
									onSubmit={(input) => app.handleComposerSubmit(input)}
								/>
							)}
							{app.state.activeView === "artifacts" && (
								<ArtifactsPane
									dashboard={app.dashboard}
									artifactSearchQuery={app.state.artifactSearchQuery}
									artifactKindFilter={app.state.artifactKindFilter}
									artifactChatFilter={app.state.artifactChatFilter}
									artifactTagFilters={app.state.artifactTagFilters}
									artifactTagTrayOpen={app.state.artifactTagTrayOpen}
									artifactShowAllTags={app.state.artifactShowAllTags}
									filteredArtifacts={app.filteredArtifacts}
									artifactTagCounts={app.artifactTagCounts}
									orderedArtifactTags={app.orderedArtifactTags}
									onArtifactSearchQueryChange={app.setArtifactSearchQuery}
									onArtifactKindFilterChange={app.setArtifactKindFilter}
									onArtifactChatFilterChange={app.setArtifactChatFilter}
									onToggleArtifactTagTray={() => app.setArtifactTagTrayOpen(!app.state.artifactTagTrayOpen)}
									onClearArtifactFilters={app.clearArtifactFilters}
									onToggleArtifactShowAllTags={() => app.setArtifactShowAllTags(!app.state.artifactShowAllTags)}
									onHideArtifactTagTray={() => {
										app.setArtifactTagTrayOpen(false);
										app.setArtifactShowAllTags(false);
									}}
									onToggleArtifactTagFilter={app.toggleArtifactTagFilter}
									onOpenArtifact={(artifactId) => void app.handleOpenArtifact(artifactId)}
								onDeleteArtifact={(artifactId) => void app.handleDeleteArtifact(artifactId)}
								/>
							)}
							{app.state.activeView === "artifact-detail" && (
								<ArtifactDetailPane
									activeArtifact={app.activeArtifact}
									onSaveArtifactTags={app.handleSaveArtifactTags}
									onDeleteArtifact={(artifactId) => void app.handleDeleteArtifact(artifactId)}
								/>
							)}
							{app.state.activeView === "settings" && (
								<SettingsPane
									dashboard={app.dashboard}
									appInfo={app.appInfo}
									latestUpdateStatus={app.state.latestUpdateStatus}
									needsWorkspaceSetup={app.needsWorkspaceSetup}
									modelUnavailable={app.modelUnavailable}
									workspaceDrafts={app.state.workspaceDrafts}
									apiKeyProviders={app.apiKeyProviders}
									apiKeyDrafts={app.state.apiKeyDrafts}
									onAddWorkspace={() => void app.handleAddWorkspace()}
									onRefreshStatus={() => void app.refreshAppInfo()}
									onToggleSemanticSearch={(enabled) => void app.handleSetSemanticSearchEnabled(enabled)}
									onApiKeyDraftChange={app.setApiKeyDraft}
									onSaveApiKey={(provider) => void app.handleSaveApiKey(provider)}
									onRemoveApiKey={(provider) => void app.handleRemoveApiKey(provider)}
									onCheckForUpdates={() => void app.handleCheckForUpdates()}
									onDownloadUpdate={() => void app.handleDownloadUpdate()}
									onApplyUpdate={() => void app.handleApplyUpdate()}
									onWorkspaceAliasChange={app.setWorkspaceDraft}
									onSaveWorkspace={(workspace) => void app.handleSaveWorkspace(workspace)}
									onRemoveWorkspace={(workspaceId) => void app.handleRemoveWorkspace(workspaceId)}
								/>
							)}
						</main>
						{app.state.activeView === "chat" && (
							<ChatArtifactsRail
								activeChat={app.activeChat}
								onOpenArtifact={(artifactId, options) => void app.handleOpenArtifact(artifactId, options)}
							/>
						)}
					</div>
				</div>
			</div>
			{app.artifactModal && (
				<ArtifactModal
					artifact={app.artifactModal}
					onSaveTags={app.handleSaveArtifactTags}
					onClose={() => app.setArtifactModalId(null)}
				/>
			)}
			{app.updateDialogVersion && (
				<UpdateDialog
					version={app.updateDialogVersion}
					appInfo={app.appInfo}
					latestUpdateStatus={app.state.latestUpdateStatus}
					onDownload={() => void app.handleDownloadUpdate()}
					onApply={() => void app.handleApplyUpdate()}
					onDismiss={app.dismissUpdateDialog}
				/>
			)}
			<Toaster position="bottom-center" richColors closeButton />
		</>
	);
}

function App() {
	return (
		<AppErrorBoundary>
			<AppInner />
		</AppErrorBoundary>
	);
}

export default App;
