import { useEffect, useState } from "react";
import type { ArtifactDetail } from "../../shared/view-rpc";

export default function ArtifactTagEditor({
	artifact,
	onSave,
	compact = false,
}: {
	artifact: ArtifactDetail;
	onSave: (artifactId: string, tags: string[]) => Promise<void>;
	compact?: boolean;
}) {
	const [tags, setTags] = useState<string[]>(artifact.tags);
	const [draft, setDraft] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [savedTags, setSavedTags] = useState<string[]>(artifact.tags);

	useEffect(() => {
		setTags(artifact.tags);
		setSavedTags(artifact.tags);
		setDraft("");
		setIsSaving(false);
	}, [artifact.id, artifact.tags]);

	const normalizeSingleTag = (value: string): string =>
		value.trim().toLowerCase().replace(/^#+/, "").replace(/\s+/g, "-");

	const normalizeTags = (values: string[]) =>
		Array.from(new Set(values.map(normalizeSingleTag).filter(Boolean))).sort((left, right) =>
			left.localeCompare(right),
		);

	const normalizedTags = normalizeTags(tags);
	const savedNormalizedTags = normalizeTags(savedTags);

	const persistTags = async (nextTags: string[]) => {
		const normalizedNextTags = normalizeTags(nextTags);
		setTags(normalizedNextTags);
		if (JSON.stringify(normalizedNextTags) === JSON.stringify(savedNormalizedTags)) return;
		setIsSaving(true);
		try {
			await onSave(artifact.id, normalizedNextTags);
			setSavedTags(normalizedNextTags);
		} finally {
			setIsSaving(false);
		}
	};

	const commitDraft = () => {
		const additions = draft
			.split(",")
			.map(normalizeSingleTag)
			.filter(Boolean);
		if (additions.length === 0) {
			setDraft("");
			return;
		}
		setDraft("");
		void persistTags([...normalizedTags, ...additions]);
	};

	const removeTag = (tagToRemove: string) => {
		void persistTags(normalizedTags.filter((tag) => tag !== tagToRemove));
	};

	if (compact) {
		return (
			<div className="artifact-tag-editor-inline">
				<div className="artifact-tag-strip">
					{normalizedTags.map((tag) => (
						<span key={tag} className="artifact-tag artifact-tag-editable">
							<span>#{tag}</span>
							<button
								type="button"
								onClick={() => removeTag(tag)}
								className="artifact-tag-remove"
								aria-label={`Remove ${tag}`}
							>
								×
							</button>
						</span>
					))}
					<label className="artifact-tag-input-chip">
						<input
							value={draft}
							onChange={(event) => setDraft(event.target.value)}
							onKeyDown={(event) => {
								if ((event.key === "Enter" || event.key === ",") && draft.trim()) {
									event.preventDefault();
									commitDraft();
								}
								if (event.key === "Backspace" && !draft && normalizedTags.length > 0) {
									removeTag(normalizedTags[normalizedTags.length - 1]!);
								}
							}}
							onBlur={() => {
								if (draft.trim()) commitDraft();
							}}
							placeholder="+ tag"
							className="artifact-tag-input"
						/>
					</label>
				</div>
				{isSaving && <span className="text-[9px] text-[var(--text-dim)]">Saving</span>}
			</div>
		);
	}

	return (
		<div className="mb-3 border-b border-white/6 pb-3">
			<div className="mb-2 flex items-center gap-2">
				<span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-dim)]">Tags</span>
				{isSaving && <span className="text-[10px] text-[var(--text-dim)]">Saving</span>}
			</div>
			<div className="flex flex-wrap items-center gap-1.5">
				{normalizedTags.map((tag) => (
					<span key={tag} className="artifact-tag artifact-tag-editable">
						<span>#{tag}</span>
						<button
							type="button"
							onClick={() => removeTag(tag)}
							className="artifact-tag-remove"
							aria-label={`Remove ${tag}`}
						>
							×
						</button>
					</span>
				))}
				<label className="artifact-tag-input-chip artifact-tag-input-chip-wide">
					<input
						value={draft}
						onChange={(event) => setDraft(event.target.value)}
						onKeyDown={(event) => {
							if ((event.key === "Enter" || event.key === ",") && draft.trim()) {
								event.preventDefault();
								commitDraft();
							}
							if (event.key === "Backspace" && !draft && normalizedTags.length > 0) {
								removeTag(normalizedTags[normalizedTags.length - 1]!);
							}
						}}
						onBlur={() => {
							if (draft.trim()) commitDraft();
						}}
						placeholder="Add tag"
						className="artifact-tag-input"
					/>
				</label>
			</div>
		</div>
	);
}
