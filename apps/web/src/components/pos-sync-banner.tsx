"use client";

import { Button } from "@finopenpos/ui/components/button";

export function POSSyncBanner({
	isOnline,
	queueCount,
	onSync,
	queuedLabel,
}: {
	isOnline: boolean;
	queueCount: number;
	onSync: () => void;
	queuedLabel: string;
}) {
	return (
		<>
			{!isOnline && (
				<div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-blue-900 text-sm">
					Offline mode. Data disimpan lokal dulu.
				</div>
			)}
			{queueCount > 0 && (
				<div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 text-sm">
					<span>{queuedLabel}</span>
					<Button type="button" variant="outline" size="sm" onClick={onSync}>
						Sync now
					</Button>
				</div>
			)}
		</>
	);
}
