import Link from "next/link";

export default function OfflinePage() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-background p-6">
			<div className="w-full max-w-md rounded-xl border bg-card p-6 text-center">
				<h1 className="mb-2 font-semibold text-2xl">Offline</h1>
				<p className="mb-4 text-muted-foreground text-sm">
					Koneksi putus. Draft dan data cache tetap bisa dipakai.
				</p>
				<Link className="text-primary text-sm underline" href="/admin/pos">
					Buka POS
				</Link>
			</div>
		</div>
	);
}
