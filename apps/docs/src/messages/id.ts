const messages = {
	common: {
		locale: "Indonesia",
		switchLocale: "English",
	},
	header: {
		features: "Fitur",
		docs: "Dokumentasi",
		apiDocs: "API",
		github: "GitHub",
		demo: "Demo",
		getStarted: "Mulai",
	},
	hero: {
		title: "POS open-source yang",
		titleAccent: "Indonesia butuhkan",
		subtitle:
			"Sistem point of sale lengkap dengan integrasi fiskal, dibuat oleh developer, untuk semua. Gratis, transparan, dan digerakkan komunitas.",
		cta: "Lihat di GitHub",
		ctaSecondary: "Baca Dokumentasi",
	},
	problem: {
		text: "Banyak bisnis kecil tidak mampu membayar sistem POS mahal dengan kepatuhan fiskal. Alternatif open-source yang ada sering usang, kurang terawat, dan tidak punya <highlight>integrasi fiskal nyata</highlight>. Kami mengubah itu.",
		count: "bisnis kecil di Indonesia",
	},
	techStack: {
		title: "Dibangun dengan <accent>alat terbaik</accent> untuk pekerjaan ini",
		pglite: {
			name: "PGLite",
			description:
				"PostgreSQL embedded via WASM. Tanpa server database untuk diinstal. Clone, jalankan, kembangkan.",
		},
		nextjs: {
			name: "Next.js 16",
			description:
				"Framework React terbaru dengan Server Components, Turbopack, dan arsitektur proxy baru.",
		},
		drizzle: {
			name: "Drizzle ORM",
			description:
				"SQL type-safe yang terasa seperti menulis query. Tanpa overhead, DX maksimal.",
		},
		tailwind: {
			name: "Tailwind CSS 4",
			description:
				"CSS utility-first dibangun ulang dari nol. Sangat cepat dan kuat.",
		},
		trpc: {
			name: "tRPC",
			description:
				"API type-safe end-to-end. Tanpa code generation, tanpa schema untuk dikelola.",
		},
		betterAuth: {
			name: "Better Auth",
			description:
				"Autentikasi modern yang langsung bekerja. Email/password, session, dan banyak lagi.",
		},
	},
	features: {
		title: "Semua yang dibutuhkan untuk <accent>mengelola bisnis</accent>",
		pos: {
			name: "Point of Sale",
			description:
				"Checkout cepat dan intuitif. Bisa offline dengan PGLite. Mendukung banyak metode pembayaran.",
		},
		fiscal: {
			name: "Integrasi Fiskal",
			description:
				"Fondasi untuk integrasi fiskal lokal, dokumen pajak, dan pelaporan bisnis.",
		},
		multiTenant: {
			name: "Multi-Tenancy",
			description:
				"Satu instalasi, banyak bisnis. Tiap bisnis punya data dan pengaturan terisolasi.",
		},
		offline: {
			name: "Database Zero-Setup",
			description:
				"Didukung PGLite — PostgreSQL embedded via WASM. Tanpa server database untuk diinstal atau dikonfigurasi. Jalankan dan pakai.",
		},
		dashboard: {
			name: "Dasbor Analitik",
			description:
				"Laporan penjualan, grafik pendapatan, insight pelanggan. Semua real-time dengan visualisasi bagus.",
		},
		i18n: {
			name: "Internasionalisasi",
			description:
				"Dukungan bawaan untuk banyak bahasa. Saat ini Inggris dan Indonesia.",
		},
	},
	socialProof: {
		stars: "Bintang",
		contributors: "Kontributor",
		commits: "Commit",
		license: "Lisensi",
		joinMessage:
			"Gabung dengan {count} developer membangun masa depan POS di Indonesia",
	},
	getStarted: {
		title: "Berjalan dalam <accent>kurang dari satu menit</accent>",
		step1Comment: "# Clone repository",
		step1: "git clone https://github.com/JoaoHenriqueBarbosa/FinOpenPOS.git",
		step2Comment: "# Install dependency",
		step2: "cd FinOpenPOS && bun install",
		step3Comment: "# Jalankan development server",
		step3: "bun run dev",
		copyTooltip: "Salin ke clipboard",
		copied: "Disalin!",
	},
	cta: {
		title: "Siap berkontribusi?",
		subtitle:
			"FinOpenPOS open-source dan digerakkan komunitas. Setiap kontribusi berarti.",
		starOnGithub: "Beri bintang di GitHub",
		readDocs: "Baca Dokumentasi",
	},
	footer: {
		builtWith: "Dibangun dengan",
		by: "oleh komunitas FinOpenPOS",
		github: "GitHub",
		docs: "Dokumentasi",
		license: "Lisensi MIT",
	},
} as const;

export default messages;

type DeepStringify<T> = {
	[K in keyof T]: T[K] extends string ? string : DeepStringify<T[K]>;
};

export type Messages = DeepStringify<typeof messages>;
