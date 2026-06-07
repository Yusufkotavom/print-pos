import { links } from "@/lib/links";
import { getTranslations } from "@/lib/translations-server";
import type { Messages } from "@/messages/en";

export default function Footer({
	locale,
	messages,
}: {
	locale: string;
	messages: Messages;
}) {
	const t = getTranslations(messages, "footer");

	return (
		<footer className="border-[#1a1a1a] border-t py-8">
			<div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
				<p className="text-[#4E5159] text-[13px]">
					{t("builtWith")}{" "}
					<span className="text-[#64676F]">Next.js, PostgreSQL, Drizzle</span>{" "}
					{t("by")}
				</p>
				<div className="flex gap-6">
					<a
						href={links.github}
						target="_blank"
						rel="noopener noreferrer"
						className="text-[#4E5159] text-[13px] transition-colors hover:text-[#94979E]"
					>
						{t("github")}
					</a>
					<a
						href={`/${locale}/docs`}
						className="text-[#4E5159] text-[13px] transition-colors hover:text-[#94979E]"
					>
						{t("docs")}
					</a>
					<a
						href={links.apiDocs}
						className="text-[#4E5159] text-[13px] transition-colors hover:text-[#94979E]"
					>
						API
					</a>
					<a
						href={links.license}
						target="_blank"
						rel="noopener noreferrer"
						className="text-[#4E5159] text-[13px] transition-colors hover:text-[#94979E]"
					>
						{t("license")}
					</a>
				</div>
			</div>
		</footer>
	);
}
