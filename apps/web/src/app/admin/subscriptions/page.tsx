"use client";

import { Badge } from "@finopenpos/ui/components/badge";
import { Button } from "@finopenpos/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@finopenpos/ui/components/card";
import {
	type Column,
	DataTable,
	TableActionButton,
	TableActions,
} from "@finopenpos/ui/components/data-table";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@finopenpos/ui/components/dialog";
import { Input } from "@finopenpos/ui/components/input";
import { Label } from "@finopenpos/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@finopenpos/ui/components/select";
import { Skeleton } from "@finopenpos/ui/components/skeleton";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import {
	CirclePauseIcon,
	CirclePlayIcon,
	ClockPlusIcon,
	CreditCardIcon,
	FilePenIcon,
	PlusCircle,
	TrashIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { z } from "zod/v4";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { useCrudMutation } from "@/hooks/use-crud-mutation";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/router";

type Plan = RouterOutputs["platformSubscriptions"]["listPlans"][number];
type Subscription =
	RouterOutputs["platformSubscriptions"]["listSubscriptions"][number];
type SubscriptionStatus = "active" | "paused" | "expired" | "cancelled";

const toDateTimeInput = (date: Date) => date.toISOString().slice(0, 16);
const addDays = (date: Date, days: number) => {
	const result = new Date(date);
	result.setDate(result.getDate() + days);
	return result;
};
const daysLeft = (date: Date) =>
	Math.max(0, Math.ceil((date.getTime() - Date.now()) / 86_400_000));

export default function AdminSubscriptionsPage() {
	const trpc = useTRPC();
	const t = useTranslations("platformSubscriptions");
	const tc = useTranslations("common");
	const plansQuery = useQuery(
		trpc.platformSubscriptions.listPlans.queryOptions(),
	);
	const subscriptionsQuery = useQuery(
		trpc.platformSubscriptions.listSubscriptions.queryOptions(),
	);
	const usersQuery = useQuery(
		trpc.platformSubscriptions.listUsers.queryOptions(),
	);
	const plans = plansQuery.data ?? [];
	const subscriptions = subscriptionsQuery.data ?? [];
	const users = usersQuery.data ?? [];
	const planInvalidateKeys =
		trpc.platformSubscriptions.listPlans.queryOptions().queryKey;
	const subscriptionInvalidateKeys =
		trpc.platformSubscriptions.listSubscriptions.queryOptions().queryKey;
	const [isPlanOpen, setIsPlanOpen] = useState(false);
	const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false);
	const [planDeleteId, setPlanDeleteId] = useState<number | null>(null);
	const [subscriptionDeleteId, setSubscriptionDeleteId] = useState<
		number | null
	>(null);
	const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
	const [editingSubscription, setEditingSubscription] =
		useState<Subscription | null>(null);

	const planFormSchema = z.object({
		name: z.string().min(1),
		price: z.number().int().min(0),
		interval: z.enum(["month", "year", "lifetime"]),
		status: z.enum(["active", "inactive", "archived"]),
	});
	const subscriptionFormSchema = z.object({
		userId: z.string().min(1),
		planId: z.string(),
		status: z.enum(["active", "paused", "expired", "cancelled"]),
		currentPeriodStart: z.string().min(1),
		currentPeriodEnd: z.string().min(1),
	});

	const createPlanMutation = useCrudMutation({
		mutationOptions: trpc.platformSubscriptions.createPlan.mutationOptions(),
		invalidateKeys: planInvalidateKeys,
		successMessage: t("planCreated"),
		errorMessage: t("planError"),
		onSuccess: () => setIsPlanOpen(false),
	});
	const updatePlanMutation = useCrudMutation({
		mutationOptions: trpc.platformSubscriptions.updatePlan.mutationOptions(),
		invalidateKeys: planInvalidateKeys,
		successMessage: t("planUpdated"),
		errorMessage: t("planError"),
		onSuccess: () => setIsPlanOpen(false),
	});
	const deletePlanMutation = useCrudMutation({
		mutationOptions: trpc.platformSubscriptions.deletePlan.mutationOptions(),
		invalidateKeys: planInvalidateKeys,
		successMessage: t("planDeleted"),
		errorMessage: t("planError"),
	});
	const createSubscriptionMutation = useCrudMutation({
		mutationOptions:
			trpc.platformSubscriptions.createSubscription.mutationOptions(),
		invalidateKeys: subscriptionInvalidateKeys,
		successMessage: t("subscriptionCreated"),
		errorMessage: t("subscriptionError"),
		onSuccess: () => setIsSubscriptionOpen(false),
	});
	const updateSubscriptionMutation = useCrudMutation({
		mutationOptions:
			trpc.platformSubscriptions.updateSubscription.mutationOptions(),
		invalidateKeys: subscriptionInvalidateKeys,
		successMessage: t("subscriptionUpdated"),
		errorMessage: t("subscriptionError"),
		onSuccess: () => setIsSubscriptionOpen(false),
	});
	const deleteSubscriptionMutation = useCrudMutation({
		mutationOptions:
			trpc.platformSubscriptions.deleteSubscription.mutationOptions(),
		invalidateKeys: subscriptionInvalidateKeys,
		successMessage: t("subscriptionDeleted"),
		errorMessage: t("subscriptionError"),
	});
	const pauseSubscriptionMutation = useCrudMutation({
		mutationOptions:
			trpc.platformSubscriptions.pauseSubscription.mutationOptions(),
		invalidateKeys: subscriptionInvalidateKeys,
		successMessage: t("subscriptionPaused"),
		errorMessage: t("subscriptionError"),
	});
	const resumeSubscriptionMutation = useCrudMutation({
		mutationOptions:
			trpc.platformSubscriptions.resumeSubscription.mutationOptions(),
		invalidateKeys: subscriptionInvalidateKeys,
		successMessage: t("subscriptionResumed"),
		errorMessage: t("subscriptionError"),
	});
	const extendSubscriptionMutation = useCrudMutation({
		mutationOptions:
			trpc.platformSubscriptions.extendSubscription.mutationOptions(),
		invalidateKeys: subscriptionInvalidateKeys,
		successMessage: t("subscriptionExtended"),
		errorMessage: t("subscriptionError"),
	});

	const planForm = useForm({
		defaultValues: {
			name: "",
			price: 0,
			interval: "month" as "month" | "year" | "lifetime",
			status: "active" as "active" | "inactive" | "archived",
		},
		validators: { onSubmit: planFormSchema },
		onSubmit: ({ value }) => {
			const payload = { ...value, features: ["Unlimited access"] };
			if (editingPlan)
				updatePlanMutation.mutate({ id: editingPlan.id, ...payload });
			else createPlanMutation.mutate(payload);
		},
	});

	const subscriptionForm = useForm({
		defaultValues: {
			userId: "",
			planId: "none",
			status: "active" as SubscriptionStatus,
			currentPeriodStart: "",
			currentPeriodEnd: "",
		},
		validators: { onSubmit: subscriptionFormSchema },
		onSubmit: ({ value }) => {
			const payload = {
				userId: value.userId,
				planId: value.planId === "none" ? null : Number(value.planId),
				status: value.status,
				currentPeriodStart: new Date(value.currentPeriodStart),
				currentPeriodEnd: new Date(value.currentPeriodEnd),
				cancelAtPeriodEnd: false,
				cancelledAt: null,
			};
			if (editingSubscription)
				updateSubscriptionMutation.mutate({
					id: editingSubscription.id,
					...payload,
				});
			else createSubscriptionMutation.mutate(payload);
		},
	});

	const openNewSubscription = () => {
		const now = new Date();
		setEditingSubscription(null);
		subscriptionForm.reset();
		subscriptionForm.setFieldValue("status", "active");
		subscriptionForm.setFieldValue("currentPeriodStart", toDateTimeInput(now));
		subscriptionForm.setFieldValue(
			"currentPeriodEnd",
			toDateTimeInput(addDays(now, 30)),
		);
		setIsSubscriptionOpen(true);
	};

	const planColumns: Column<Plan>[] = [
		{ key: "name", header: tc("name"), sortable: true },
		{ key: "price", header: tc("price"), render: (row) => String(row.price) },
		{ key: "interval", header: t("interval") },
		{ key: "status", header: tc("status") },
		{
			key: "features",
			header: t("access"),
			render: () => t("unlimitedAccess"),
		},
		{
			key: "actions",
			header: tc("actions"),
			render: (row) => (
				<TableActions>
					<TableActionButton
						onClick={() => {
							setEditingPlan(row);
							planForm.reset();
							planForm.setFieldValue("name", row.name);
							planForm.setFieldValue("price", row.price);
							planForm.setFieldValue(
								"interval",
								row.interval as "month" | "year" | "lifetime",
							);
							planForm.setFieldValue(
								"status",
								row.status as "active" | "inactive" | "archived",
							);
							setIsPlanOpen(true);
						}}
						icon={<FilePenIcon className="h-4 w-4" />}
						label={tc("edit")}
					/>
					<TableActionButton
						variant="danger"
						onClick={() => setPlanDeleteId(row.id)}
						icon={<TrashIcon className="h-4 w-4" />}
						label={tc("delete")}
					/>
				</TableActions>
			),
		},
	];

	const subscriptionColumns: Column<Subscription>[] = useMemo(
		() => [
			{
				key: "user",
				header: t("user"),
				render: (row) => `${row.user.name} (${row.user.email})`,
			},
			{
				key: "plan",
				header: t("plan"),
				render: (row) => row.plan?.name ?? t("noPlan"),
			},
			{
				key: "status",
				header: tc("status"),
				render: (row) => (
					<Badge variant="secondary">{t(row.status as never)}</Badge>
				),
			},
			{
				key: "currentPeriodEnd",
				header: t("periodEnd"),
				render: (row) => row.currentPeriodEnd.toLocaleDateString(),
			},
			{
				key: "daysLeft",
				header: t("daysLeft"),
				render: (row) => String(daysLeft(row.currentPeriodEnd)),
			},
			{
				key: "actions",
				header: tc("actions"),
				render: (row) => (
					<TableActions>
						<TableActionButton
							onClick={() => {
								setEditingSubscription(row);
								subscriptionForm.reset();
								subscriptionForm.setFieldValue("userId", row.userId);
								subscriptionForm.setFieldValue(
									"planId",
									row.planId ? String(row.planId) : "none",
								);
								subscriptionForm.setFieldValue(
									"status",
									row.status as SubscriptionStatus,
								);
								subscriptionForm.setFieldValue(
									"currentPeriodStart",
									toDateTimeInput(row.currentPeriodStart),
								);
								subscriptionForm.setFieldValue(
									"currentPeriodEnd",
									toDateTimeInput(row.currentPeriodEnd),
								);
								setIsSubscriptionOpen(true);
							}}
							icon={<FilePenIcon className="h-4 w-4" />}
							label={tc("edit")}
						/>
						<TableActionButton
							onClick={() =>
								row.status === "paused"
									? resumeSubscriptionMutation.mutate({ id: row.id })
									: pauseSubscriptionMutation.mutate({ id: row.id })
							}
							icon={
								row.status === "paused" ? (
									<CirclePlayIcon className="h-4 w-4" />
								) : (
									<CirclePauseIcon className="h-4 w-4" />
								)
							}
							label={row.status === "paused" ? t("resume") : t("pause")}
						/>
						<TableActionButton
							onClick={() =>
								extendSubscriptionMutation.mutate({ id: row.id, days: 30 })
							}
							icon={<ClockPlusIcon className="h-4 w-4" />}
							label={t("extend30Days")}
						/>
						<TableActionButton
							variant="danger"
							onClick={() => setSubscriptionDeleteId(row.id)}
							icon={<TrashIcon className="h-4 w-4" />}
							label={tc("delete")}
						/>
					</TableActions>
				),
			},
		],
		[
			extendSubscriptionMutation,
			pauseSubscriptionMutation,
			resumeSubscriptionMutation,
			subscriptionForm,
			t,
			tc,
		],
	);

	if (
		plansQuery.isLoading ||
		subscriptionsQuery.isLoading ||
		usersQuery.isLoading
	)
		return (
			<Card className="p-6">
				<Skeleton className="h-64 w-full" />
			</Card>
		);
	if (plansQuery.error || subscriptionsQuery.error || usersQuery.error)
		return (
			<Card>
				<CardContent>
					<p className="text-red-500">
						{plansQuery.error?.message ??
							subscriptionsQuery.error?.message ??
							usersQuery.error?.message}
					</p>
				</CardContent>
			</Card>
		);

	return (
		<div className="grid gap-6">
			<Card className="p-3 sm:p-6">
				<CardHeader className="flex flex-row items-center justify-between p-0">
					<CardTitle>{t("plans")}</CardTitle>
					<Button
						size="sm"
						onClick={() => {
							setEditingPlan(null);
							planForm.reset();
							setIsPlanOpen(true);
						}}
					>
						<PlusCircle className="mr-2 h-4 w-4" />
						{t("addPlan")}
					</Button>
				</CardHeader>
				<CardContent className="p-0 pt-4">
					<DataTable
						data={plans}
						columns={planColumns}
						emptyMessage={t("noPlans")}
						emptyIcon={<CreditCardIcon className="h-8 w-8" />}
					/>
				</CardContent>
			</Card>
			<Card className="p-3 sm:p-6">
				<CardHeader className="flex flex-row items-center justify-between p-0">
					<CardTitle>{t("subscriptions")}</CardTitle>
					<Button size="sm" onClick={openNewSubscription}>
						<PlusCircle className="mr-2 h-4 w-4" />
						{t("addSubscription")}
					</Button>
				</CardHeader>
				<CardContent className="p-0 pt-4">
					<DataTable
						data={subscriptions}
						columns={subscriptionColumns}
						emptyMessage={t("noSubscriptions")}
						emptyIcon={<CreditCardIcon className="h-8 w-8" />}
						mobileScroll
					/>
				</CardContent>
			</Card>
			<Dialog open={isPlanOpen} onOpenChange={setIsPlanOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{editingPlan ? t("editPlan") : t("addPlan")}
						</DialogTitle>
					</DialogHeader>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							e.stopPropagation();
							planForm.handleSubmit();
						}}
					>
						<div className="grid gap-4 py-4">
							<planForm.Field name="name">
								{(field) => (
									<div className="grid gap-2">
										<Label>{tc("name")}</Label>
										<Input
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
										/>
									</div>
								)}
							</planForm.Field>
							<planForm.Field name="price">
								{(field) => (
									<div className="grid gap-2">
										<Label>{tc("price")}</Label>
										<Input
											type="number"
											value={String(field.state.value)}
											onChange={(e) =>
												field.handleChange(Number(e.target.value))
											}
										/>
									</div>
								)}
							</planForm.Field>
							<planForm.Field name="interval">
								{(field) => (
									<div className="grid gap-2">
										<Label>{t("interval")}</Label>
										<Select
											value={field.state.value}
											onValueChange={(value) =>
												field.handleChange(
													value as "month" | "year" | "lifetime",
												)
											}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="month">month</SelectItem>
												<SelectItem value="year">year</SelectItem>
												<SelectItem value="lifetime">lifetime</SelectItem>
											</SelectContent>
										</Select>
									</div>
								)}
							</planForm.Field>
							<planForm.Field name="status">
								{(field) => (
									<div className="grid gap-2">
										<Label>{tc("status")}</Label>
										<Select
											value={field.state.value}
											onValueChange={(value) =>
												field.handleChange(
													value as "active" | "inactive" | "archived",
												)
											}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="active">active</SelectItem>
												<SelectItem value="inactive">inactive</SelectItem>
												<SelectItem value="archived">archived</SelectItem>
											</SelectContent>
										</Select>
									</div>
								)}
							</planForm.Field>
							<p className="text-muted-foreground text-sm">
								{t("unlimitedAccess")}
							</p>
						</div>
						<DialogFooter>
							<Button variant="secondary" onClick={() => setIsPlanOpen(false)}>
								{tc("cancel")}
							</Button>
							<Button type="submit">{tc("save")}</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
			<Dialog open={isSubscriptionOpen} onOpenChange={setIsSubscriptionOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{editingSubscription
								? t("editSubscription")
								: t("addSubscription")}
						</DialogTitle>
					</DialogHeader>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							e.stopPropagation();
							subscriptionForm.handleSubmit();
						}}
					>
						<div className="grid gap-4 py-4">
							<subscriptionForm.Field name="userId">
								{(field) => (
									<div className="grid gap-2">
										<Label>{t("user")}</Label>
										<Select
											value={field.state.value}
											onValueChange={field.handleChange}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{users.map((item) => (
													<SelectItem key={item.id} value={item.id}>
														{item.name} ({item.email})
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								)}
							</subscriptionForm.Field>
							<subscriptionForm.Field name="planId">
								{(field) => (
									<div className="grid gap-2">
										<Label>{t("plan")}</Label>
										<Select
											value={field.state.value}
											onValueChange={field.handleChange}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="none">{t("noPlan")}</SelectItem>
												{plans.map((item) => (
													<SelectItem key={item.id} value={String(item.id)}>
														{item.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								)}
							</subscriptionForm.Field>
							<subscriptionForm.Field name="status">
								{(field) => (
									<div className="grid gap-2">
										<Label>{tc("status")}</Label>
										<Select
											value={field.state.value}
											onValueChange={(value) =>
												field.handleChange(value as SubscriptionStatus)
											}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="active">{t("active")}</SelectItem>
												<SelectItem value="paused">{t("paused")}</SelectItem>
												<SelectItem value="expired">{t("expired")}</SelectItem>
												<SelectItem value="cancelled">
													{t("cancelled")}
												</SelectItem>
											</SelectContent>
										</Select>
									</div>
								)}
							</subscriptionForm.Field>
							<subscriptionForm.Field name="currentPeriodStart">
								{(field) => (
									<div className="grid gap-2">
										<Label>{t("periodStart")}</Label>
										<Input
											type="datetime-local"
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
										/>
									</div>
								)}
							</subscriptionForm.Field>
							<subscriptionForm.Field name="currentPeriodEnd">
								{(field) => (
									<div className="grid gap-2">
										<Label>{t("periodEnd")}</Label>
										<Input
											type="datetime-local"
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
										/>
									</div>
								)}
							</subscriptionForm.Field>
						</div>
						<DialogFooter>
							<Button
								variant="secondary"
								onClick={() => setIsSubscriptionOpen(false)}
							>
								{tc("cancel")}
							</Button>
							<Button type="submit">{tc("save")}</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
			<DeleteConfirmationDialog
				open={planDeleteId !== null}
				onOpenChange={(open) => {
					if (!open) setPlanDeleteId(null);
				}}
				onConfirm={() => {
					if (planDeleteId !== null)
						deletePlanMutation.mutate({ id: planDeleteId });
					setPlanDeleteId(null);
				}}
				description={t("deletePlanMessage")}
			/>
			<DeleteConfirmationDialog
				open={subscriptionDeleteId !== null}
				onOpenChange={(open) => {
					if (!open) setSubscriptionDeleteId(null);
				}}
				onConfirm={() => {
					if (subscriptionDeleteId !== null)
						deleteSubscriptionMutation.mutate({ id: subscriptionDeleteId });
					setSubscriptionDeleteId(null);
				}}
				description={t("deleteSubscriptionMessage")}
			/>
		</div>
	);
}
