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
	const isPlatformAdmin =
		(user.role === "super_admin" || user.role === "admin") &&
		user.status === "active";
	return (
		<AdminLayout isPlatformAdmin={isPlatformAdmin}>{children}</AdminLayout>
	);
}
