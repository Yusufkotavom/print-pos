"use client";

import { ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { cn } from "../lib/utils";
import { Button } from "./button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "./command";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

interface ComboboxProps {
	items: { id: number | string; name: string }[];
	placeholder: string;
	onSelect: (id: number | string) => void;
	/** Controlled display value — shows this in the trigger button */
	value?: string;
	noSelect?: boolean;
	className?: string;
}

export function Combobox({
	items,
	placeholder,
	onSelect,
	value: controlledValue,
	noSelect,
	className,
}: ComboboxProps) {
	const [open, setOpen] = useState(false);
	const [internalValue, setInternalValue] = useState("");
	const [popoverWidth, setPopoverWidth] = useState(0);
	const tc = useTranslations("common");
	const setTriggerRef = useCallback((element: HTMLButtonElement | null) => {
		if (!element) return;
		const width = element.offsetWidth;
		setPopoverWidth((current) => (current === width ? current : width));
	}, []);

	const displayValue = controlledValue ?? internalValue;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					className={cn(
						"w-full justify-between font-normal",
						!displayValue && "text-muted-foreground",
						className,
					)}
					ref={setTriggerRef}
				>
					<span className="truncate">{displayValue || placeholder}</span>
					<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className="p-0"
				align="start"
				style={{ width: popoverWidth }}
			>
				<Command>
					<CommandInput
						placeholder={`${tc("search").replace("...", "")} ${placeholder.toLowerCase()}...`}
					/>
					<CommandEmpty>{tc("noItemFound")}</CommandEmpty>
					<CommandList>
						<CommandGroup>
							{items.map((item) => (
								<CommandItem
									key={item.id}
									value={item.name}
									onSelect={() => {
										onSelect(item.id);
										setOpen(false);
										if (noSelect) return;
										setInternalValue(item.name);
									}}
								>
									{item.name}
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
