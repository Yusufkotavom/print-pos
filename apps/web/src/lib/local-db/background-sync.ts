export const SYNC_TAG = "finopenpos-sync-queue";
export const SYNC_MESSAGE = "FINOPENPOS_SYNC_QUEUE";

export async function requestBackgroundSync() {
	if (typeof navigator === "undefined" || !("serviceWorker" in navigator))
		return;
	try {
		const registration = await navigator.serviceWorker.ready;
		const syncRegistration = registration as ServiceWorkerRegistration & {
			sync?: { register: (tag: string) => Promise<void> };
		};
		if (syncRegistration.sync) {
			await syncRegistration.sync.register(SYNC_TAG);
			return;
		}
		if (navigator.onLine) {
			registration.active?.postMessage({ type: SYNC_MESSAGE });
			navigator.serviceWorker.controller?.postMessage({ type: SYNC_MESSAGE });
		}
	} catch {}
}
