"use client";

import { Button } from "@finopenpos/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@finopenpos/ui/components/dropdown-menu";
import { TooltipProvider } from "@finopenpos/ui/components/tooltip";
import {
	ChevronDownIcon,
	CreditCardIcon,
	DollarSignIcon,
	FileBarChartIcon,
	FolderTreeIcon,
	LayoutDashboardIcon,
	type LucideIcon,
	MenuIcon,
	Package2Icon,
	PackageIcon,
	SettingsIcon,
	ShoppingBagIcon,
	ShoppingCartIcon,
	UsersIcon,
	WrenchIcon,
	XIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { logout } from "@/app/login/actions";
import { LocaleSwitcher } from "@/components/locale-switcher";

interface NavItem {
	href: string;
	labelKey:
		| "dashboard"
		| "cashier"
		| "transactionList"
		| "products"
		| "productCategories"
		| "categories"
		| "customers"
		| "serviceTypes"
		| "orders"
		| "services"
		| "financialReports"
		| "incomeStatement"
		| "balanceSheet"
		| "paymentMethods"
		| "pos"
		| "companySettings";
	icon: LucideIcon;
	children?: NavItem[];
}

const navItems: NavItem[] = [
	{ href: "/admin", labelKey: "dashboard", icon: LayoutDashboardIcon },
	{ href: "/admin/pos", labelKey: "pos", icon: ShoppingCartIcon },
	{ href: "/admin/orders", labelKey: "orders", icon: ShoppingBagIcon },
	{ href: "/admin/services", labelKey: "services", icon: WrenchIcon },
	{
		href: "/admin/cashier",
		labelKey: "cashier",
		icon: DollarSignIcon,
		children: [
			{
				href: "/admin/cashier",
				labelKey: "transactionList",
				icon: DollarSignIcon,
			},
			{
				href: "/admin/cashier/categories",
				labelKey: "categories",
				icon: FolderTreeIcon,
			},
		],
	},
	{
		href: "/admin/products",
		labelKey: "products",
		icon: PackageIcon,
		children: [
			{ href: "/admin/products", labelKey: "products", icon: PackageIcon },
			{
				href: "/admin/products/categories",
				labelKey: "productCategories",
				icon: FolderTreeIcon,
			},
		],
	},
	{
		href: "/admin/services",
		labelKey: "services",
		icon: WrenchIcon,
		children: [
			{
				href: "/admin/services/types",
				labelKey: "serviceTypes",
				icon: WrenchIcon,
			},
		],
	},
	{ href: "/admin/customers", labelKey: "customers", icon: UsersIcon },
	{
		href: "/admin/reports/financial",
		labelKey: "financialReports",
		icon: FileBarChartIcon,
		children: [
			{
				href: "/admin/reports/financial",
				labelKey: "financialReports",
				icon: FileBarChartIcon,
			},
			{
				href: "/admin/reports/income-statement",
				labelKey: "incomeStatement",
				icon: FileBarChartIcon,
			},
			{
				href: "/admin/reports/balance-sheet",
				labelKey: "balanceSheet",
				icon: FileBarChartIcon,
			},
		],
	},
	{
		href: "/admin/payment-methods",
		labelKey: "paymentMethods",
		icon: CreditCardIcon,
	},
	{
		href: "/admin/company/settings",
		labelKey: "companySettings",
		icon: SettingsIcon,
	},
];

function flattenNavItems(items: NavItem[]): NavItem[] {
	return items.flatMap((item) => [
		item,
		...(item.children ? flattenNavItems(item.children) : []),
	]);
}

function isNavItemActive(pathname: string, item: NavItem): boolean {
	return (
		pathname === item.href ||
		item.children?.some((child) => isNavItemActive(pathname, child)) === true
	);
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
		"/admin/cashier": true,
		"/admin/products": true,
		"/admin/services": true,
		"/admin/reports/financial": true,
	});
	const t = useTranslations("nav");

	const pageNames: Record<string, string> = Object.fromEntries(
		flattenNavItems(navItems).map((item) => [item.href, t(item.labelKey)]),
	);

	const toggleGroup = (href: string) =>
		setOpenGroups((current) => ({ ...current, [href]: !current[href] }));

	const renderMobileItem = (item: NavItem, level = 0) => {
		const active = isNavItemActive(pathname, item);
		const open = openGroups[item.href] ?? active;
		const Icon = item.icon;

		if (item.children?.length) {
			return (
				<div
					key={`${item.href}-${item.labelKey}-group-${level}`}
					className="space-y-1"
				>
					<button
						type="button"
						onClick={() => toggleGroup(item.href)}
						className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
							active
								? "bg-accent font-medium text-accent-foreground"
								: "text-muted-foreground hover:bg-muted hover:text-foreground"
						}`}
					>
						<Icon className="h-5 w-5 shrink-0" />
						<span className="flex-1 text-left">{t(item.labelKey)}</span>
						<ChevronDownIcon
							className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
						/>
					</button>
					{open && (
						<div className="space-y-1 pl-4">
							{item.children.map((child) => renderMobileItem(child, level + 1))}
						</div>
					)}
				</div>
			);
		}

		return (
			<Link
				key={`${item.href}-${item.labelKey}-${level}`}
				href={item.href}
				onClick={() => setMobileMenuOpen(false)}
				className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
					pathname === item.href
						? "bg-accent font-medium text-accent-foreground"
						: "text-muted-foreground hover:bg-muted hover:text-foreground"
				}`}
				style={{ paddingLeft: level ? `${level + 0.75}rem` : undefined }}
			>
				<Icon className="h-5 w-5 shrink-0" />
				{t(item.labelKey)}
			</Link>
		);
	};

	const renderDesktopItem = (item: NavItem) => {
		const active = isNavItemActive(pathname, item);
		const open = openGroups[item.href] ?? active;
		const Icon = item.icon;

		if (item.children?.length) {
			return (
				<div key={`${item.href}-${item.labelKey}-group`} className="space-y-1">
					<button
						type="button"
						onClick={() => toggleGroup(item.href)}
						className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
							active
								? "bg-accent font-medium text-accent-foreground"
								: "text-muted-foreground hover:bg-muted hover:text-foreground"
						}`}
					>
						<Icon className="h-5 w-5 shrink-0" />
						<span className="flex-1 text-left">{t(item.labelKey)}</span>
						<ChevronDownIcon
							className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
						/>
					</button>
					{open && (
						<div className="space-y-1 pl-4">
							{item.children.map(renderDesktopItem)}
						</div>
					)}
				</div>
			);
		}

		return (
			<Link
				key={`${item.href}-${item.labelKey}`}
				href={item.href}
				className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
					pathname === item.href
						? "bg-accent font-medium text-accent-foreground"
						: "text-muted-foreground hover:bg-muted hover:text-foreground"
				}`}
			>
				<Icon className="h-5 w-5 shrink-0" />
				{t(item.labelKey)}
			</Link>
		);
	};

	return (
		<div className="flex min-h-screen w-full flex-col bg-muted/40">
			<header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background px-3 sm:gap-4 sm:px-4">
				<Button
					variant="ghost"
					size="icon"
					className="shrink-0 sm:hidden"
					onClick={() => setMobileMenuOpen(true)}
				>
					<MenuIcon className="h-5 w-5" />
					<span className="sr-only">{t("openMenu")}</span>
				</Button>
				<Link
					href="/admin"
					className="hidden items-center gap-2 font-semibold text-lg sm:flex"
				>
					<Package2Icon className="h-6 w-6" />
					<span className="sr-only">{t("adminPanel")}</span>
				</Link>
				<h1 className="truncate font-bold text-lg sm:text-xl">
					{pageNames[pathname]}
				</h1>
				<div className="ml-auto flex items-center gap-2">
					<LocaleSwitcher />
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								size="icon"
								className="shrink-0 overflow-hidden rounded-full"
							>
								<Image
									src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/placeholder-user.jpg`}
									width={36}
									height={36}
									alt="Avatar"
									className="overflow-hidden rounded-full"
								/>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuLabel>{t("myAccount")}</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuItem>{t("settings")}</DropdownMenuItem>
							<DropdownMenuItem>{t("support")}</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={() => logout()}>
								{t("logout")}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</header>

			{/* Mobile drawer overlay */}
			{mobileMenuOpen && (
				<div className="fixed inset-0 z-50 sm:hidden">
					<button
						type="button"
						className="fixed inset-0 bg-black/50"
						onClick={() => setMobileMenuOpen(false)}
					/>
					<nav className="fixed inset-y-0 left-0 flex w-64 flex-col gap-2 overflow-y-auto border-r bg-background p-4">
						<div className="mb-4 flex items-center justify-between">
							<Link
								href="/admin"
								className="flex items-center gap-2 font-semibold text-lg"
								onClick={() => setMobileMenuOpen(false)}
							>
								<Package2Icon className="h-6 w-6" />
								<span>FinOpenPOS</span>
							</Link>
							<Button
								variant="ghost"
								size="icon"
								onClick={() => setMobileMenuOpen(false)}
							>
								<XIcon className="h-5 w-5" />
							</Button>
						</div>
						{navItems.map((item) => renderMobileItem(item))}
					</nav>
				</div>
			)}

			<div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-64">
				<aside className="fixed inset-y-0 left-0 z-10 mt-[56px] hidden w-60 flex-col border-r bg-background sm:flex">
					<nav className="flex flex-col gap-2 px-3 py-5">
						<TooltipProvider>
							{navItems.map((item) => renderDesktopItem(item))}
						</TooltipProvider>
					</nav>
				</aside>
				<main className="flex-1 overflow-x-hidden p-3 sm:px-6 sm:py-0">
					{children}
				</main>
			</div>
		</div>
	);
}
