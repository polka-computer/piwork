import { useEffect, useId, useRef, useState } from "react";
import mermaid from "mermaid";

let initialized = false;

function ensureInit() {
	if (initialized) return;
	initialized = true;
	mermaid.initialize({
		startOnLoad: false,
		theme: "dark",
		themeVariables: {
			primaryColor: "#1a1625",
			primaryTextColor: "#e2dff0",
			primaryBorderColor: "#3a3550",
			lineColor: "#5a5575",
			secondaryColor: "#141020",
			tertiaryColor: "#100d1a",
		},
	});
}

export default function MermaidBlock({ code }: { code: string }) {
	const id = useId().replace(/:/g, "_");
	const containerRef = useRef<HTMLDivElement>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		ensureInit();
		let cancelled = false;

		(async () => {
			try {
				const { svg } = await mermaid.render(`mermaid${id}`, code);
				if (!cancelled && containerRef.current) {
					containerRef.current.innerHTML = svg;
					setError(null);
				}
			} catch (err) {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : String(err));
					// mermaid leaves a broken element in the DOM — clean it up
					document.getElementById(`dmermaid${id}`)?.remove();
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [code, id]);

	if (error) {
		return (
			<div className="mermaid-container mermaid-error">
				<pre>{code}</pre>
			</div>
		);
	}

	return <div className="mermaid-container" ref={containerRef} />;
}
