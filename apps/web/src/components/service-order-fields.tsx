"use client";

import { Button } from "@finopenpos/ui/components/button";
import { Calendar } from "@finopenpos/ui/components/calendar";
import { Label } from "@finopenpos/ui/components/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@finopenpos/ui/components/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@finopenpos/ui/components/select";
import { Textarea } from "@finopenpos/ui/components/textarea";
import { CalendarIcon } from "lucide-react";

type ServiceTypeOption = {
	id: number;
	name: string;
	value: string;
};

export function ServiceOrderFields({
	serviceTypes,
	serviceType,
	estimatedDoneAt,
	detailText,
	customerNote,
	internalNote,
	locale,
	labels,
	onServiceTypeChange,
	onEstimatedDoneAtChange,
	onDetailTextChange,
	onCustomerNoteChange,
	onInternalNoteChange,
}: {
	serviceTypes: ServiceTypeOption[];
	serviceType: string;
	estimatedDoneAt: Date | undefined;
	detailText: string;
	customerNote: string;
	internalNote: string;
	locale: string;
	labels: {
		serviceType: string;
		estimatedDoneAt: string;
		selectDate: string;
		serviceTypeOther: string;
		serviceDetails: string;
		serviceDetailsPlaceholder?: string;
		customerNote: string;
		internalNote: string;
	};
	onServiceTypeChange: (value: string) => void;
	onEstimatedDoneAtChange: (value: Date | undefined) => void;
	onDetailTextChange: (value: string) => void;
	onCustomerNoteChange: (value: string) => void;
	onInternalNoteChange: (value: string) => void;
}) {
	return (
		<>
			<div className="grid gap-4 md:grid-cols-2">
				<div className="space-y-2">
					<Label>{labels.serviceType}</Label>
					<Select value={serviceType} onValueChange={onServiceTypeChange}>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{serviceTypes.length ? (
								serviceTypes.map((item) => (
									<SelectItem key={item.id} value={item.value}>
										{item.name}
									</SelectItem>
								))
							) : (
								<SelectItem value="other">{labels.serviceTypeOther}</SelectItem>
							)}
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-2">
					<Label>{labels.estimatedDoneAt}</Label>
					<Popover>
						<PopoverTrigger asChild>
							<Button
								type="button"
								variant="outline"
								className="w-full justify-start"
							>
								<CalendarIcon className="mr-2 h-4 w-4" />
								{estimatedDoneAt
									? estimatedDoneAt.toLocaleDateString(locale)
									: labels.selectDate}
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-auto p-0" align="start">
							<Calendar
								mode="single"
								selected={estimatedDoneAt}
								onSelect={onEstimatedDoneAtChange}
							/>
						</PopoverContent>
					</Popover>
				</div>
			</div>
			<div className="space-y-2">
				<Label htmlFor="service-detail-text">{labels.serviceDetails}</Label>
				<Textarea
					id="service-detail-text"
					value={detailText}
					onChange={(event) => onDetailTextChange(event.target.value)}
					placeholder={labels.serviceDetailsPlaceholder}
					rows={3}
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="service-customer-note">{labels.customerNote}</Label>
				<Textarea
					id="service-customer-note"
					value={customerNote}
					onChange={(event) => onCustomerNoteChange(event.target.value)}
					rows={3}
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="service-internal-note">{labels.internalNote}</Label>
				<Textarea
					id="service-internal-note"
					value={internalNote}
					onChange={(event) => onInternalNoteChange(event.target.value)}
					rows={3}
				/>
			</div>
		</>
	);
}
