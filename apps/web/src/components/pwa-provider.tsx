"use client";

import { Button } from "@finopenpos/ui/components/button";
import { XIcon } from "lucide-react";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PWAProvider() {
	const [deferredPrompt, setDeferredPrompt] =
		useState<BeforeInstallPromptEvent | null>(null);
	const [dismissed, setDismissed] = useState(false);

	useEffect(() => {
		setDismissed(
			localStorage.getItem("finopenpos:pwa-install-dismissed") === "1",
		);
	}, []);

	useEffect(() => {
		if (!("serviceWorker" in navigator)) return;
		void navigator.serviceWorker.register("/sw.js");
		const handleBeforeInstallPrompt = (event: Event) => {
			event.preventDefault();
			if (!dismissed) setDeferredPrompt(event as BeforeInstallPromptEvent);
		};
		window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
		return () =>
			window.removeEventListener(
				"beforeinstallprompt",
				handleBeforeInstallPrompt,
			);
	}, [dismissed]);

	if (!deferredPrompt || dismissed) return null;

	return (
		<div className="fixed right-4 bottom-4 z-50 rounded-lg border bg-background p-3 shadow-lg">
			<div className="mb-2 flex items-center justify-between gap-3">
				<div className="text-sm">Install FinOpenPOS app</div>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="h-7 w-7"
					onClick={() => {
						localStorage.setItem("finopenpos:pwa-install-dismissed", "1");
						setDismissed(true);
						setDeferredPrompt(null);
					}}
				>
					<XIcon className="h-4 w-4" />
				</Button>
			</div>
			<Button
				type="button"
				size="sm"
				onClick={async () => {
					await deferredPrompt.prompt();
					await deferredPrompt.userChoice;
					setDeferredPrompt(null);
				}}
			>
				Install
			</Button>
		</div>
	);
}
