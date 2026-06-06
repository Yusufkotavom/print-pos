"use client";

import type * as React from "react";
import { DayPicker } from "react-day-picker";

export function Calendar(props: React.ComponentProps<typeof DayPicker>) {
	return <DayPicker {...props} />;
}
