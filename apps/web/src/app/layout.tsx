import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Toaster } from "sonner";
import { CookieConsent } from "@/components/cookie-consent";
import { PWAProvider } from "@/components/pwa-provider";
import { TRPCReactProvider } from "@/components/trpc-provider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
	title: "FinOpenPOS",
	description: "Open-source point of sale system",
	manifest: "/manifest.webmanifest",
	appleWebApp: {
		capable: true,
		title: "FinOpenPOS",
		statusBarStyle: "default",
	},
};

export const viewport: Viewport = {
	themeColor: "#111827",
};

export default async function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const locale = await getLocale();
	const messages = await getMessages();

	return (
		<html lang={locale}>
			<body className={inter.className}>
				<NextIntlClientProvider locale={locale} messages={messages}>
					<TRPCReactProvider>
						<main>{children}</main>
						<Toaster richColors position="top-right" />
						<PWAProvider />
						<CookieConsent />
					</TRPCReactProvider>
				</NextIntlClientProvider>
			</body>
		</html>
	);
}
