import { Button } from "@finopenpos/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@finopenpos/ui/components/popover";
import * as Icons from "lucide-react";
import { useState } from "react";
import { cn } from "@finopenpos/ui/lib/utils";

const ICONS_LIST = [
	"Package", "Box", "Shirt", "Coffee", "Laptop", "ShoppingBag",
	"Scissors", "Utensils", "Wrench", "Heart", "Star", "Zap",
	"Briefcase", "Car", "Gamepad2", "Headphones", "Camera", "Book",
	"Music", "Smartphone", "Watch", "Dumbbell", "Pencil", "Ticket",
	"IceCream", "Apple", "Fish", "Pizza", "Cake", "CupSoda",
	"GlassWater", "Wine", "Flower", "Trees", "Cat", "Dog"
];

interface IconPickerProps {
	value?: string | null;
	onChange: (value: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
	const [open, setOpen] = useState(false);

	// Dynamically resolve icon from Lucide
	const CurrentIcon = value && (Icons as any)[value] ? (Icons as any)[value] : Icons.Package;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					className="w-[200px] justify-start text-left font-normal"
				>
					<CurrentIcon className="mr-2 h-4 w-4" />
					{value ? value : "Pilih Icon..."}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[240px] p-2" align="start">
				<div className="h-[200px] w-full overflow-y-auto pr-2">
					<div className="grid grid-cols-4 gap-2">
						{ICONS_LIST.map((iconName) => {
							const IconComp = (Icons as any)[iconName];
							if (!IconComp) return null;
							return (
								<Button
									key={iconName}
									variant="ghost"
									className={cn(
										"h-10 w-10 p-0",
										value === iconName && "border-2 border-primary bg-primary/10"
									)}
									onClick={() => {
										onChange(iconName);
										setOpen(false);
									}}
								>
									<IconComp className="h-5 w-5" />
									<span className="sr-only">{iconName}</span>
								</Button>
							);
						})}
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
