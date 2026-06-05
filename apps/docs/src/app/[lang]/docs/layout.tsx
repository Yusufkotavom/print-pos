import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import { baseOptions } from "@/lib/layout.shared";
import { source } from "@/lib/source";

interface LayoutProps {
	params: Promise<{ lang: string }>;
	children: ReactNode;
}

export default async function Layout({ params, children }: LayoutProps) {
	const { lang } = await params;

	return (
		<DocsLayout tree={source.getPageTree(lang)} {...baseOptions(lang)}>
			{children}
		</DocsLayout>
	);
}
