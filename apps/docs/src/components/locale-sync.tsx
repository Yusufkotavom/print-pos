"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";

const COOKIE_NAME = "locale";

export function LocaleSync() {
	const params = useParams();
	const lang = params?.lang as string | undefined;

	useEffect(() => {
		if (!lang) return;
		window.localStorage.setItem(COOKIE_NAME, lang);
	}, [lang]);

	return null;
}
