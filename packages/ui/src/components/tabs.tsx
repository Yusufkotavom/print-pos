"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@finopenpos/ui/lib/utils";

function Tabs({
	className,
	orientation = "horizontal",
	...props
}: TabsPrimitive.Root.Props) {
	return (
		<TabsPrimitive.Root
			data-slot="tabs"
			data-orientation={orientation}
			className={cn(
				"group/tabs flex gap-4 data-[orientation=horizontal]:flex-col data-[orientation=vertical]:flex-row",
				className,
			)}
			{...props}
		/>
	);
}

const tabsListVariants = cva(
	"inline-flex max-w-full items-center rounded-lg bg-muted p-1 text-muted-foreground data-[orientation=horizontal]:w-full data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch",
	{
		variants: {
			variant: {
				default: "",
				line: "gap-1 rounded-none border-b bg-transparent p-0",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

function TabsList({
	className,
	variant = "default",
	...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
	return (
		<TabsPrimitive.List
			data-slot="tabs-list"
			data-variant={variant}
			className={cn(tabsListVariants({ variant }), className)}
			{...props}
		/>
	);
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
	return (
		<TabsPrimitive.Tab
			data-slot="tabs-trigger"
			className={cn(
				"inline-flex min-w-0 flex-1 items-center justify-center rounded-md px-3 py-2 text-center font-medium text-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-active:bg-background data-active:text-foreground data-active:shadow-sm",
				"group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start",
				"group-data-[variant=line]/tabs-list:rounded-none group-data-[variant=line]/tabs-list:border-b-2 group-data-[variant=line]/tabs-list:border-transparent group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:shadow-none group-data-[variant=line]/tabs-list:data-active:border-foreground group-data-[variant=line]/tabs-list:data-active:bg-transparent",
				className,
			)}
			{...props}
		/>
	);
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
	return (
		<TabsPrimitive.Panel
			data-slot="tabs-content"
			className={cn("min-w-0 flex-1 outline-none", className)}
			{...props}
		/>
	);
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
