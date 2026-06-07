import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth-guard";

export default async function Layout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const user = await getAuthUser();
	if (!user) redirect("/login");
	if (!user.isPlatformAdmin) redirect("/admin");
	return children;
}
