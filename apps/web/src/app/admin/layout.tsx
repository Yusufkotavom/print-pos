import { redirect } from "next/navigation";
import { AdminLayout } from "@/components/admin-layout";
import { getAuthUser } from "@/lib/auth-guard";

export default async function Layout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const user = await getAuthUser();
	if (!user) {
		redirect("/login");
	}
	if (user.status !== "active") {
		redirect("/login");
	}
	if (!user.isPlatformAdmin && !user.hasActiveSubscription) {
		redirect("/account");
	}
	const isPlatformAdmin = user.isPlatformAdmin && user.status === "active";
	return (
		<AdminLayout isPlatformAdmin={isPlatformAdmin}>{children}</AdminLayout>
	);
}
