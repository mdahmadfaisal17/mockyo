import { useState, useEffect, useRef } from "react";
import { Search, Bell, Trash2 } from "lucide-react";

type SubscriberRow = { _id: string; email: string; createdAt: string };

export function SubscribersPanel({
	apiBaseUrl,
	getAdminHeaders,
}: {
	apiBaseUrl: string;
	getAdminHeaders: () => Record<string, string>;
}) {
	const [subscribers, setSubscribers] = useState<SubscriberRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const tableScrollRef = useRef<HTMLDivElement | null>(null);
	const [canScrollLeft, setCanScrollLeft] = useState(false);
	const [canScrollRight, setCanScrollRight] = useState(false);

	useEffect(() => {
		setLoading(true);
		fetch(`${apiBaseUrl}/subscribers`, { credentials: "include", headers: getAdminHeaders() })
			.then((r) => r.json())
			.then((data) => {
				if (data?.ok) setSubscribers(data.items ?? []);
			})
			.catch(() => {})
			.finally(() => setLoading(false));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [apiBaseUrl]);

	const handleDelete = async (id: string) => {
		setDeletingId(id);
		try {
			const res = await fetch(`${apiBaseUrl}/subscribers/${id}`, {
				method: "DELETE",
				credentials: "include",
				headers: getAdminHeaders(),
			});
			const data = await res.json();
			if (data?.ok) setSubscribers((prev) => prev.filter((s) => s._id !== id));
		} catch {}
		setDeletingId(null);
	};

	const filtered = subscribers.filter((s) =>
		s.email.toLowerCase().includes(search.toLowerCase()),
	);

	useEffect(() => {
		const el = tableScrollRef.current;
		if (!el || loading || filtered.length === 0) {
			setCanScrollLeft(false);
			setCanScrollRight(false);
			return;
		}

		const updateScrollShadows = () => {
			setCanScrollLeft(el.scrollLeft > 2);
			setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
		};

		updateScrollShadows();
		el.addEventListener("scroll", updateScrollShadows, { passive: true });
		window.addEventListener("resize", updateScrollShadows);

		return () => {
			el.removeEventListener("scroll", updateScrollShadows);
			window.removeEventListener("resize", updateScrollShadows);
		};
	}, [loading, filtered.length]);

	return (
		<section className="space-y-5">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h3 className="text-lg font-semibold text-zinc-100">Subscribers</h3>
					<p className="mt-0.5 text-sm text-zinc-400">
						{subscribers.length} subscriber{subscribers.length !== 1 ? "s" : ""} — notified on every new mockup upload
					</p>
				</div>
				<div className="relative w-full sm:w-64">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
					<input
						type="text"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search by email..."
						className="w-full rounded-lg border border-white/8 bg-[#0E0E14] py-2 pl-9 pr-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-[#FF6B35]"
					/>
				</div>
			</div>

			{loading ? (
				<div className="flex items-center justify-center py-16">
					<div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-[#FF6B35]" />
				</div>
			) : filtered.length === 0 ? (
				<div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-white/8 bg-[#16161F] py-20 text-center">
					<Bell className="h-8 w-8 text-zinc-600" />
					<p className="text-sm text-zinc-400">
						{search ? "No subscribers match your search." : "No subscribers yet."}
					</p>
				</div>
			) : (
				<div className="overflow-hidden rounded-xl border border-white/8 bg-[#16161F]">
					<div className="border-b border-white/6 px-4 py-2 text-[11px] text-zinc-500 sm:hidden">
						Swipe left/right to view all columns
					</div>
					<div className="relative">
						<div ref={tableScrollRef} className="overflow-x-auto overscroll-x-contain [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]">
							<table className="w-full min-w-[600px] text-sm">
						<thead>
							<tr className="border-b border-white/6 text-left">
								<th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
									#
								</th>
								<th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
									Email
								</th>
								<th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
									Subscribed
								</th>
								<th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
									Action
								</th>
							</tr>
						</thead>
						<tbody>
							{filtered.map((sub, i) => (
								<tr
									key={sub._id}
									className="border-b border-white/5 transition-colors last:border-0 hover:bg-white/[0.02]"
								>
									<td className="px-5 py-3.5 text-zinc-500">{i + 1}</td>
									<td className="px-5 py-3.5">
										<div className="flex items-center gap-2.5">
											<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FF6B35]/15 text-xs font-bold text-[#FF6B35]">
												{sub.email.charAt(0).toUpperCase()}
											</div>
											<span className="text-zinc-200">{sub.email}</span>
										</div>
									</td>
									<td className="px-5 py-3.5 text-zinc-400">
										{new Date(sub.createdAt).toLocaleDateString("en-US", {
											year: "numeric",
											month: "short",
											day: "numeric",
										})}
									</td>
									<td className="px-5 py-3.5 text-right">
										<button
											type="button"
											onClick={() => handleDelete(sub._id)}
											disabled={deletingId === sub._id}
											className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
										>
											<Trash2 className="h-3.5 w-3.5" />
											{deletingId === sub._id ? "Removing..." : "Remove"}
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
						</div>
						{canScrollLeft && (
							<div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[#16161F] to-transparent sm:hidden" />
						)}
						{canScrollRight && (
							<div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[#16161F] to-transparent sm:hidden" />
						)}
					</div>
				</div>
			)}
		</section>
	);
}
