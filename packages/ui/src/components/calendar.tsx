"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type * as React from "react";
import { type ChevronProps, DayPicker } from "react-day-picker";
import { cn } from "../lib/utils";
import { buttonVariants } from "./button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
	className,
	classNames,
	showOutsideDays = true,
	...props
}: CalendarProps) {
	return (
		<DayPicker
			showOutsideDays={showOutsideDays}
			className={cn("p-3", className)}
			classNames={{
				months: "flex flex-col sm:flex-row gap-3",
				month: "space-y-4",
				month_caption: "relative flex items-center justify-center pt-1",
				caption_label: "text-sm font-medium",
				nav: "flex items-center gap-1",
				button_previous: cn(
					buttonVariants({ variant: "outline" }),
					"absolute left-1 h-7 w-7 bg-transparent p-0 opacity-60 hover:opacity-100",
				),
				button_next: cn(
					buttonVariants({ variant: "outline" }),
					"absolute right-1 h-7 w-7 bg-transparent p-0 opacity-60 hover:opacity-100",
				),
				month_grid: "w-full border-collapse",
				weekdays: "flex",
				weekday:
					"text-muted-foreground w-9 rounded-md font-normal text-[0.8rem]",
				weeks: "mt-2 flex flex-col gap-1",
				week: "flex w-full",
				day: cn(
					buttonVariants({ variant: "ghost" }),
					"h-9 w-9 p-0 font-normal aria-selected:opacity-100",
				),
				day_button: "h-9 w-9",
				selected:
					"bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
				today: "bg-accent text-accent-foreground",
				outside: "text-muted-foreground opacity-50",
				disabled: "text-muted-foreground opacity-50",
				hidden: "invisible",
				...classNames,
			}}
			components={{
				Chevron: ({ orientation, className, ...chevronProps }: ChevronProps) =>
					orientation === "left" ? (
						<ChevronLeft
							className={cn("h-4 w-4", className)}
							{...chevronProps}
						/>
					) : (
						<ChevronRight
							className={cn("h-4 w-4", className)}
							{...chevronProps}
						/>
					),
			}}
			{...props}
		/>
	);
}
Calendar.displayName = "Calendar";

export { Calendar };
