"use client";

import { Badge } from "@finopenpos/ui/components/badge";
import { Button } from "@finopenpos/ui/components/button";
import { Card, CardContent, CardHeader } from "@finopenpos/ui/components/card";
import {
	type Column,
	DataTable,
	TableActions,
} from "@finopenpos/ui/components/data-table";
import { Skeleton } from "@finopenpos/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { EyeIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import {
	listSyncQueue,
	readCachedServiceOrders,
	replaceCachedServiceOrders,
} from "@/lib/local-db/repo";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/router";
import { formatCurrency } from "@/lib/utils";

type ServiceOrder = RouterOutputs["serviceOrders"]["list"][number];

export default function ServicesPage() {
	const trpc = useTRPC();
	const {
		data: remoteServices = [],
		isLoading,
		error,
	} = useQuery(trpc.serviceOrders.list.queryOptions());
	const [cachedServices, setCachedServices] = useState<ServiceOrder[]>([]);
	const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());
	const hasCachedServices = cachedServices.length > 0;
	const services =
		(isLoading || error) && hasCachedServices ? cachedServices : remoteServices;
	const { data: serviceTypes = [] } = useQuery(
		trpc.serviceTypes.list.queryOptions(),
	);
	const t = useTranslations("services");
	const tc = useTranslations("common");
	const locale = useLocale();
	const isOnline = useOnlineStatus();
	const [search, setSearch] = useState("");

	useEffect(() => {
		void readCachedServiceOrders<ServiceOrder>().then(setCachedServices);
		void listSyncQueue().then((queue) => {
			setPendingIds(
				new Set(
					queue
						.filter(
							(item) =>
								item.entity === "serviceOrder" &&
								item.payload &&
								typeof item.payload === "object" &&
								"id" in item.payload,
						)
						.map((item) => Number((item.payload as { id: number }).id)),
				),
			);
		});
	}, []);

	useEffect(() => {
		// Hanya update cache kalau remote sudah selesai loading
		if (isLoading) return;
		setCachedServices(remoteServices);
		void replaceCachedServiceOrders(remoteServices);
	}, [remoteServices, isLoading]);

	const columns: Column<ServiceOrder>[] = [
		{
			key: "service_number",
			header: t("serviceNumber"),
			render: (row) => row.service_number ?? `#${row.id}`,
		},
		{
			key: "customer",
			header: t("customer"),
			render: (row) => row.customer?.name ?? "",
		},
		{
			key: "service_type",
			header: t("serviceType"),
			render: (row) =>
				serviceTypes.find((item) => item.value === row.service_type)?.name ??
				row.service_type,
		},
		{
			key: "status",
			header: tc("status"),
			render: (row) => (
				<div className="flex flex-wrap gap-2">
					<span>{t(`status_${row.status}` as never)}</span>
					{pendingIds.has(row.id) && <Badge variant="secondary">Pending</Badge>}
				</div>
			),
		},
		{
			key: "total_amount",
			header: tc("total"),
			render: (row) => formatCurrency(row.total_amount, locale),
		},
		{
			key: "estimated_done_at",
			header: t("estimatedDoneAt"),
			render: (row) =>
				row.estimated_done_at
					? new Date(row.estimated_done_at).toLocaleString(locale)
					: "—",
		},
		{
			key: "actions",
			header: tc("actions"),
			render: (row) => (
				<TableActions>
					<Link href={`/admin/services/${row.id}`}>
						<Button variant="ghost" size="icon">
							<EyeIcon className="h-4 w-4" />
							<span className="sr-only">{tc("view")}</span>
						</Button>
					</Link>
				</TableActions>
			),
		},
	];

	const filtered = useMemo(() => {
		const q = search.toLowerCase().trim();
		if (!q) return services;
		return services.filter((item) =>
			[item.service_number, item.customer?.name, item.status, item.service_type]
				.filter(Boolean)
				.some((value) => String(value).toLowerCase().includes(q)),
		);
	}, [services, search]);

	if (isLoading && !hasCachedServices)
		return <Skeleton className="h-96 w-full" />;

	return (
		<Card>
			<CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="font-bold text-2xl">{t("serviceOrders")}</h1>
					<p className="text-muted-foreground text-sm">{t("subtitle")}</p>
					{!isOnline && (
						<p className="text-amber-600 text-sm">
							Offline mode. Showing cached services.
						</p>
					)}
				</div>
				<div className="flex gap-2">
					<Link href="/admin/services/types">
						<Button variant="outline">Tipe Service</Button>
					</Link>
					<Link href="/admin/services/new">
						<Button>
							<PlusIcon className="mr-2 h-4 w-4" />
							{t("addService")}
						</Button>
					</Link>
				</div>
			</CardHeader>
			<CardContent>
				<div className="mb-4">
					<input
						className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder={t("searchPlaceholder")}
					/>
				</div>
				<DataTable
					data={filtered}
					columns={columns}
					mobileScroll
					onRowClick={(row) => {
						window.location.href = `/admin/services/${row.id}`;
					}}
					emptyMessage={t("noServices")}
				/>
			</CardContent>
		</Card>
	);
}
