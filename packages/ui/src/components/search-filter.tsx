"use client";

import { FilterIcon, SearchIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./dropdown-menu";
import { Input } from "./input";

// ── Filter button types ────────────────────────────────────────────────────

export interface FilterOption {
	label: string;
	value: string;
	variant?: "default" | "success" | "danger" | "warning";
}

interface SearchFilterProps {
	search: string;
	onSearchChange: (value: string) => void;
	searchPlaceholder?: string;
	filters?: {
		options: FilterOption[];
		value: string;
		onChange: (value: string) => void;
	}[];
	children?: ReactNode;
}

export function SearchFilter({
	search,
	onSearchChange,
	searchPlaceholder = "Search...",
	filters,
	children,
}: SearchFilterProps) {
	return (
		<div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
			<div className="flex flex-1 items-center gap-2">
				<div className="relative flex-1 sm:max-w-[300px]">
					<SearchIcon className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						type="text"
						placeholder={searchPlaceholder}
						value={search}
						onChange={(e) => onSearchChange(e.target.value)}
						className="w-full pr-8 pl-9"
					/>
					{search && (
						<button
							type="button"
							onClick={() => onSearchChange("")}
							className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
						>
							<XIcon className="h-4 w-4" />
						</button>
					)}
				</div>

				{filters && filters.length > 0 && (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								size="icon"
								className="shrink-0"
								title="Filters"
							>
								<FilterIcon className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" className="w-56">
							{filters.map((filter, fi) => (
								<div key={fi}>
									{fi > 0 && <DropdownMenuSeparator />}
									<DropdownMenuRadioGroup
										value={filter.value}
										onValueChange={filter.onChange}
									>
										{filter.options.map((opt) => (
											<DropdownMenuRadioItem key={opt.value} value={opt.value}>
												{opt.label}
											</DropdownMenuRadioItem>
										))}
									</DropdownMenuRadioGroup>
								</div>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				)}
			</div>
			{children && (
				<div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
					{children}
				</div>
			)}
		</div>
	);
}
