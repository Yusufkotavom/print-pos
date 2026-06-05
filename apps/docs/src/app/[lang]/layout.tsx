import { defineI18nUI } from "fumadocs-ui/i18n";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CookieConsent } from "@/components/cookie-consent";
import { LocaleSync } from "@/components/locale-sync";
import { i18n } from "@/lib/i18n";
import { TranslationProvider } from "@/lib/translations";
import { loadMessages } from "@/lib/translations-server";
import "../globals.css";

const { provider } = defineI18nUI(i18n, {
	translations: {
		en: {
			displayName: "English",
		},
		id: {
			displayName: "Indonesia",
			toc: "Di halaman ini",
			search: "Cari",
			lastUpdate: "Pembaruan terakhir",
			searchNoResult: "Tidak ada hasil",
			previousPage: "Sebelumnya",
			nextPage: "Berikutnya",
			chooseLanguage: "Bahasa",
			chooseTheme: "Tema",
		},
	},
});

export const metadata: Metadata = {
	title: {
		template: "%s | FinOpenPOS Docs",
		default: "FinOpenPOS Docs",
	},
	description:
		"Documentation for FinOpenPOS — open-source point of sale system",
};

interface LayoutProps {
	params: Promise<{ lang: string }>;
	children: ReactNode;
}

export default async function Layout({ params, children }: LayoutProps) {
	const { lang } = await params;
	const messages = await loadMessages(lang);

	return (
		<html lang={lang} suppressHydrationWarning>
			<body className="flex min-h-screen flex-col">
				<TranslationProvider locale={lang} messages={messages}>
					<RootProvider i18n={provider(lang)}>
						{children}
						<CookieConsent />
						<LocaleSync />
					</RootProvider>
				</TranslationProvider>
			</body>
		</html>
	);
}
