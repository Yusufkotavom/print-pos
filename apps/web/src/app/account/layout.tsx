import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth-guard";
import { MountainIcon } from "lucide-react";
import Link from "next/link";
import { LocaleSwitcher } from "@/components/locale-switcher";

export default async function Layout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const user = await getAuthUser();
	if (!user) {
		redirect("/login");
	}
	return (
		<div className="flex min-h-screen flex-col bg-muted/20">
			<header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
				<div className="flex items-center gap-2 font-semibold">
					<MountainIcon className="h-6 w-6" />
					<span>FinOpenPOS</span>
				</div>
				<div className="ml-auto flex items-center gap-4">
					<LocaleSwitcher />
					<Link href="/admin" className="text-sm font-medium hover:underline text-primary">
						Back to App
					</Link>
				</div>
			</header>
			<main className="flex-1 p-4 md:p-8">
				{children}
			</main>
		</div>
	);
}
