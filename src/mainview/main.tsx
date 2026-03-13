import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { AppShellProvider } from "./app-shell";
import { PiworkQueryProvider } from "./query-client";

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<PiworkQueryProvider>
			<AppShellProvider>
				<App />
			</AppShellProvider>
		</PiworkQueryProvider>
	</StrictMode>,
);
