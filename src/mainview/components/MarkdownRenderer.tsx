import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github-dark-dimmed.css";
import MermaidBlock from "./MermaidBlock";
import { openExternalViaBun } from "../rpc";

function isMermaid(className: string | undefined): boolean {
	return /\blanguage-mermaid\b/.test(className || "");
}

export default function MarkdownRenderer({ content, className }: { content: string; className?: string }) {
	return (
		<div className={className}>
			<ReactMarkdown
				remarkPlugins={[remarkGfm, remarkMath]}
				rehypePlugins={[
					[rehypeHighlight, { ignoreMissing: true, plainText: ["mermaid"] }],
					rehypeKatex,
				]}
				components={{
					a({ href, children, ...props }) {
						return (
							<a
								href={href}
								{...props}
								onClick={(e) => {
									if (href) {
										e.preventDefault();
										openExternalViaBun(href);
									}
								}}
							>
								{children}
							</a>
						);
					},
					pre({ children, ...props }) {
						const child = Array.isArray(children) ? children[0] : children;
						if (
							child &&
							typeof child === "object" &&
							"props" in child &&
							isMermaid((child as any).props?.className)
						) {
							const code = String((child as any).props?.children ?? "").replace(/\n$/, "");
							return <MermaidBlock code={code} />;
						}
						return <pre {...props}>{children}</pre>;
					},
					code({ className, children, ...props }) {
						if (isMermaid(className)) {
							return (
								<MermaidBlock
									code={String(children).replace(/\n$/, "")}
								/>
							);
						}
						return (
							<code className={className} {...props}>
								{children}
							</code>
						);
					},
				}}
			>
				{content}
			</ReactMarkdown>
		</div>
	);
}
