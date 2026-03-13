import { ApplicationMenu } from "electrobun/bun";

export const installApplicationMenu = (appName: string): void => {
	ApplicationMenu.setApplicationMenu([
		{
			label: appName,
			submenu: [
				{ label: `Quit ${appName}`, role: "quit", accelerator: "CommandOrControl+Q" },
			],
		},
		{
			label: "Edit",
			submenu: [
				{ label: "Undo", role: "undo" },
				{ label: "Redo", role: "redo" },
				{ type: "separator" },
				{ label: "Cut", role: "cut" },
				{ label: "Copy", role: "copy" },
				{ label: "Paste", role: "paste" },
				{ label: "Select All", role: "selectAll" },
			],
		},
		{
			label: "Window",
			submenu: [
				{ label: "Minimize", role: "minimize" },
				{ label: "Zoom", role: "zoom" },
				{ type: "separator" },
				{ label: "Bring All to Front", role: "front" },
			],
		},
		{
			label: "View",
			submenu: [
				{ label: "Toggle Full Screen", role: "togglefullscreen" },
			],
		},
	]);
};
