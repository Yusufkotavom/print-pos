"use client";

import { Button } from "@finopenpos/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@finopenpos/ui/components/dialog";
import { Input } from "@finopenpos/ui/components/input";
import { Label } from "@finopenpos/ui/components/label";
import { Loader2Icon } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

type CustomerForm = {
	handleSubmit: () => void;
	Field: ComponentType<{
		name: "name" | "email" | "phone" | "address";
		children: (field: {
			state: { value: string; meta: { errors: unknown[] } };
			handleChange: (value: string) => void;
			handleBlur: () => void;
		}) => ReactNode;
	}>;
};

function fieldError(errors: unknown[]) {
	return errors.length > 0
		? errors
				.map((error) =>
					String((error as { message?: string })?.message ?? error),
				)
				.join(", ")
		: undefined;
}

export function POSCustomerDialog({
	open,
	onOpenChange,
	form,
	isPending,
	labels,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	form: CustomerForm;
	isPending: boolean;
	labels: {
		title: string;
		name: string;
		email: string;
		phone: string;
		address: string;
		cancel: string;
		save: string;
	};
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{labels.title}</DialogTitle>
				</DialogHeader>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						event.stopPropagation();
						form.handleSubmit();
					}}
				>
					<div className="grid gap-4 py-4">
						<form.Field name="name">
							{(field) => (
								<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
									<Label htmlFor="customer-name">{labels.name}</Label>
									<div className="col-span-3">
										<Input
											id="customer-name"
											value={field.state.value}
											onChange={(event) =>
												field.handleChange(event.target.value)
											}
											onBlur={field.handleBlur}
											error={fieldError(field.state.meta.errors)}
										/>
									</div>
								</div>
							)}
						</form.Field>
						<form.Field name="email">
							{(field) => (
								<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
									<Label htmlFor="customer-email">{labels.email}</Label>
									<div className="col-span-3">
										<Input
											id="customer-email"
											type="email"
											value={field.state.value}
											onChange={(event) =>
												field.handleChange(event.target.value)
											}
											onBlur={field.handleBlur}
											error={fieldError(field.state.meta.errors)}
										/>
									</div>
								</div>
							)}
						</form.Field>
						<form.Field name="phone">
							{(field) => (
								<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
									<Label htmlFor="customer-phone">{labels.phone}</Label>
									<div className="col-span-3">
										<Input
											id="customer-phone"
											value={field.state.value}
											onChange={(event) =>
												field.handleChange(event.target.value)
											}
											onBlur={field.handleBlur}
											error={fieldError(field.state.meta.errors)}
										/>
									</div>
								</div>
							)}
						</form.Field>
						<form.Field name="address">
							{(field) => (
								<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
									<Label htmlFor="customer-address">{labels.address}</Label>
									<Input
										id="customer-address"
										value={field.state.value}
										onChange={(event) => field.handleChange(event.target.value)}
										className="col-span-3"
									/>
								</div>
							)}
						</form.Field>
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="secondary"
							onClick={() => onOpenChange(false)}
						>
							{labels.cancel}
						</Button>
						<Button type="submit" disabled={isPending}>
							{isPending && (
								<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
							)}
							{labels.save}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
