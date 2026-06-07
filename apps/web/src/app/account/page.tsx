import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { subscriptions, plans } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@finopenpos/ui/components/card";
import { Badge } from "@finopenpos/ui/components/badge";
import { AccountForm } from "./account-form";
import { format } from "date-fns";

export default async function AccountPage() {
	const user = await getAuthUser();
	if (!user) {
		redirect("/login");
	}

	// Fetch the most recent subscription, regardless of status
	const latestSubscription = await db.query.subscriptions.findFirst({
		where: eq(subscriptions.userId, user.id),
		orderBy: desc(subscriptions.currentPeriodEnd),
		with: {
			plan: true,
		},
	});

	const isExpired = latestSubscription
		? latestSubscription.status !== "active" ||
		  latestSubscription.currentPeriodEnd < new Date()
		: true;

	return (
		<div className="mx-auto max-w-4xl space-y-8">
			<div>
				<h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
				<p className="text-muted-foreground">
					Manage your account settings and subscription preferences.
				</p>
			</div>

			<div className="grid gap-8 md:grid-cols-2">
				<div className="space-y-6">
					<AccountForm user={{ id: user.id, name: user.name, email: user.email }} />
				</div>

				<div className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>Subscription Status</CardTitle>
							<CardDescription>View your current plan and expiration date.</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{latestSubscription && latestSubscription.plan ? (
								<div className="rounded-lg border p-4 space-y-3">
									<div className="flex items-center justify-between">
										<div className="font-semibold text-lg">{latestSubscription.plan.name} Plan</div>
										<Badge variant={isExpired ? "destructive" : "default"}>
											{isExpired ? "Expired" : "Active"}
										</Badge>
									</div>
									<div className="text-sm text-muted-foreground grid gap-1">
										<div className="flex justify-between">
											<span>Status:</span>
											<span className="font-medium text-foreground capitalize">{latestSubscription.status}</span>
										</div>
										<div className="flex justify-between">
											<span>Valid Until:</span>
											<span className="font-medium text-foreground">
												{format(latestSubscription.currentPeriodEnd, "PPP")}
											</span>
										</div>
									</div>
									
									{isExpired && (
										<div className="mt-4 text-sm text-red-500 bg-red-500/10 p-3 rounded-md">
											Your subscription has expired. Please contact the administrator to renew your plan and regain access to the application.
										</div>
									)}
								</div>
							) : (
								<div className="text-sm text-muted-foreground">
									You do not have any active subscriptions.
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
