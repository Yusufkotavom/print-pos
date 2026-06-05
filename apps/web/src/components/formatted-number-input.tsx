"use client";

import { Input } from "@finopenpos/ui/components/input";
import type { ComponentProps } from "react";
import { formatIndonesianNumber, parseIndonesianNumber } from "@/lib/utils";

type FormattedNumberInputProps = Omit<
	ComponentProps<typeof Input>,
	"type" | "value" | "onChange"
> & {
	value: number | null | undefined;
	onValueChange: (value: number | null) => void;
	allowEmpty?: boolean;
};

export function FormattedNumberInput({
	value,
	onValueChange,
	allowEmpty,
	...props
}: FormattedNumberInputProps) {
	return (
		<Input
			{...props}
			type="text"
			inputMode="numeric"
			value={formatIndonesianNumber(value)}
			onChange={(event) => {
				const rawValue = event.target.value.replace(/[^\d]/g, "");
				if (!rawValue && allowEmpty) {
					onValueChange(null);
					return;
				}
				onValueChange(parseIndonesianNumber(event.target.value));
			}}
		/>
	);
}
