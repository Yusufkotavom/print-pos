"use client";

import { Button } from "@finopenpos/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@finopenpos/ui/components/card";
import { Input } from "@finopenpos/ui/components/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@finopenpos/ui/components/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ArrowLeftIcon,
	DownloadIcon,
	FileIcon,
	FileUpIcon,
	Loader2Icon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/router";

type CsvRow = Record<string, string>;
type ParsedProductRow = {
	id?: number;
	name: string;
	price: number;
	cost: number;
	in_stock: number;
	category?: string;
	product_type?: "product" | "service";
	description?: string;
};
type ProductRow = RouterOutputs["products"]["list"][number];

export default function ImportProductsPage() {
	const trpc = useTRPC();
	const router = useRouter();
	const queryClient = useQueryClient();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [file, setFile] = useState<File | null>(null);
	const [data, setData] = useState<ParsedProductRow[]>([]);
	const [isParsing, setIsParsing] = useState(false);

	const { data: productsData, isLoading: isLoadingProducts } = useQuery(
		trpc.products.list.queryOptions(),
	);

	const bulkCreateMutation = useMutation(
		trpc.products.bulkCreate.mutationOptions({
			onSuccess: (res) => {
				queryClient.invalidateQueries(trpc.products.list.queryOptions());
				toast.success(`Berhasil mengimpor ${res.count} produk.`);
				router.push("/admin/products");
			},
			onError: (err) => toast.error(err.message || "Gagal mengimpor produk"),
		}),
	);

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const selectedFile = e.target.files?.[0];
		if (!selectedFile) return;

		setFile(selectedFile);
		setIsParsing(true);

		Papa.parse(selectedFile, {
			header: true,
			skipEmptyLines: true,
			complete: (results) => {
				const rows = results.data as CsvRow[];
				const parsedData = rows
					.map((row): ParsedProductRow => {
						// Helper to find column by multiple possible names (case insensitive)
						const getVal = (possibleNames: string[]) => {
							const key = Object.keys(row).find((k) =>
								possibleNames.some(
									(pn) => k.toLowerCase().trim() === pn.toLowerCase(),
								),
							);
							return key ? row[key] : undefined;
						};

						const idValue = getVal(["id", "ID", "Id"]);
						const productType = (
							getVal([
								"type",
								"tipe",
								"product_type",
								"product type",
								"jenis",
							]) || "product"
						).toLowerCase();

						return {
							id: idValue ? Number.parseInt(idValue, 10) : undefined,
							name:
								getVal([
									"name",
									"nama",
									"nama produk",
									"product name",
									"productname",
								]) || "",
							description: getVal(["description", "deskripsi", "desc"]) || "",
							price: Number.parseInt(getVal(["price", "harga"]) || "0", 10),
							cost: Number.parseInt(
								getVal(["cost", "hpp", "biaya"]) || "0",
								10,
							),
							in_stock: Number.parseInt(
								getVal(["stock", "stok", "in_stock", "instock"]) || "0",
								10,
							),
							product_type: productType === "service" ? "service" : "product",
							category: getVal(["category", "kategori"]) || "",
						};
					})
					.filter((item) => item.name);

				setData(parsedData);
				setIsParsing(false);
			},
			error: (error) => {
				toast.error(`Gagal membaca file CSV: ${error.message}`);
				setIsParsing(false);
			},
		});
	};

	const handleImport = () => {
		if (data.length === 0) {
			toast.error("Tidak ada data valid untuk diimpor.");
			return;
		}
		bulkCreateMutation.mutate(data);
	};

	const downloadTemplate = () => {
		const headers =
			"name,description,price,cost,in_stock,product_type,category\n";
		const example =
			"Kopi Susu,Kopi susu gula aren,15000,10000,100,product,Minuman\n";
		const blob = new Blob([headers + example], {
			type: "text/csv;charset=utf-8;",
		});
		const link = document.createElement("a");
		const url = URL.createObjectURL(blob);
		link.setAttribute("href", url);
		link.setAttribute("download", "template_import_produk.csv");
		link.style.visibility = "hidden";
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	const handleExportData = () => {
		if (!productsData) return;

		const BOM = "\uFEFF";
		const exportColumns = [
			{ key: "id", header: "id", getValue: (p: ProductRow) => p.id },
			{
				key: "name",
				header: "Nama Produk",
				getValue: (p: ProductRow) => p.name,
			},
			{
				key: "description",
				header: "Deskripsi",
				getValue: (p: ProductRow) => p.description || "",
			},
			{
				key: "price",
				header: "Harga",
				getValue: (p: ProductRow) => p.price / 100,
			},
			{ key: "cost", header: "HPP", getValue: (p: ProductRow) => p.cost / 100 },
			{
				key: "in_stock",
				header: "Stok",
				getValue: (p: ProductRow) => p.in_stock,
			},
			{
				key: "product_type",
				header: "Tipe",
				getValue: (p: ProductRow) => p.product_type,
			},
			{
				key: "category",
				header: "Kategori",
				getValue: (p: ProductRow) => p.category || "",
			},
		];

		const header = exportColumns.map((c) => `"${c.header}"`).join(",");
		const rows = productsData.map((item) =>
			exportColumns
				.map((c) => {
					const val = c.getValue(item);
					return typeof val === "string" ? `"${val.replace(/"/g, '""')}"` : val;
				})
				.join(","),
		);
		const csv = BOM + [header, ...rows].join("\n");
		const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `products-export-${Date.now()}.csv`;
		document.body.appendChild(a);
		a.click();
		setTimeout(() => {
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		}, 150);
	};

	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div className="flex-1">
					<div className="flex items-center gap-2">
						<Button variant="ghost" size="icon" asChild className="h-8 w-8">
							<Link href="/admin/products">
								<ArrowLeftIcon className="h-4 w-4" />
							</Link>
						</Button>
						<h1 className="font-bold text-2xl tracking-tight">Import Produk</h1>
					</div>
					<p className="mt-1 max-w-2xl text-muted-foreground text-sm leading-relaxed">
						Unggah file CSV untuk menambahkan atau memperbarui produk secara
						massal. Jika Anda ingin melakukan pembaruan (update), silakan{" "}
						<strong>Export CSV</strong> produk Anda terlebih dahulu, ubah isinya
						tanpa mengubah kolom ID, lalu unggah kembali file tersebut di sini.
					</p>
				</div>
				<div className="flex shrink-0 flex-wrap items-center gap-2">
					<Button
						variant="outline"
						onClick={handleExportData}
						disabled={isLoadingProducts}
					>
						{isLoadingProducts ? (
							<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
						) : (
							<DownloadIcon className="mr-2 h-4 w-4" />
						)}
						Export CSV
					</Button>
					<Button variant="outline" onClick={downloadTemplate}>
						<FileIcon className="mr-2 h-4 w-4" />
						Download Template
					</Button>
				</div>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Pilih File CSV</CardTitle>
				</CardHeader>
				<CardContent className="space-y-6">
					<div className="flex items-center gap-4">
						<Input
							type="file"
							accept=".csv"
							ref={fileInputRef}
							onChange={handleFileChange}
							className="max-w-sm cursor-pointer"
						/>
					</div>

					{isParsing && (
						<div className="flex items-center text-muted-foreground">
							<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
							Membaca file...
						</div>
					)}

					{!isParsing && file && data.length === 0 && (
						<div className="text-destructive text-sm">
							Format file tidak valid atau tidak ada baris yang memiliki "name".
						</div>
					)}

					{!isParsing && data.length > 0 && (
						<div className="space-y-4">
							<div className="flex items-center justify-between rounded-lg border bg-muted/50 p-3">
								<div>
									<span className="font-medium">{data.length}</span> produk siap
									diimpor.
								</div>
								<Button
									onClick={handleImport}
									disabled={bulkCreateMutation.isPending}
								>
									{bulkCreateMutation.isPending && (
										<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
									)}
									<FileUpIcon className="mr-2 h-4 w-4" />
									Mulai Import
								</Button>
							</div>

							<div className="rounded-md border">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Nama</TableHead>
											<TableHead>Deskripsi</TableHead>
											<TableHead className="text-right">Harga</TableHead>
											<TableHead className="text-right">HPP</TableHead>
											<TableHead className="text-right">Stok</TableHead>
											<TableHead>Kategori</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{data.slice(0, 10).map((row, i) => (
											<TableRow key={i}>
												<TableCell className="font-medium">
													{row.name}
												</TableCell>
												<TableCell className="max-w-[200px] truncate">
													{row.description}
												</TableCell>
												<TableCell className="text-right">
													Rp {(row.price / 100).toLocaleString("id-ID")}
												</TableCell>
												<TableCell className="text-right">
													Rp {(row.cost / 100).toLocaleString("id-ID")}
												</TableCell>
												<TableCell className="text-right">
													{row.in_stock}
												</TableCell>
												<TableCell>{row.category}</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
								{data.length > 10 && (
									<div className="border-t bg-muted/20 p-3 text-center text-muted-foreground text-sm">
										Menampilkan 10 dari {data.length} produk...
									</div>
								)}
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
