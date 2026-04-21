/// <reference types="vite/client" />
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { SubscribersPanel } from "../components/SubscribersPanel";
import {
	LayoutDashboard,
	Users,
	Package,
	Tags,
	LineChart,
	Settings,
	Search,
	Pencil,
	Trash2,
	Upload,
	Layers,
	Palette,
	Blend,
	Download,
	Box,
	Eye,
	Ban,
	X,
	MessageSquare,
	Check,
	ShieldCheck,
	LogOut,
	Move,
	Grid3X3,
	Bell,
} from "lucide-react";
import { readAdminSession, clearAdminSession } from "../imports/adminAuthStore";
import mockyoLogo from "../../assets/mockyo-logo.svg";

type View =
	| "dashboard"
	| "users"
	| "products"
	| "categories"
	| "analytics"
	| "settings"
	| "reviews"
	| "subscribers"
	| "add-product";

type QuickRange = "custom" | "today" | "7d" | "30d";

type Product = {
	id: string;
	thumbnail: string;
	title: string;
	category: string;
	downloads: number;
	status: "Published" | "Draft";
	createdAt: string;
};

type UploadedImage = {
	id: string;
	name: string;
	displayName?: string;
	src: string;
	file: File | null;
};

type BlendLayerKey = "multiply" | "screen" | "overlay";
type PreviewBlendMode = "normal" | BlendLayerKey;
type ViewAssetKey = "primary" | "front" | "back";
type DesignAreaKey = "body" | "leftSleeve" | "rightSleeve";
type ColorAreaKey = "body" | "sleeves" | "collar";

type ViewAssetGroup = {
	baseMockup: UploadedImage | null;
	overlayImage: UploadedImage | null;
};

type DownloadRecord = {
	mockupId?: string;
	productTitle: string;
	downloadedAt: string;
};

type PerspectiveCorners = {
	topLeft: { x: number; y: number };
	topRight: { x: number; y: number };
	bottomLeft: { x: number; y: number };
	bottomRight: { x: number; y: number };
};

const DEFAULT_CORNERS: PerspectiveCorners = {
	topLeft: { x: 0, y: 0 },
	topRight: { x: 1, y: 0 },
	bottomLeft: { x: 0, y: 1 },
	bottomRight: { x: 1, y: 1 },
};

const isDefaultCorners = (c: PerspectiveCorners): boolean => (
	c.topLeft.x === 0 && c.topLeft.y === 0
	&& c.topRight.x === 1 && c.topRight.y === 0
	&& c.bottomLeft.x === 0 && c.bottomLeft.y === 1
	&& c.bottomRight.x === 1 && c.bottomRight.y === 1
);

const computeMatrix3dStyle = (corners: PerspectiveCorners, w: number, h: number): string => {
	const x0 = corners.topLeft.x * w;
	const y0 = corners.topLeft.y * h;
	const x1 = corners.topRight.x * w;
	const y1 = corners.topRight.y * h;
	const x2 = corners.bottomLeft.x * w;
	const y2 = corners.bottomLeft.y * h;
	const x3 = corners.bottomRight.x * w;
	const y3 = corners.bottomRight.y * h;

	const dx1 = x1 - x0;
	const dy1 = y1 - y0;
	const dx2 = x2 - x0;
	const dy2 = y2 - y0;
	const dx3 = x3 - x0;
	const dy3 = y3 - y0;

	const a1 = w * (x1 - x3);
	const b1 = h * (x2 - x3);
	const c1 = dx3 - dx1 - dx2;
	const a2 = w * (y1 - y3);
	const b2 = h * (y2 - y3);
	const c2 = dy3 - dy1 - dy2;

	const det = a1 * b2 - a2 * b1;
	if (Math.abs(det) < 1e-10) return "none";

	const h6 = (c1 * b2 - c2 * b1) / det;
	const h7 = (a1 * c2 - a2 * c1) / det;

	const h0 = dx1 / w + x1 * h6;
	const h1 = dx2 / h + x2 * h7;
	const h2 = x0;
	const h3 = dy1 / w + y1 * h6;
	const h4 = dy2 / h + y2 * h7;
	const h5 = y0;

	return `matrix3d(${h0},${h3},0,${h6}, ${h1},${h4},0,${h7}, 0,0,1,0, ${h2},${h5},0,1)`;
};

type UserRow = {
	id: string;
	name: string;
	email: string;
	role: "User" | "Admin";
	status: "Active" | "Banned";
	isEmailVerified: boolean;
	totalDownloads: number;
	lastLogin: string;
	joinedAt: string;
	downloads: DownloadRecord[];
};

const menuItems: Array<{ id: Exclude<View, "add-product">; label: string; icon: React.ComponentType<{ className?: string }> }> = [
	{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
	{ id: "users", label: "Users", icon: Users },
	{ id: "products", label: "Products", icon: Package },
	{ id: "categories", label: "Categories", icon: Tags },
	{ id: "analytics", label: "Analytics", icon: LineChart },
	{ id: "reviews", label: "Reviews", icon: MessageSquare },
	{ id: "subscribers", label: "Subscribers", icon: Bell },
	{ id: "settings", label: "Settings", icon: Settings },
];

const THUMBNAIL_MIN_SIZE_BYTES = 1 * 1024;
const THUMBNAIL_MAX_SIZE_BYTES = 10 * 1024 * 1024;
const THUMBNAIL_MIN_SIZE_LABEL = "1 KB";
const THUMBNAIL_MAX_SIZE_LABEL = "10 MB";
const THUMBNAIL_DIMENSION_LABEL = "Any resolution (recommended 1200 x 1200 px, square)";

type AdminReview = {
	id: string;
	name: string;
	rating: number;
	text: string;
	approved: boolean;
	submittedAt: number;
};

const seedProducts: Product[] = [];

type CategoryHierarchy = Record<string, Record<string, string[]>>;

const defaultCategoryHierarchy: CategoryHierarchy = {
	Apparel: {
		"T-Shirt": ["Oversized", "Sleeve", "Sleeve Less"],
		Hoodie: ["Oversized", "Sleeve", "Sleeve Less", "Hood"],
	},
};

const adminCategoryStorageKey = "mockyo.admin.category-config";

const normalizeAdminLabel = (value: string) => value.trim().replace(/\s+/g, " ");

const mergeUniqueLabels = (...groups: Array<string[] | undefined>) => {
	const next: string[] = [];
	const seen = new Set<string>();

	groups.forEach((group) => {
		(group || []).forEach((rawItem) => {
			const item = normalizeAdminLabel(rawItem);
			if (!item) return;
			const key = item.toLowerCase();
			if (seen.has(key)) return;
			seen.add(key);
			next.push(item);
		});
	});

	return next;
};

const getMainCategoryNames = (hierarchy: CategoryHierarchy) => Object.keys(hierarchy);

const getCategoryNames = (hierarchy: CategoryHierarchy, mainCategory: string) =>
	Object.keys(hierarchy[mainCategory] || {});

const getSubCategoryNames = (
	hierarchy: CategoryHierarchy,
	mainCategory: string,
	category: string,
) => hierarchy[mainCategory]?.[category] || [];

const getFirstMainCategory = (hierarchy: CategoryHierarchy) =>
	getMainCategoryNames(hierarchy)[0] || "";

const getFirstCategory = (hierarchy: CategoryHierarchy, mainCategory: string) =>
	getCategoryNames(hierarchy, mainCategory)[0] || "";

const getFirstSubCategory = (
	hierarchy: CategoryHierarchy,
	mainCategory: string,
	category: string,
) => getSubCategoryNames(hierarchy, mainCategory, category)[0] || "";

const mergeHierarchy = (
	base: CategoryHierarchy,
	incoming?: CategoryHierarchy,
): CategoryHierarchy => {
	const next: CategoryHierarchy = JSON.parse(JSON.stringify(base));
	if (!incoming || typeof incoming !== "object") return next;

	Object.entries(incoming).forEach(([mainCategory, categoryMap]) => {
		const mainLabel = normalizeAdminLabel(mainCategory);
		if (!mainLabel) return;

		if (!next[mainLabel]) {
			next[mainLabel] = {};
		}

		if (!categoryMap || typeof categoryMap !== "object") return;

		Object.entries(categoryMap).forEach(([category, subList]) => {
			const categoryLabel = normalizeAdminLabel(category);
			if (!categoryLabel) return;
			const normalizedSubList = mergeUniqueLabels(Array.isArray(subList) ? subList : []);

			next[mainLabel][categoryLabel] = mergeUniqueLabels(
				next[mainLabel][categoryLabel] || [],
				normalizedSubList,
			);
		});
	});

	return next;
};

function StatCard({
	icon: Icon,
	label,
	value,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	value: string;
}) {
	return (
		<article className="rounded-xl border border-white/8 bg-[#16161F] p-5 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
			<div className="flex items-center gap-2 text-[#FF6B35]">
				<Icon className="h-4 w-4" />
				<span className="text-xs uppercase tracking-[0.18em] text-zinc-300">{label}</span>
			</div>
			<p className="mt-3 text-2xl font-semibold text-zinc-100">{value}</p>
		</article>
	);
	}

type AnalyticsData = {
	summary: {
		activeUsers: number;
		sessions: number;
		pageViews: number;
		bounceRate: number;
		avgSessionDuration: number;
	};
	dailyVisitors: { date: string; users: number }[];
	topPages: { path: string; views: number }[];
};

function AnalyticsPanel() {
	const apiBaseUrl =
		import.meta.env.VITE_API_URL?.trim() ||
		(typeof window !== "undefined"
			? `${window.location.protocol === "https:" ? "https:" : "http:"}//${window.location.hostname}:5000/api`
			: "http://localhost:5000/api");
	const adminSession = readAdminSession();
	const [data, setData] = useState<AnalyticsData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		fetch(`${apiBaseUrl}/analytics/overview`, {
			credentials: "include",
			headers: adminSession?.token ? { Authorization: `Bearer ${adminSession.token}` } : {},
		})
			.then((r) => r.json())
			.then((json) => {
				if (json.ok) setData(json);
				else setError("Failed to load analytics.");
			})
			.catch(() => setError("Failed to connect to analytics service."))
			.finally(() => setLoading(false));
	}, [apiBaseUrl, adminSession?.token]);

	const formatDuration = (seconds: number) => {
		const m = Math.floor(seconds / 60);
		const s = Math.round(seconds % 60);
		return `${m}m ${s}s`;
	};

	const formatDate = (d: string) => {
		if (!d || d.length !== 8) return d;
		return `${d.slice(6, 8)}/${d.slice(4, 6)}`;
	};

	const maxUsers = data ? Math.max(...data.dailyVisitors.map((d) => d.users), 1) : 1;

	if (loading) {
		return (
			<section className="rounded-xl border border-white/8 bg-[#16161F] p-6 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
				<h3 className="text-lg font-semibold text-zinc-100">Analytics</h3>
				<p className="mt-4 text-sm text-zinc-400 animate-pulse">Loading analytics data...</p>
			</section>
		);
	}

	if (error || !data) {
		return (
			<section className="rounded-xl border border-white/8 bg-[#16161F] p-6 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
				<h3 className="text-lg font-semibold text-zinc-100">Analytics</h3>
				<p className="mt-4 text-sm text-red-400">{error ?? "No data available."}</p>
			</section>
		);
	}

	return (
		<div className="space-y-6">
			{/* Summary Cards */}
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
				{[
					{ label: "Active Users", value: data.summary.activeUsers.toLocaleString() },
					{ label: "Sessions", value: data.summary.sessions.toLocaleString() },
					{ label: "Page Views", value: data.summary.pageViews.toLocaleString() },
					{ label: "Bounce Rate", value: `${(data.summary.bounceRate * 100).toFixed(1)}%` },
					{ label: "Avg. Session", value: formatDuration(data.summary.avgSessionDuration) },
				].map(({ label, value }) => (
					<div key={label} className="rounded-xl border border-white/8 bg-[#16161F] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
						<p className="text-xs text-zinc-500 uppercase tracking-wide">{label}</p>
						<p className="mt-1 text-2xl font-semibold text-zinc-100">{value}</p>
					</div>
				))}
			</div>

			{/* Daily Visitors Chart */}
			<section className="rounded-xl border border-white/8 bg-[#16161F] p-6 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
				<h3 className="text-sm font-semibold text-zinc-100 mb-4">Daily Visitors — Last 30 Days</h3>
				<div className="flex items-end gap-1 h-40">
					{data.dailyVisitors.map((d) => {
						const heightPct = (d.users / maxUsers) * 100;
						return (
							<div key={d.date} className="group relative flex-1 flex flex-col items-center justify-end h-full">
								<div
									className="w-full rounded-sm bg-[#FF6B35]/70 hover:bg-[#FF6B35] transition-colors"
									style={{ height: `${Math.max(heightPct, 2)}%` }}
								/>
								<span className="absolute -top-5 left-1/2 -translate-x-1/2 hidden group-hover:block text-[10px] text-zinc-300 bg-[#0E0E14] px-1 rounded whitespace-nowrap">
									{d.users} ({formatDate(d.date)})
								</span>
							</div>
						);
					})}
				</div>
				<div className="flex justify-between mt-1 text-[10px] text-zinc-600">
					<span>{formatDate(data.dailyVisitors[0]?.date)}</span>
					<span>{formatDate(data.dailyVisitors[data.dailyVisitors.length - 1]?.date)}</span>
				</div>
			</section>

			{/* Top Pages */}
			<section className="rounded-xl border border-white/8 bg-[#16161F] p-6 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
				<h3 className="text-sm font-semibold text-zinc-100 mb-4">Top Pages — Last 30 Days</h3>
				<div className="space-y-3">
					{data.topPages.map(({ path, views }) => {
						const maxViews = data.topPages[0]?.views || 1;
						return (
							<div key={path}>
								<div className="flex justify-between text-xs text-zinc-400 mb-1">
									<span className="font-mono">{path}</span>
									<span>{views.toLocaleString()} views</span>
								</div>
								<div className="h-1.5 rounded-full bg-white/5">
									<div
										className="h-full rounded-full bg-[#FF6B35]"
										style={{ width: `${(views / maxViews) * 100}%` }}
									/>
								</div>
							</div>
						);
					})}
				</div>
			</section>
		</div>
	);
}

export default function Admin() {
	const apiBaseUrl =
		import.meta.env.VITE_API_URL?.trim() ||
		(typeof window !== "undefined"
			? `${window.location.protocol === "https:" ? "https:" : "http:"}//${window.location.hostname}:5000/api`
			: "http://localhost:5000/api");
	const navigate = useNavigate();
	const adminSession = readAdminSession();
	const [adminCsrfToken, setAdminCsrfToken] = useState(adminSession?.csrfToken || "");
	const readCookieValue = (key: string) => {
		if (typeof document === "undefined") return "";

		const target = `${key}=`;
		return document.cookie
			.split(";")
			.map((part) => part.trim())
			.find((part) => part.startsWith(target))
			?.slice(target.length) || "";
	};
	const getAdminHeaders = () => {
		const token = adminCsrfToken || readCookieValue("mockyo_admin_csrf");
		const headers: Record<string, string> = {};
		if (token) headers["X-CSRF-Token"] = token;
		if (adminSession?.token) headers.Authorization = `Bearer ${adminSession.token}`;
		return headers;
	};
	const [view, setView] = useState<View>("dashboard");
	const [showProfileMenu, setShowProfileMenu] = useState(false);
	const [products, setProducts] = useState<Product[]>(seedProducts);
	const [users, setUsers] = useState<UserRow[]>([]);
	const [search, setSearch] = useState("");
	const [quickRange, setQuickRange] = useState<QuickRange>("custom");
	const [fromDate, setFromDate] = useState("");
	const [toDate, setToDate] = useState("");
	const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
	const [editRole, setEditRole] = useState<"User" | "Admin">("User");
	const [editStatus, setEditStatus] = useState<"Active" | "Banned">("Active");
	const [dlFilter, setDlFilter] = useState("all");
	const [saveMsg, setSaveMsg] = useState(false);
	const [pendingReviews, setPendingReviews] = useState<AdminReview[]>([]);
	const [approvedReviews, setApprovedReviews] = useState<AdminReview[]>([]);
	const loadReviewQueues = useCallback(async () => {
		try {
			const [pendingRes, approvedRes] = await Promise.all([
				fetch(`${apiBaseUrl}/reviews/pending`, { credentials: "include", headers: getAdminHeaders() }),
				fetch(`${apiBaseUrl}/reviews`),
			]);

			const pendingResult = await pendingRes.json().catch(() => null);
			const approvedResult = await approvedRes.json().catch(() => null);

			if (
				pendingRes.ok && pendingResult?.ok && Array.isArray(pendingResult.items)
				&& approvedRes.ok && approvedResult?.ok && Array.isArray(approvedResult.items)
			) {
				const mapReview = (item: any): AdminReview => ({
					id: String(item._id || item.id || ""),
					name: String(item.name || "Unknown"),
					rating: Number(item.rating) || 0,
					text: String(item.text || ""),
					approved: Boolean(item.approved),
					submittedAt: new Date(item.submittedAt || item.createdAt || Date.now()).getTime(),
				});

				setPendingReviews(pendingResult.items.map(mapReview));
				setApprovedReviews(approvedResult.items.map(mapReview));
				return;
			}
		} catch {
			setPendingReviews([]);
			setApprovedReviews([]);
		}
	}, [apiBaseUrl]);
	const [uploadedAssets, setUploadedAssets] = useState<UploadedImage[]>([]);
	const [thumbnailAssets, setThumbnailAssets] = useState<UploadedImage[]>([]);
	const [viewAssets, setViewAssets] = useState<Record<ViewAssetKey, ViewAssetGroup>>({
		primary: { baseMockup: null, overlayImage: null },
		front: { baseMockup: null, overlayImage: null },
		back: { baseMockup: null, overlayImage: null },
	});
	const [blendAssets, setBlendAssets] = useState<Record<BlendLayerKey, UploadedImage | null>>({
		multiply: null,
		screen: null,
		overlay: null,
	});
	const [designAreaSlots, setDesignAreaSlots] = useState<Record<DesignAreaKey, UploadedImage | null>>({
		body: null,
		leftSleeve: null,
		rightSleeve: null,
	});
	const [colorAreaSlots, setColorAreaSlots] = useState<Record<ColorAreaKey, UploadedImage | null>>({
		body: null,
		sleeves: null,
		collar: null,
	});
	const [designAreaAssets, setDesignAreaAssets] = useState<UploadedImage[]>([]);
	const [selectedDesignAreaId, setSelectedDesignAreaId] = useState<string | null>(null);
	const [visibleDesignAreas, setVisibleDesignAreas] = useState<Set<string>>(new Set());
	const [perspectiveCornersById, setPerspectiveCornersById] = useState<Record<string, PerspectiveCorners>>({});
	const [sizeImageByAreaId, setSizeImageByAreaId] = useState<Record<string, { src: string; file: File | null }>>({});
	const [sizeImageNaturalSizeById, setSizeImageNaturalSizeById] = useState<Record<string, { w: number; h: number }>>({});
	const [sizeTransformByAreaId, setSizeTransformByAreaId] = useState<Record<string, { x: number; y: number; scale: number; rotation: number }>>({});
	const [sizeTransformEditingAreaId, setSizeTransformEditingAreaId] = useState<string | null>(null);
	const [sizeEditMode, setSizeEditMode] = useState<"normal" | "perspective">("normal");
	const sizeImageInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
	const isSizeDragging = useRef(false);
	const sizeDragStart = useRef({ mouseX: 0, mouseY: 0, x: 0, y: 0, areaId: "" });
	const isSizeScaling = useRef(false);
	const sizeScaleStart = useRef({ distance: 1, scale: 1, areaId: "" });
	const isSizeRotating = useRef(false);
	const sizeRotateStart = useRef({ angle: 0, rotation: 0, areaId: "" });
	const [colorAreaAssets, setColorAreaAssets] = useState<UploadedImage[]>([]);
	const [selectedColorAreaId, setSelectedColorAreaId] = useState<string | null>(null);
	const [visibleColorAreas, setVisibleColorAreas] = useState<Set<string>>(new Set());
	const [defaultImageAssets, setDefaultImageAssets] = useState<UploadedImage[]>([]);
	const [selectedDefaultImageId, setSelectedDefaultImageId] = useState<string | null>(null);
	const [visibleDefaultImages, setVisibleDefaultImages] = useState<Set<string>>(new Set());
	const [previewBlendMode, setPreviewBlendMode] = useState<PreviewBlendMode>("normal");
	const [previewColor, setPreviewColor] = useState("#ff6b35");
	const [artboardOffset, setArtboardOffset] = useState({ x: 0, y: 0 });
	const [artboardZoom, setArtboardZoom] = useState(1);
	const [isDraggingArtboard, setIsDraggingArtboard] = useState(false);
	const [isHandToolEnabled, setIsHandToolEnabled] = useState(false);
	const [artboardPreview, setArtboardPreview] = useState("");
	const [artboardLayerImages, setArtboardLayerImages] = useState<UploadedImage[]>([]);
	const [selectedLayerImageId, setSelectedLayerImageId] = useState<string | null>(null);
	const [layerBlendModes, setLayerBlendModes] = useState<Record<string, PreviewBlendMode>>({});
	const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
	const [draggedDesignAreaId, setDraggedDesignAreaId] = useState<string | null>(null);
	const [draggedColorAreaId, setDraggedColorAreaId] = useState<string | null>(null);
	const [draggedDefaultImageId, setDraggedDefaultImageId] = useState<string | null>(null);
	const [visibleLayers, setVisibleLayers] = useState<Set<string>>(new Set());
	const [addProductStep, setAddProductStep] = useState<1 | 2>(1);
	const [selectedThumbnailId, setSelectedThumbnailId] = useState<string | null>(null);
	const [editingProductId, setEditingProductId] = useState<string | null>(null);
	const [isUploadingProduct, setIsUploadingProduct] = useState(false);
	const [uploadError, setUploadError] = useState("");
	const [uploadSuccess, setUploadSuccess] = useState("");
	const [categoryHierarchy, setCategoryHierarchy] = useState<CategoryHierarchy>(defaultCategoryHierarchy);
	const [categoryManagerMain, setCategoryManagerMain] = useState(
		getFirstMainCategory(defaultCategoryHierarchy),
	);
	const [subCategoryManagerMain, setSubCategoryManagerMain] = useState(
		getFirstMainCategory(defaultCategoryHierarchy),
	);
	const [subCategoryManagerCategory, setSubCategoryManagerCategory] = useState(
		getFirstCategory(defaultCategoryHierarchy, getFirstMainCategory(defaultCategoryHierarchy)),
	);
	const [newMainCategoryName, setNewMainCategoryName] = useState("");
	const [newCategoryName, setNewCategoryName] = useState("");
	const [newSubCategoryName, setNewSubCategoryName] = useState("");
	const [categoryNotice, setCategoryNotice] = useState("");
	const [categoryNoticeTone, setCategoryNoticeTone] = useState<"success" | "error">("success");
	const [productDraft, setProductDraft] = useState({
		title: "",
		description: "",
		mainCategory: getFirstMainCategory(defaultCategoryHierarchy),
		category: getFirstCategory(defaultCategoryHierarchy, getFirstMainCategory(defaultCategoryHierarchy)),
		subCategory: getFirstSubCategory(
			defaultCategoryHierarchy,
			getFirstMainCategory(defaultCategoryHierarchy),
			getFirstCategory(defaultCategoryHierarchy, getFirstMainCategory(defaultCategoryHierarchy)),
		),
		objectKey: "",
	});
	const uploadInputRef = useRef<HTMLInputElement | null>(null);
	const thumbnailInputRef = useRef<HTMLInputElement | null>(null);
	const artboardLayerInputRef = useRef<HTMLInputElement | null>(null);
	const blendInputRefs = {
		multiply: useRef<HTMLInputElement | null>(null),
		screen: useRef<HTMLInputElement | null>(null),
		overlay: useRef<HTMLInputElement | null>(null),
	};
	const viewInputRefs = {
		primaryBaseMockup: useRef<HTMLInputElement | null>(null),
		primaryOverlayImage: useRef<HTMLInputElement | null>(null),
		frontBaseMockup: useRef<HTMLInputElement | null>(null),
		frontOverlayImage: useRef<HTMLInputElement | null>(null),
		backBaseMockup: useRef<HTMLInputElement | null>(null),
		backOverlayImage: useRef<HTMLInputElement | null>(null),
	};
	const namedDesignAreaInputRefs = {
		body: useRef<HTMLInputElement | null>(null),
		leftSleeve: useRef<HTMLInputElement | null>(null),
		rightSleeve: useRef<HTMLInputElement | null>(null),
	};
	const namedColorAreaInputRefs = {
		body: useRef<HTMLInputElement | null>(null),
		sleeves: useRef<HTMLInputElement | null>(null),
		collar: useRef<HTMLInputElement | null>(null),
	};
	const designAreaInputRef = useRef<HTMLInputElement | null>(null);
	const colorAreaInputRef = useRef<HTMLInputElement | null>(null);
	const defaultImageInputRef = useRef<HTMLInputElement | null>(null);
	const artboardCanvasRef = useRef<HTMLCanvasElement | null>(null);
	const artboardStageRef = useRef<HTMLDivElement | null>(null);
	const draggableArtboardRef = useRef<HTMLDivElement | null>(null);
	const artboardDragOffsetRef = useRef({ x: 0, y: 0 });

	const applyQuickRange = (nextRange: QuickRange) => {
		setQuickRange(nextRange);
		if (nextRange === "custom") return;

		const now = new Date();
		const start = new Date(now);
		if (nextRange === "today") {
			start.setHours(0, 0, 0, 0);
		} else if (nextRange === "7d") {
			start.setDate(now.getDate() - 7);
		} else {
			start.setDate(now.getDate() - 30);
		}

		setFromDate(start.toISOString().slice(0, 10));
		setToDate(now.toISOString().slice(0, 10));
	};

	const fromDateTime = useMemo(() => {
		if (!fromDate) return null;
		return new Date(`${fromDate}T00:00:00`);
	}, [fromDate]);

	const toDateTime = useMemo(() => {
		if (!toDate) return null;
		return new Date(`${toDate}T23:59:59`);
	}, [toDate]);

	const inDateTimeRange = (value: string) => {
		const current = new Date(value);
		if (fromDateTime && current < fromDateTime) return false;
		if (toDateTime && current > toDateTime) return false;
		return true;
	};

	const dateFilteredProducts = useMemo(
		() => products.filter((item) => inDateTimeRange(item.createdAt)),
		[products, fromDateTime, toDateTime],
	);

	const filteredUsers = useMemo(
		() => users.filter((item) => inDateTimeRange(item.joinedAt)),
		[users, fromDateTime, toDateTime],
	);

	const dashboardTotals = useMemo(() => {
		const totalDownloads = dateFilteredProducts.reduce((sum, item) => sum + item.downloads, 0);
		return {
			users: filteredUsers.length,
			products: dateFilteredProducts.length,
			downloads: totalDownloads,
		};
	}, [dateFilteredProducts, filteredUsers]);

	const filteredProducts = useMemo(() => {
		if (!search.trim()) return dateFilteredProducts;
		const q = search.toLowerCase();
		return dateFilteredProducts.filter(
			(p) => p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q),
		);
	}, [dateFilteredProducts, search]);

	const mainCategories = useMemo(
		() => getMainCategoryNames(categoryHierarchy),
		[categoryHierarchy],
	);

	const categories = useMemo(
		() => getCategoryNames(categoryHierarchy, productDraft.mainCategory),
		[categoryHierarchy, productDraft.mainCategory],
	);

	const subCategories = useMemo(
		() => getSubCategoryNames(categoryHierarchy, productDraft.mainCategory, productDraft.category),
		[categoryHierarchy, productDraft.mainCategory, productDraft.category],
	);

	const managerCategories = useMemo(
		() => getCategoryNames(categoryHierarchy, categoryManagerMain),
		[categoryHierarchy, categoryManagerMain],
	);

	const managerSubCategories = useMemo(
		() => getSubCategoryNames(categoryHierarchy, subCategoryManagerMain, subCategoryManagerCategory),
		[categoryHierarchy, subCategoryManagerMain, subCategoryManagerCategory],
	);

	const profileMenuRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		const loadAdminCsrfToken = async () => {
			try {
				const response = await fetch(`${apiBaseUrl}/auth/admin/csrf-token`, {
					credentials: "include",
					headers: getAdminHeaders(),
				});
				const result = await response.json().catch(() => null);

				if (response.ok && result?.ok && typeof result.csrfToken === "string") {
					setAdminCsrfToken(result.csrfToken);
				}
			} catch {
				setAdminCsrfToken("");
			}
		};

		void loadAdminCsrfToken();
	}, [apiBaseUrl]);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
				setShowProfileMenu(false);
			}
		};

		if (showProfileMenu) {
			document.addEventListener("mousedown", handleClickOutside);
		}

		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [showProfileMenu]);

	useEffect(() => {
		const handleFocus = () => {
			if (view === "reviews") {
				void loadReviewQueues();
			}
		};

		const handleVisibilityChange = () => {
			if (view === "reviews" && document.visibilityState === "visible") {
				void loadReviewQueues();
			}
		};

		window.addEventListener("focus", handleFocus);
		document.addEventListener("visibilitychange", handleVisibilityChange);

		return () => {
			window.removeEventListener("focus", handleFocus);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [view, loadReviewQueues]);

	useEffect(() => {
		if (view === "reviews") {
			void loadReviewQueues();
		}
	}, [view, loadReviewQueues]);

	useEffect(() => {
		const loadRemoteCategoryConfig = async () => {
			try {
				const response = await fetch(`${apiBaseUrl}/categories/config`);
				const result = await response.json().catch(() => null);
				if (!response.ok || !result?.ok || !result?.hierarchy || typeof result.hierarchy !== "object") {
					return;
				}

				setCategoryHierarchy((prev) => mergeHierarchy(prev, result.hierarchy as CategoryHierarchy));
			} catch {
				// Ignore remote config failures and rely on local fallback.
			}
		};

		void loadRemoteCategoryConfig();
	}, [apiBaseUrl]);

	useEffect(() => {
		try {
			const raw = localStorage.getItem(adminCategoryStorageKey);
			if (!raw) return;
			const parsed = JSON.parse(raw) as {
				hierarchy?: CategoryHierarchy;
				mainCategories?: string[];
				categories?: string[];
				subCategories?: string[];
			};

			if (parsed?.hierarchy) {
				setCategoryHierarchy((prev) => mergeHierarchy(prev, parsed.hierarchy));
				return;
			}

			// Backward compatibility for previous flat storage.
			const fallbackMain =
				mergeUniqueLabels(parsed.mainCategories, getMainCategoryNames(defaultCategoryHierarchy))[0] ||
				getFirstMainCategory(defaultCategoryHierarchy);
			const flatCategories = mergeUniqueLabels(parsed.categories);
			const flatSubs = mergeUniqueLabels(parsed.subCategories);

			if (flatCategories.length > 0) {
				const converted: CategoryHierarchy = {
					[fallbackMain]: {},
				};
				flatCategories.forEach((category) => {
					converted[fallbackMain][category] = flatSubs;
				});
				setCategoryHierarchy((prev) => mergeHierarchy(prev, converted));
			}
		} catch {
			// Ignore malformed storage and keep defaults.
		}
	}, []);

	useEffect(() => {
		try {
			localStorage.setItem(
				adminCategoryStorageKey,
				JSON.stringify({ hierarchy: categoryHierarchy }),
			);
		} catch {
			// Ignore storage failures.
		}

		const syncRemoteCategoryConfig = async () => {
			try {
				await fetch(`${apiBaseUrl}/categories/config`, {
					method: "PUT",
					credentials: "include",
					headers: {
						"Content-Type": "application/json",
						...getAdminHeaders(),
					},
					body: JSON.stringify({ hierarchy: categoryHierarchy }),
				});
			} catch {
				// Ignore remote sync failures and keep local persistence.
			}
		};

		void syncRemoteCategoryConfig();
	}, [categoryHierarchy]);

	useEffect(() => {
		const main = productDraft.mainCategory;
		const nextCategories = getCategoryNames(categoryHierarchy, main);
		const safeCategory =
			nextCategories.includes(productDraft.category)
				? productDraft.category
				: nextCategories[0] || "";
		const nextSubCategories = getSubCategoryNames(categoryHierarchy, main, safeCategory);
		const safeSubCategory =
			nextSubCategories.includes(productDraft.subCategory)
				? productDraft.subCategory
				: nextSubCategories[0] || "";

		if (safeCategory !== productDraft.category || safeSubCategory !== productDraft.subCategory) {
			setProductDraft((prev) => ({
				...prev,
				category: safeCategory,
				subCategory: safeSubCategory,
			}));
		}
	}, [categoryHierarchy, productDraft.mainCategory, productDraft.category, productDraft.subCategory]);

	useEffect(() => {
		if (!mainCategories.includes(categoryManagerMain)) {
			setCategoryManagerMain(mainCategories[0] || "");
		}

		if (!mainCategories.includes(subCategoryManagerMain)) {
			setSubCategoryManagerMain(mainCategories[0] || "");
		}
	}, [mainCategories, categoryManagerMain, subCategoryManagerMain]);

	useEffect(() => {
		const nextCategories = getCategoryNames(categoryHierarchy, subCategoryManagerMain);
		if (!nextCategories.includes(subCategoryManagerCategory)) {
			setSubCategoryManagerCategory(nextCategories[0] || "");
		}
	}, [categoryHierarchy, subCategoryManagerMain, subCategoryManagerCategory]);

	const loadUsers = useCallback(async () => {
		try {
			const response = await fetch(`${apiBaseUrl}/auth/users`, {
				credentials: "include",
				headers: getAdminHeaders(),
			});
			const result = await response.json();

			if (!response.ok || !result?.ok || !Array.isArray(result.items)) {
				throw new Error(result?.message || "Failed to load users.");
			}

			const mappedUsers: UserRow[] = result.items.map((item: any) => ({
				id: String(item._id || ""),
				name: String(item.name || "Unknown User"),
				email: String(item.email || ""),
				role: item.role === "Admin" ? "Admin" : "User",
				status: item.status === "Banned" ? "Banned" : "Active",
				isEmailVerified: Boolean(item.isEmailVerified),
				totalDownloads: Number(item.totalDownloads) || 0,
				lastLogin: item.updatedAt || item.createdAt || new Date().toISOString(),
				joinedAt: item.createdAt || new Date().toISOString(),
				downloads: Array.isArray(item.downloads)
					? item.downloads.map((d: any) => ({
						mockupId: String(d.mockupId || ""),
						productTitle: String(d.productTitle || "Unknown"),
						downloadedAt: String(d.downloadedAt || new Date().toISOString()),
					}))
					: [],
			}));

			setUsers(mappedUsers);
			return mappedUsers;
		} catch (error) {
			console.error("Failed to fetch users:", error);
			return null;
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [apiBaseUrl]);

	useEffect(() => {
		void loadUsers();
	}, [loadUsers]);

	useEffect(() => {
		const loadProducts = async () => {
			try {
				const response = await fetch(`${apiBaseUrl}/mockups`);
				const result = await response.json();

				if (!response.ok || !result?.ok || !Array.isArray(result.items)) {
					throw new Error(result?.message || "Failed to load products.");
				}

				const mappedProducts: Product[] = result.items.map((item: any) => ({
					id: item._id,
					thumbnail:
						item.thumbnails?.[0]?.url ||
						item.views?.primary?.baseMockup?.url ||
						"https://images.unsplash.com/photo-1634032188532-f11af97817ab?auto=format&fit=crop&w=1080&q=80",
					title: item.title || "Untitled",
					category: item.category || "Uncategorized",
					downloads: Number(item.downloads) || 0,
					status: item.status === "published" ? "Published" : "Draft",
					createdAt: item.createdAt || new Date().toISOString(),
				}));

				const fetchedCategories = result.items
					.reduce((acc: CategoryHierarchy, item: any) => {
						const main = normalizeAdminLabel(String(item?.mainCategory || ""));
						const category = normalizeAdminLabel(String(item?.category || ""));
						const subCategory = normalizeAdminLabel(String(item?.subCategory || ""));
						if (!main || !category) return acc;

						if (!acc[main]) acc[main] = {};
						if (!acc[main][category]) acc[main][category] = [];
						if (subCategory) {
							acc[main][category] = mergeUniqueLabels(acc[main][category], [subCategory]);
						}
						return acc;
					}, {});

				setCategoryHierarchy((prev) => mergeHierarchy(prev, fetchedCategories));

				setProducts(mappedProducts);
			} catch (error) {
				console.error("Failed to fetch products:", error);
			}
		};

		void loadProducts();
	}, [apiBaseUrl]);

	const resetFilters = () => {
		setQuickRange("custom");
		setFromDate("");
		setToDate("");
	};

	const showCategoryError = (message: string) => {
		setCategoryNoticeTone("error");
		setCategoryNotice(message);
	};

	const showCategorySuccess = (message: string) => {
		setCategoryNoticeTone("success");
		setCategoryNotice(message);
	};

	const handleAddMainCategory = () => {
		const normalized = normalizeAdminLabel(newMainCategoryName);
		if (!normalized) {
			showCategoryError("Main category name is required.");
			return;
		}

		if (mainCategories.some((item) => item.toLowerCase() === normalized.toLowerCase())) {
			showCategoryError(`Main category '${normalized}' already exists.`);
			return;
		}

		setCategoryHierarchy((prev) => ({ ...prev, [normalized]: {} }));
		setCategoryManagerMain(normalized);
		setSubCategoryManagerMain(normalized);
		setSubCategoryManagerCategory("");
		setProductDraft((prev) => ({ ...prev, mainCategory: normalized, category: "", subCategory: "" }));
		setNewMainCategoryName("");
		showCategorySuccess(`Main category '${normalized}' added.`);
	};

	const handleAddCategory = () => {
		const normalized = normalizeAdminLabel(newCategoryName);
		if (!normalized) {
			showCategoryError("Category name is required.");
			return;
		}

		if (!categoryManagerMain) {
			showCategoryError("Select a main category first.");
			return;
		}

		const existing = getCategoryNames(categoryHierarchy, categoryManagerMain);
		if (existing.some((item) => item.toLowerCase() === normalized.toLowerCase())) {
			showCategoryError(`Category '${normalized}' already exists under '${categoryManagerMain}'.`);
			return;
		}

		setCategoryHierarchy((prev) => ({
			...prev,
			[categoryManagerMain]: {
				...(prev[categoryManagerMain] || {}),
				[normalized]: [],
			},
		}));
		setSubCategoryManagerMain(categoryManagerMain);
		setSubCategoryManagerCategory(normalized);
		if (productDraft.mainCategory === categoryManagerMain) {
			setProductDraft((prev) => ({ ...prev, category: normalized, subCategory: "" }));
		}
		setNewCategoryName("");
		showCategorySuccess(`Category '${normalized}' added under '${categoryManagerMain}'.`);
	};

	const handleAddSubCategory = () => {
		const normalized = normalizeAdminLabel(newSubCategoryName);
		if (!normalized) {
			showCategoryError("Sub-category name is required.");
			return;
		}

		if (!subCategoryManagerMain || !subCategoryManagerCategory) {
			showCategoryError("Select main category and category first.");
			return;
		}

		const existing = getSubCategoryNames(
			categoryHierarchy,
			subCategoryManagerMain,
			subCategoryManagerCategory,
		);
		if (existing.some((item) => item.toLowerCase() === normalized.toLowerCase())) {
			showCategoryError(`Sub-category '${normalized}' already exists under '${subCategoryManagerCategory}'.`);
			return;
		}

		setCategoryHierarchy((prev) => ({
			...prev,
			[subCategoryManagerMain]: {
				...(prev[subCategoryManagerMain] || {}),
				[subCategoryManagerCategory]: [
					...(prev[subCategoryManagerMain]?.[subCategoryManagerCategory] || []),
					normalized,
				],
			},
		}));
		if (
			productDraft.mainCategory === subCategoryManagerMain &&
			productDraft.category === subCategoryManagerCategory
		) {
			setProductDraft((prev) => ({ ...prev, subCategory: normalized }));
		}
		setNewSubCategoryName("");
		showCategorySuccess(`Sub-category '${normalized}' added under '${subCategoryManagerCategory}'.`);
	};

	const removeCategory = (mainCategory: string, name: string) => {
		const confirmed = window.confirm(
			`Are you sure you want to delete category '${name}' from '${mainCategory}'?`,
		);
		if (!confirmed) return;

		setCategoryHierarchy((prev) => {
			const next = { ...prev };
			if (!next[mainCategory]) return prev;
			const categoryMap = { ...next[mainCategory] };
			delete categoryMap[name];
			next[mainCategory] = categoryMap;
			return next;
		});

		if (productDraft.mainCategory === mainCategory && productDraft.category === name) {
			const fallbackCategory =
				getCategoryNames(categoryHierarchy, mainCategory).filter((item) => item !== name)[0] || "";
			const fallbackSubCategory = getSubCategoryNames(categoryHierarchy, mainCategory, fallbackCategory)[0] || "";
			setProductDraft((draft) => ({ ...draft, category: fallbackCategory, subCategory: fallbackSubCategory }));
		}

		showCategorySuccess(`Category '${name}' removed from '${mainCategory}'.`);
	};

	const removeMainCategory = (name: string) => {
		const confirmed = window.confirm(
			`Are you sure you want to delete main category '${name}'?`,
		);
		if (!confirmed) return;

		setCategoryHierarchy((prev) => {
			const next = { ...prev };
			delete next[name];
			return next;
		});

		if (productDraft.mainCategory.toLowerCase() === name.toLowerCase()) {
			const remainingMain = mainCategories.filter((item) => item.toLowerCase() !== name.toLowerCase())[0] || "";
			const nextCategory = getFirstCategory(categoryHierarchy, remainingMain);
			const nextSubCategory = getFirstSubCategory(categoryHierarchy, remainingMain, nextCategory);
			setProductDraft((draft) => ({
				...draft,
				mainCategory: remainingMain,
				category: nextCategory,
				subCategory: nextSubCategory,
			}));
		}
		showCategorySuccess(`Main category '${name}' removed.`);
	};

	const removeSubCategory = (mainCategory: string, category: string, name: string) => {
		setCategoryHierarchy((prev) => ({
			...prev,
			[mainCategory]: {
				...(prev[mainCategory] || {}),
				[category]: (prev[mainCategory]?.[category] || []).filter((item) => item !== name),
			},
		}));

		if (
			productDraft.mainCategory === mainCategory &&
			productDraft.category === category &&
			productDraft.subCategory === name
		) {
			const nextSub =
				getSubCategoryNames(categoryHierarchy, mainCategory, category).filter((item) => item !== name)[0] || "";
			setProductDraft((draft) => ({ ...draft, subCategory: nextSub }));
		}

		showCategorySuccess(`Sub-category '${name}' removed from '${category}'.`);
	};

	const pageTitle = view.charAt(0).toUpperCase() + view.slice(1);
	const showSharedToolbar = view !== "add-product";

	const handleDelete = async (id: string) => {
		const confirmed = window.confirm("Are you sure you want to delete this product?");
		if (!confirmed) return;

		try {
			const response = await fetch(`${apiBaseUrl}/mockups/${id}`, {
				method: "DELETE",
				credentials: "include",
				headers: getAdminHeaders(),
			});
			const result = await response.json().catch(() => null);

			if (!response.ok || !result?.ok) {
				throw new Error(result?.message || "Failed to delete product.");
			}

			setProducts((prev) => prev.filter((item) => item.id !== id));
		} catch (error) {
			console.error("Delete product failed:", error);
			window.alert(error instanceof Error ? error.message : "Failed to delete product.");
		}
	};

	const handleEditProduct = async (product: Product) => {
		// Navigate immediately so the user sees the page loading
		setEditingProductId(product.id);
		setAddProductStep(1);
		setView("add-product");

		// Helper: convert a backend asset {label, url} to UploadedImage
		const toUploaded = (asset: any, key: string): UploadedImage | null => {
			if (!asset?.url) return null;
			return { id: `existing-${key}`, name: asset.label || key, src: asset.url, file: null };
		};

		try {
			const res = await fetch(`${apiBaseUrl}/mockups/${product.id}`);
			const result = await res.json();
			const item = result?.item;

			// ── Thumbnails ──────────────────────────────────────────────
			const thumbs: UploadedImage[] = Array.isArray(item?.thumbnails)
				? item.thumbnails.map((t: any, i: number) => ({
						id: `existing-thumb-${i}`,
						name: t.label || `thumbnail-${i + 1}`,
						src: t.url,
						file: null,
					}))
				: [{ id: `existing-${product.id}`, name: `${product.title}-thumbnail`, src: product.thumbnail, file: null }];
			setThumbnailAssets(thumbs);
			setSelectedThumbnailId(thumbs[0]?.id ?? null);

			// ── Product draft (details) ──────────────────────────────────
			setProductDraft({
				title: item?.title ?? product.title,
				description: item?.description ?? "",
				mainCategory: item?.mainCategory ?? getFirstMainCategory(categoryHierarchy),
				category: item?.category ?? product.category,
				subCategory: item?.subCategory ?? "",
				objectKey: item?.objectKey ?? "",
			});
			if (item?.mainCategory && item?.category) {
				setCategoryHierarchy((prev) =>
					mergeHierarchy(prev, {
						[item.mainCategory]: {
							[item.category]: item?.subCategory ? [item.subCategory] : [],
						},
					}),
				);
			}

			// ── View assets (primary / front / back) ────────────────────
			const views = item?.views ?? {};
			setViewAssets({
				primary: {
					baseMockup: toUploaded(views.primary?.baseMockup, "primaryBaseMockup"),
					overlayImage: toUploaded(views.primary?.overlayImage, "primaryOverlayImage"),
				},
				front: {
					baseMockup: toUploaded(views.front?.baseMockup, "frontBaseMockup"),
					overlayImage: toUploaded(views.front?.overlayImage, "frontOverlayImage"),
				},
				back: {
					baseMockup: toUploaded(views.back?.baseMockup, "backBaseMockup"),
					overlayImage: toUploaded(views.back?.overlayImage, "backOverlayImage"),
				},
			});

			// ── Blend layers ─────────────────────────────────────────────
			const bl = item?.blendLayers ?? {};
			setBlendAssets({
				multiply: toUploaded(bl.multiply, "multiply"),
				screen: toUploaded(bl.screen, "screen"),
				overlay: toUploaded(bl.overlay, "overlay"),
			});

			const existingArtboardLayers: UploadedImage[] = Array.isArray(item?.artboardLayers)
				? item.artboardLayers
						.filter((layer: any) => Boolean(layer?.url))
						.map((layer: any, index: number) => ({
							id: `existing-artboard-${index}`,
							name: layer.label || `layer-${index + 1}`,
							src: layer.url,
							file: null,
						}))
				: [];
			setArtboardLayerImages(existingArtboardLayers);

			const existingModes: Record<string, PreviewBlendMode> = {};
			(item?.artboardLayers || []).forEach((layer: any, index: number) => {
				const id = `existing-artboard-${index}`;
				existingModes[id] = ["multiply", "screen", "overlay"].includes(layer?.blendMode)
					? layer.blendMode
					: "normal";
			});
			setLayerBlendModes(existingModes);
			setVisibleLayers(new Set(existingArtboardLayers.map((layer) => layer.id)));

			// ── Design area slots ────────────────────────────────────────
			const da = item?.designAreas ?? {};
			setDesignAreaSlots({
				body: toUploaded(da.body, "designAreaBody"),
				leftSleeve: toUploaded(da.leftSleeve, "designAreaLeftSleeve"),
				rightSleeve: toUploaded(da.rightSleeve, "designAreaRightSleeve"),
			});

			// ── Design area images array ──────────────────────────────────
			const existingDesignAreaImages: UploadedImage[] = Array.isArray(item?.designAreaImages)
				? item.designAreaImages
						.filter((d: any) => Boolean(d?.url))
						.map((d: any, index: number) => ({
							id: `existing-design-area-${index}`,
							name: d.label || `design-area-${index + 1}`,
							displayName: d.label || `design-area-${index + 1}`,
							src: d.url,
							file: null,
						}))
				: [];
			setDesignAreaAssets(existingDesignAreaImages);
			setVisibleDesignAreas(new Set(existingDesignAreaImages.map((d) => d.id)));

			// Load perspective corners for each design area
			const loadedCorners: Record<string, PerspectiveCorners> = {};
			if (Array.isArray(item?.designAreaImages)) {
				item.designAreaImages.forEach((d: any, index: number) => {
					if (d?.perspectiveCorners) {
						loadedCorners[`existing-design-area-${index}`] = {
							topLeft: { x: d.perspectiveCorners.topLeft?.x ?? 0, y: d.perspectiveCorners.topLeft?.y ?? 0 },
							topRight: { x: d.perspectiveCorners.topRight?.x ?? 1, y: d.perspectiveCorners.topRight?.y ?? 0 },
							bottomLeft: { x: d.perspectiveCorners.bottomLeft?.x ?? 0, y: d.perspectiveCorners.bottomLeft?.y ?? 1 },
							bottomRight: { x: d.perspectiveCorners.bottomRight?.x ?? 1, y: d.perspectiveCorners.bottomRight?.y ?? 1 },
						};
					}
				});
			}
			setPerspectiveCornersById(loadedCorners);

			// Load size images for each design area
			const loadedSizeImages: Record<string, { src: string; file: File | null }> = {};
			if (Array.isArray(item?.designAreaImages)) {
				item.designAreaImages.forEach((d: any, index: number) => {
					if (d?.sizeImage?.url) {
						loadedSizeImages[`existing-design-area-${index}`] = { src: d.sizeImage.url, file: null };
					}
				});
			}
			setSizeImageByAreaId(loadedSizeImages);

			// Load natural sizes for existing size images
			Object.entries(loadedSizeImages).forEach(([areaId, si]) => {
				if (!si.src) return;
				const img = new Image();
				img.onload = () => {
					setSizeImageNaturalSizeById((prev) => ({ ...prev, [areaId]: { w: img.naturalWidth, h: img.naturalHeight } }));
				};
				img.crossOrigin = "anonymous";
				img.src = si.src;
			});

			// Load size transforms for each design area
			const loadedSizeTransforms: Record<string, { x: number; y: number; scale: number; rotation: number }> = {};
			if (Array.isArray(item?.designAreaImages)) {
				item.designAreaImages.forEach((d: any, index: number) => {
					if (d?.sizeTransform && (d.sizeTransform.x !== 0 || d.sizeTransform.y !== 0 || d.sizeTransform.scale !== 1 || d.sizeTransform.rotation !== 0)) {
						loadedSizeTransforms[`existing-design-area-${index}`] = {
							x: d.sizeTransform.x ?? 0,
							y: d.sizeTransform.y ?? 0,
							scale: d.sizeTransform.scale ?? 1,
							rotation: d.sizeTransform.rotation ?? 0,
						};
					}
				});
			}
			setSizeTransformByAreaId(loadedSizeTransforms);

			const existingColorAreaImages: UploadedImage[] = Array.isArray(item?.colorAreaImages)
				? item.colorAreaImages
						.filter((d: any) => Boolean(d?.url))
						.map((d: any, index: number) => ({
							id: `existing-color-area-${index}`,
							name: d.label || `color-area-${index + 1}`,
							displayName: d.label || `color-area-${index + 1}`,
							src: d.url,
							file: null,
						}))
				: [];
			setColorAreaAssets(existingColorAreaImages);
			setVisibleColorAreas(new Set(existingColorAreaImages.map((d) => d.id)));

			const existingDefaultImages: UploadedImage[] = Array.isArray(item?.defaultImages)
				? item.defaultImages
						.filter((d: any) => Boolean(d?.url))
						.map((d: any, index: number) => ({
							id: `existing-default-image-${index}`,
							name: d.label || `default-image-${index + 1}`,
							src: d.url,
							file: null,
						}))
				: [];
			setDefaultImageAssets(existingDefaultImages);
			setVisibleDefaultImages(new Set(existingDefaultImages.map((d) => d.id)));

			const initialBlendId = existingArtboardLayers[0]?.id ?? null;
			const initialDesignId = existingDesignAreaImages[0]?.id ?? null;
			const initialColorId = existingColorAreaImages[0]?.id ?? null;
			const initialDefaultImageId = existingDefaultImages[0]?.id ?? null;
			if (initialBlendId) {
				setSelectedLayerImageId(initialBlendId);
				setSelectedDesignAreaId(null);
				setSelectedColorAreaId(null);
				setSelectedDefaultImageId(null);
			} else if (initialDesignId) {
				setSelectedLayerImageId(null);
				setSelectedDesignAreaId(initialDesignId);
				setSelectedColorAreaId(null);
				setSelectedDefaultImageId(null);
			} else if (initialColorId) {
				setSelectedLayerImageId(null);
				setSelectedDesignAreaId(null);
				setSelectedColorAreaId(initialColorId);
				setSelectedDefaultImageId(null);
			} else {
				setSelectedLayerImageId(null);
				setSelectedDesignAreaId(null);
				setSelectedColorAreaId(null);
				setSelectedDefaultImageId(initialDefaultImageId);
			}

			// ── Color area slots ─────────────────────────────────────────
			const ca = item?.colorAreas ?? {};
			setColorAreaSlots({
				body: toUploaded(ca.body, "colorAreaBody"),
				sleeves: toUploaded(ca.sleeves, "colorAreaSleeves"),
				collar: toUploaded(ca.collar, "colorAreaCollar"),
			});
		} catch {
			// Fallback: at least restore thumbnail from product list data
			const fallbackThumb: UploadedImage = {
				id: `existing-${product.id}`,
				name: `${product.title}-thumbnail`,
				src: product.thumbnail,
				file: null,
			};
			setThumbnailAssets([fallbackThumb]);
			setSelectedThumbnailId(fallbackThumb.id);
			setProductDraft({
				title: product.title,
				description: "",
				mainCategory: getFirstMainCategory(categoryHierarchy),
				category: product.category,
				subCategory: "",
				objectKey: "",
			});
		}

		setUploadError("");
		setUploadSuccess("");
	};

	const handleDeleteUser = async (id: string) => {
		try {
			const response = await fetch(`${apiBaseUrl}/auth/users/${id}`, {
				method: "DELETE",
				credentials: "include",
				headers: getAdminHeaders(),
			});
			const result = await response.json().catch(() => null);

			if (!response.ok || !result?.ok) {
				throw new Error(result?.message || "Failed to delete user.");
			}

			setUsers((prev) => prev.filter((item) => item.id !== id));
			return true;
		} catch (error) {
			console.error("Delete user failed:", error);
			window.alert(error instanceof Error ? error.message : "Failed to delete user.");
			return false;
		}
	};

	const handleSaveUser = async () => {
		if (!selectedUser) return;

		try {
			const response = await fetch(`${apiBaseUrl}/auth/users/${selectedUser.id}`, {
				method: "PATCH",
				credentials: "include",
				headers: { "Content-Type": "application/json", ...getAdminHeaders() },
				body: JSON.stringify({ role: editRole, status: editStatus }),
			});

			const result = await response.json();
			if (!response.ok || !result?.ok || !result?.item) {
				throw new Error(result?.message || "Failed to save user changes.");
			}

			setUsers((prev) =>
				prev.map((item) =>
					item.id === selectedUser.id
						? {
							...item,
							role: result.item.role === "Admin" ? "Admin" : "User",
							status: result.item.status === "Banned" ? "Banned" : "Active",
						}
						: item,
				),
			);

			setSelectedUser((prev) =>
				prev
					? {
						...prev,
						role: result.item.role === "Admin" ? "Admin" : "User",
						status: result.item.status === "Banned" ? "Banned" : "Active",
					}
					: null,
			);

			setSaveMsg(true);
			setTimeout(() => setSaveMsg(false), 3000);
		} catch (error) {
			console.error("Save user failed:", error);
			window.alert(error instanceof Error ? error.message : "Failed to save user changes.");
		}
	};

	const handleToggleBan = async (id: string) => {
		const target = users.find((item) => item.id === id);
		if (!target) return;

		const nextStatus: "Active" | "Banned" = target.status === "Active" ? "Banned" : "Active";

		try {
			const response = await fetch(`${apiBaseUrl}/auth/users/${id}`, {
				method: "PATCH",
				credentials: "include",
				headers: { "Content-Type": "application/json", ...getAdminHeaders() },
				body: JSON.stringify({ status: nextStatus }),
			});
			const result = await response.json();

			if (!response.ok || !result?.ok || !result?.item) {
				throw new Error(result?.message || "Failed to update user status.");
			}

			setUsers((prev) =>
				prev.map((item) =>
					item.id === id
						? { ...item, status: result.item.status === "Banned" ? "Banned" : "Active" }
						: item,
				),
			);

			setSelectedUser((prev) =>
				prev && prev.id === id
					? { ...prev, status: result.item.status === "Banned" ? "Banned" : "Active" }
					: prev,
			);
		} catch (error) {
			console.error("Toggle ban failed:", error);
			window.alert(error instanceof Error ? error.message : "Failed to update user status.");
		}
	};

	const readFiles = async (files: FileList | null, limit?: number): Promise<UploadedImage[]> => {
		if (!files) return [];
		const nextFiles = Array.from(files).slice(0, limit ?? files.length);

		return Promise.all(
			nextFiles.map(
				(file) =>
					new Promise<UploadedImage>((resolve) => {
						const reader = new FileReader();
						reader.onload = () =>
							resolve({
								id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
								name: file.name,
								src: typeof reader.result === "string" ? reader.result : "",
								file,
							});
						reader.readAsDataURL(file);
					}),
			),
		);
	};

	const resetStructuredProductForm = () => {
		setArtboardLayerImages([]);
		setLayerBlendModes({});
		setVisibleLayers(new Set());
		setSelectedLayerImageId(null);
		setDesignAreaAssets([]);
		setSelectedDesignAreaId(null);
		setVisibleDesignAreas(new Set());
		setPerspectiveCornersById({});
		setSizeImageByAreaId({});
		setSizeImageNaturalSizeById({});
		setSizeTransformByAreaId({});
		setSizeTransformEditingAreaId(null);
		setColorAreaAssets([]);
		setSelectedColorAreaId(null);
		setVisibleColorAreas(new Set());
		setDefaultImageAssets([]);
		setSelectedDefaultImageId(null);
		setVisibleDefaultImages(new Set());
		setThumbnailAssets([]);
		setSelectedThumbnailId(null);
		setEditingProductId(null);
		setViewAssets({
			primary: { baseMockup: null, overlayImage: null },
			front: { baseMockup: null, overlayImage: null },
			back: { baseMockup: null, overlayImage: null },
		});
		setBlendAssets({ multiply: null, screen: null, overlay: null });
		setDesignAreaSlots({ body: null, leftSleeve: null, rightSleeve: null });
		setColorAreaSlots({ body: null, sleeves: null, collar: null });
		setUploadError("");
		setUploadSuccess("");
		const nextMain = getFirstMainCategory(categoryHierarchy);
		const nextCategory = getFirstCategory(categoryHierarchy, nextMain);
		const nextSubCategory = getFirstSubCategory(categoryHierarchy, nextMain, nextCategory);
		setProductDraft({
			title: "",
			description: "",
			mainCategory: nextMain,
			category: nextCategory,
			subCategory: nextSubCategory,
			objectKey: "",
		});
	};

	const handleThumbnailUpload = async (files: FileList | null) => {
		if (!files) return;
		const nextFiles = Array.from(files).slice(0, 4);
		const invalidFile = nextFiles.find(
			(file) => file.size < THUMBNAIL_MIN_SIZE_BYTES || file.size > THUMBNAIL_MAX_SIZE_BYTES,
		);

		if (invalidFile) {
			setUploadError(
				`Each thumbnail size must be between ${THUMBNAIL_MIN_SIZE_LABEL} and ${THUMBNAIL_MAX_SIZE_LABEL}.`,
			);
			return;
		}

		setUploadError("");
		const items = await readFiles(files, 4);
		if (!items.length) return;
		setThumbnailAssets(items);
		setSelectedThumbnailId(items[0].id);
	};

	const handleViewAssetUpload = async (
		viewKey: ViewAssetKey,
		assetKey: keyof ViewAssetGroup,
		files: FileList | null,
	) => {
		const [item] = await readFiles(files, 1);
		if (!item) return;
		setViewAssets((prev) => ({
			...prev,
			[viewKey]: {
				...prev[viewKey],
				[assetKey]: item,
			},
		}));
	};

	const handleNamedDesignAreaUpload = async (key: DesignAreaKey, files: FileList | null) => {
		const [item] = await readFiles(files, 1);
		if (!item) return;
		setDesignAreaSlots((prev) => ({ ...prev, [key]: item }));
	};

	const handleNamedColorAreaUpload = async (key: ColorAreaKey, files: FileList | null) => {
		const [item] = await readFiles(files, 1);
		if (!item) return;
		setColorAreaSlots((prev) => ({ ...prev, [key]: item }));
	};

	const handleProductImageUpload = async (files: FileList | null) => {
		const items = await readFiles(files, 4);
		if (!items.length) return;
		setUploadedAssets(items);
	};

	const handleBlendAssetUpload = async (layer: BlendLayerKey, files: FileList | null) => {
		const [item] = await readFiles(files, 1);
		if (!item) return;
		setBlendAssets((prev) => ({ ...prev, [layer]: item }));
	};

	const handleArtboardLayerUpload = async (files: FileList | null) => {
		const items = await readFiles(files);
		if (!items.length) return;
		setArtboardLayerImages((prev) => [...prev, ...items]);
		// Initialize blend modes and visibility for new images
		const newModes = { ...layerBlendModes };
		const newVisible = new Set(visibleLayers);
		items.forEach((item) => {
			if (!newModes[item.id]) {
				newModes[item.id] = "normal";
			}
			newVisible.add(item.id);
		});
		setLayerBlendModes(newModes);
		setVisibleLayers(newVisible);
	};

	const handleLayerDragStart = (e: React.DragEvent<HTMLButtonElement>, imageId: string) => {
		setDraggedLayerId(imageId);
		e.dataTransfer.effectAllowed = "move";
	};

	const handleLayerDragOver = (e: React.DragEvent<HTMLButtonElement>) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
	};

	const handleLayerDrop = (e: React.DragEvent<HTMLButtonElement>, targetId: string) => {
		e.preventDefault();
		if (!draggedLayerId || draggedLayerId === targetId) return;

		const draggedIndex = artboardLayerImages.findIndex((img) => img.id === draggedLayerId);
		const targetIndex = artboardLayerImages.findIndex((img) => img.id === targetId);

		if (draggedIndex === -1 || targetIndex === -1) return;

		const newImages = [...artboardLayerImages];
		const [draggedImage] = newImages.splice(draggedIndex, 1);
		newImages.splice(targetIndex, 0, draggedImage);

		setArtboardLayerImages(newImages);
		setDraggedLayerId(null);
	};

	const handleLayerDragEnd = () => {
		setDraggedLayerId(null);
	};

	const toggleExclusiveLayerSelection = (section: "blend" | "design" | "color" | "default", id: string) => {
		if (section === "blend") {
			const next = selectedLayerImageId === id ? null : id;
			setSelectedLayerImageId(next);
			if (next) {
				setSelectedDesignAreaId(null);
				setSelectedColorAreaId(null);
				setSelectedDefaultImageId(null);
			}
			return;
		}

		if (section === "design") {
			const next = selectedDesignAreaId === id ? null : id;
			setSelectedDesignAreaId(next);
			if (next) {
				setSelectedLayerImageId(null);
				setSelectedColorAreaId(null);
				setSelectedDefaultImageId(null);
			}
			return;
		}

		if (section === "color") {
			const next = selectedColorAreaId === id ? null : id;
			setSelectedColorAreaId(next);
			if (next) {
				setSelectedLayerImageId(null);
				setSelectedDesignAreaId(null);
				setSelectedDefaultImageId(null);
			}
			return;
		}

		const next = selectedDefaultImageId === id ? null : id;
		setSelectedDefaultImageId(next);
		if (next) {
			setSelectedLayerImageId(null);
			setSelectedDesignAreaId(null);
			setSelectedColorAreaId(null);
		}
	};

	const handleDesignAreaUpload = async (files: FileList | null) => {
		const items = await readFiles(files);
		if (!items.length) return;
		setDesignAreaAssets((prev) => [
			...prev,
			...items.map((item) => ({
				...item,
				displayName: item.name.replace(/\.[^.]+$/, "") || item.name,
			})),
		]);
		setVisibleDesignAreas((prev) => {
			const next = new Set(prev);
			items.forEach((item) => next.add(item.id));
			return next;
		});
		setSelectedDesignAreaId(items[0].id);
		setSelectedLayerImageId(null);
		setSelectedColorAreaId(null);
		setSelectedDefaultImageId(null);
	};

	const handleDesignAreaDragStart = (e: React.DragEvent<HTMLDivElement>, imageId: string) => {
		setDraggedDesignAreaId(imageId);
		e.dataTransfer.effectAllowed = "move";
	};

	const handleDesignAreaDragOver = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
	};

	const handleDesignAreaDrop = (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
		e.preventDefault();
		if (!draggedDesignAreaId || draggedDesignAreaId === targetId) return;

		setDesignAreaAssets((prev) => {
			const draggedIndex = prev.findIndex((item) => item.id === draggedDesignAreaId);
			const targetIndex = prev.findIndex((item) => item.id === targetId);
			if (draggedIndex === -1 || targetIndex === -1) return prev;

			const next = [...prev];
			const [dragged] = next.splice(draggedIndex, 1);
			next.splice(targetIndex, 0, dragged);
			return next;
		});

		setDraggedDesignAreaId(null);
	};

	const handleDesignAreaDragEnd = () => {
		setDraggedDesignAreaId(null);
	};

	const handleColorAreaUpload = async (files: FileList | null) => {
		const items = await readFiles(files);
		if (!items.length) return;
		setColorAreaAssets((prev) => [
			...prev,
			...items.map((item) => ({
				...item,
				displayName: item.name.replace(/\.[^.]+$/, "") || item.name,
			})),
		]);
		setVisibleColorAreas((prev) => {
			const next = new Set(prev);
			items.forEach((item) => next.add(item.id));
			return next;
		});
		setSelectedColorAreaId(items[0].id);
		setSelectedLayerImageId(null);
		setSelectedDesignAreaId(null);
		setSelectedDefaultImageId(null);
	};

	const handleColorAreaDragStart = (e: React.DragEvent<HTMLDivElement>, imageId: string) => {
		setDraggedColorAreaId(imageId);
		e.dataTransfer.effectAllowed = "move";
	};

	const handleColorAreaDragOver = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
	};

	const handleColorAreaDrop = (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
		e.preventDefault();
		if (!draggedColorAreaId || draggedColorAreaId === targetId) return;

		setColorAreaAssets((prev) => {
			const draggedIndex = prev.findIndex((item) => item.id === draggedColorAreaId);
			const targetIndex = prev.findIndex((item) => item.id === targetId);
			if (draggedIndex === -1 || targetIndex === -1) return prev;

			const next = [...prev];
			const [dragged] = next.splice(draggedIndex, 1);
			next.splice(targetIndex, 0, dragged);
			return next;
		});

		setDraggedColorAreaId(null);
	};

	const handleColorAreaDragEnd = () => {
		setDraggedColorAreaId(null);
	};

	const handleDefaultImageUpload = async (files: FileList | null) => {
		const items = await readFiles(files);
		if (!items.length) return;
		setDefaultImageAssets((prev) => [...prev, ...items]);
		setVisibleDefaultImages((prev) => {
			const next = new Set(prev);
			items.forEach((item) => next.add(item.id));
			return next;
		});
		setSelectedDefaultImageId(items[0].id);
		setSelectedLayerImageId(null);
		setSelectedDesignAreaId(null);
		setSelectedColorAreaId(null);
	};

	const handleDefaultImageDragStart = (e: React.DragEvent<HTMLDivElement>, imageId: string) => {
		setDraggedDefaultImageId(imageId);
		e.dataTransfer.effectAllowed = "move";
	};

	const handleDefaultImageDragOver = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
	};

	const handleDefaultImageDrop = (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
		e.preventDefault();
		if (!draggedDefaultImageId || draggedDefaultImageId === targetId) return;

		setDefaultImageAssets((prev) => {
			const draggedIndex = prev.findIndex((item) => item.id === draggedDefaultImageId);
			const targetIndex = prev.findIndex((item) => item.id === targetId);
			if (draggedIndex === -1 || targetIndex === -1) return prev;

			const next = [...prev];
			const [dragged] = next.splice(draggedIndex, 1);
			next.splice(targetIndex, 0, dragged);
			return next;
		});

		setDraggedDefaultImageId(null);
	};

	const handleDefaultImageDragEnd = () => {
		setDraggedDefaultImageId(null);
	};

	const removeUploadedItem = (id: string, setter: React.Dispatch<React.SetStateAction<UploadedImage[]>>) => {
		setter((prev) => prev.filter((item) => item.id !== id));
	};

	const clampArtboardOffset = (nextX: number, nextY: number) => {
		const stage = artboardStageRef.current;
		const artboard = draggableArtboardRef.current;

		if (!stage || !artboard) {
			return { x: nextX, y: nextY };
		}

		const maxX = Math.max(0, stage.clientWidth - artboard.offsetWidth);
		const maxY = Math.max(0, stage.clientHeight - artboard.offsetHeight);

		return {
			x: Math.min(Math.max(0, nextX), maxX),
			y: Math.min(Math.max(0, nextY), maxY),
		};
	};

	const handleArtboardPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
		if (!isHandToolEnabled || event.button !== 0) return;

		const stage = artboardStageRef.current;
		const artboard = draggableArtboardRef.current;

		if (!stage || !artboard) return;

		const artboardRect = artboard.getBoundingClientRect();
		artboardDragOffsetRef.current = {
			x: event.clientX - artboardRect.left,
			y: event.clientY - artboardRect.top,
		};

		setIsDraggingArtboard(true);
		event.currentTarget.setPointerCapture(event.pointerId);
	};

	const handleArtboardPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
		if (!isDraggingArtboard) return;

		const stage = artboardStageRef.current;
		if (!stage) return;

		const stageRect = stage.getBoundingClientRect();
		const nextX = event.clientX - stageRect.left - artboardDragOffsetRef.current.x;
		const nextY = event.clientY - stageRect.top - artboardDragOffsetRef.current.y;

		setArtboardOffset(clampArtboardOffset(nextX, nextY));
	};

	const stopArtboardDragging = () => {
		setIsDraggingArtboard(false);
	};

	const handleArtboardPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
		stopArtboardDragging();
	};

	const handleArtboardWheel = (event: React.WheelEvent<HTMLDivElement>) => {
		event.preventDefault();

		const zoomStep = 0.1;
		const minZoom = 0.5;
		const maxZoom = 3;

		const nextZoom = event.deltaY < 0 
			? Math.min(artboardZoom + zoomStep, maxZoom)
			: Math.max(artboardZoom - zoomStep, minZoom);

		setArtboardZoom(nextZoom);
	};

	// --- Size image bounding-box transform helpers ---
	const defaultSizeTransform = { x: 0, y: 0, scale: 1, rotation: 0 };
	const getSizeTransform = (areaId: string) => sizeTransformByAreaId[areaId] ?? defaultSizeTransform;

	const getSizeArtboardCenter = () => {
		const rect = draggableArtboardRef.current?.getBoundingClientRect();
		if (!rect) return null;
		return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
	};

	const handleSizeDragMouseDown = (e: React.MouseEvent, areaId: string) => {
		const t = getSizeTransform(areaId);
		isSizeDragging.current = true;
		sizeDragStart.current = { mouseX: e.clientX, mouseY: e.clientY, x: t.x, y: t.y, areaId };
		e.stopPropagation();
		e.preventDefault();
	};

	const handleSizeScaleMouseDown = (e: React.MouseEvent, areaId: string) => {
		const t = getSizeTransform(areaId);
		const center = getSizeArtboardCenter();
		if (!center) return;
		const dist = Math.max(Math.hypot(e.clientX - center.x, e.clientY - center.y), 1);
		isSizeScaling.current = true;
		sizeScaleStart.current = { distance: dist, scale: t.scale, areaId };
		e.stopPropagation();
		e.preventDefault();
	};

	const handleSizeRotateMouseDown = (e: React.MouseEvent, areaId: string) => {
		const t = getSizeTransform(areaId);
		const center = getSizeArtboardCenter();
		if (!center) return;
		const angle = (Math.atan2(e.clientY - center.y, e.clientX - center.x) * 180) / Math.PI;
		isSizeRotating.current = true;
		sizeRotateStart.current = { angle, rotation: t.rotation, areaId };
		e.stopPropagation();
		e.preventDefault();
	};

	useEffect(() => {
		const onMouseMove = (e: MouseEvent) => {
			if (isSizeScaling.current) {
				const areaId = sizeScaleStart.current.areaId;
				const center = getSizeArtboardCenter();
				if (!center) return;
				const dist = Math.max(Math.hypot(e.clientX - center.x, e.clientY - center.y), 1);
				const ratio = dist / sizeScaleStart.current.distance;
				const nextScale = Math.max(0.05, Math.min(5, sizeScaleStart.current.scale * ratio));
				setSizeTransformByAreaId((prev) => ({
					...prev,
					[areaId]: { ...(prev[areaId] ?? defaultSizeTransform), scale: nextScale },
				}));
				return;
			}
			if (isSizeRotating.current) {
				const areaId = sizeRotateStart.current.areaId;
				const center = getSizeArtboardCenter();
				if (!center) return;
				const currentAngle = (Math.atan2(e.clientY - center.y, e.clientX - center.x) * 180) / Math.PI;
				const delta = currentAngle - sizeRotateStart.current.angle;
				let nextRot = sizeRotateStart.current.rotation + delta;
				// snap to 0/90/180/270
				const snapAngles = [0, 90, 180, 270, -90, -180, -270, 360];
				for (const sa of snapAngles) {
					if (Math.abs(nextRot - sa) < 3) { nextRot = sa; break; }
				}
				setSizeTransformByAreaId((prev) => ({
					...prev,
					[areaId]: { ...(prev[areaId] ?? defaultSizeTransform), rotation: nextRot },
				}));
				return;
			}
			if (isSizeDragging.current) {
				const areaId = sizeDragStart.current.areaId;
				const dx = e.clientX - sizeDragStart.current.mouseX;
				const dy = e.clientY - sizeDragStart.current.mouseY;
				setSizeTransformByAreaId((prev) => ({
					...prev,
					[areaId]: {
						...(prev[areaId] ?? defaultSizeTransform),
						x: sizeDragStart.current.x + dx,
						y: sizeDragStart.current.y + dy,
					},
				}));
			}
		};
		const onMouseUp = () => {
			isSizeDragging.current = false;
			isSizeScaling.current = false;
			isSizeRotating.current = false;
		};
		window.addEventListener("mousemove", onMouseMove);
		window.addEventListener("mouseup", onMouseUp);
		return () => {
			window.removeEventListener("mousemove", onMouseMove);
			window.removeEventListener("mouseup", onMouseUp);
		};
	}, []);

	useEffect(() => {
		if (view !== "add-product") return;

		const stage = artboardStageRef.current;
		const artboard = draggableArtboardRef.current;
		if (!stage || !artboard) return;

		setArtboardOffset({
			x: Math.max(0, (stage.clientWidth - artboard.offsetWidth) / 2),
			y: Math.max(0, (stage.clientHeight - artboard.offsetHeight) / 2),
		});
	}, [view]);

	useEffect(() => {
		if (isHandToolEnabled) return;
		setIsDraggingArtboard(false);
	}, [isHandToolEnabled]);

	useEffect(() => {
		const canvas = artboardCanvasRef.current;
		if (!canvas) return;

		const context = canvas.getContext("2d");
		if (!context) return;

		canvas.width = 900;
		canvas.height = 900;
		context.clearRect(0, 0, canvas.width, canvas.height);

		const draw = async () => {
			const layerEntries = (["multiply", "screen", "overlay"] as BlendLayerKey[])
				.map((layer) => ({ layer, asset: blendAssets[layer] }))
				.filter((entry): entry is { layer: BlendLayerKey; asset: UploadedImage } => Boolean(entry.asset));

			const loadImage = (src: string) =>
				new Promise<HTMLImageElement>((resolve, reject) => {
					const image = new Image();
					image.onload = () => resolve(image);
					image.onerror = reject;
					image.src = src;
				});

			const drawCover = (image: HTMLImageElement) => {
				const scale = Math.max(canvas.width / image.width, canvas.height / image.height);
				const width = image.width * scale;
				const height = image.height * scale;
				const x = (canvas.width - width) / 2;
				const y = (canvas.height - height) / 2;
				context.drawImage(image, x, y, width, height);
			};

			context.fillStyle = "#101019";
			context.fillRect(0, 0, canvas.width, canvas.height);

			const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
			gradient.addColorStop(0, "#1f1f2a");
			gradient.addColorStop(1, "#0c0c13");
			context.fillStyle = gradient;
			context.fillRect(0, 0, canvas.width, canvas.height);

			if (uploadedAssets[0]?.src) {
				try {
					context.save();
					context.globalAlpha = 0.24;
					drawCover(await loadImage(uploadedAssets[0].src));
					context.restore();
				} catch {
					// Keep the generated gradient background if the base image fails.
				}
			}

			const frameX = 90;
			const frameY = 110;
			const frameWidth = canvas.width - 180;
			const frameHeight = canvas.height - 240;

			const cardGap = 38;
			const cardInset = 26;
			const cardHeight = frameHeight - (layerEntries.length > 1 ? (layerEntries.length - 1) * cardGap : 0);
			const cardWidth = frameWidth - (layerEntries.length > 1 ? (layerEntries.length - 1) * cardInset : 0);

			if (layerEntries.length > 0) {
				for (const [index, entry] of layerEntries.entries()) {
					const cardX = frameX + index * cardInset;
					const cardY = frameY + index * cardGap;

					context.save();
					context.shadowColor = "rgba(0,0,0,0.28)";
					context.shadowBlur = 36;
					context.shadowOffsetY = 16;
					context.fillStyle = "rgba(15,16,24,0.95)";
					context.beginPath();
					context.roundRect(cardX, cardY, cardWidth, cardHeight, 28);
					context.fill();
					context.restore();

					context.save();
					context.beginPath();
					context.roundRect(cardX, cardY, cardWidth, cardHeight, 28);
					context.clip();

					try {
						const image = await loadImage(entry.asset.src);
						const scale = Math.max(cardWidth / image.width, cardHeight / image.height);
						const width = image.width * scale;
						const height = image.height * scale;
						const x = cardX + (cardWidth - width) / 2;
						const y = cardY + (cardHeight - height) / 2;
						context.drawImage(image, x, y, width, height);
					} catch {
						context.fillStyle = "rgba(255,255,255,0.04)";
						context.fillRect(cardX, cardY, cardWidth, cardHeight);
					}

					context.fillStyle = "rgba(12,12,18,0.32)";
					context.fillRect(cardX, cardY, cardWidth, cardHeight);
					context.restore();

					context.save();
					context.strokeStyle = "rgba(255,255,255,0.12)";
					context.lineWidth = 2;
					context.beginPath();
					context.roundRect(cardX, cardY, cardWidth, cardHeight, 28);
					context.stroke();
					context.restore();

					context.save();
					context.fillStyle = "rgba(12,12,18,0.92)";
					context.beginPath();
					context.roundRect(cardX + 22, cardY + 20, 154, 44, 999);
					context.fill();
					context.fillStyle = "#f8fafc";
					context.font = "600 20px sans-serif";
					context.fillText(entry.layer.toUpperCase(), cardX + 40, cardY + 48);
					context.restore();
				}
			} else {
				context.save();
				context.fillStyle = "rgba(255,255,255,0.03)";
				context.beginPath();
				context.roundRect(frameX, frameY, frameWidth, frameHeight, 32);
				context.fill();
				context.restore();

				context.save();
				context.strokeStyle = "rgba(255,255,255,0.28)";
				context.lineWidth = 3;
				context.setLineDash([14, 10]);
				context.strokeRect(frameX + 30, frameY + 30, frameWidth - 60, frameHeight - 60);
				context.restore();

				context.fillStyle = "rgba(244,244,245,0.88)";
				context.font = "600 28px sans-serif";
				context.fillText("Blend layer preview will appear here", 180, canvas.height / 2 - 10);
				context.fillStyle = "rgba(244,244,245,0.54)";
				context.font = "20px sans-serif";
				context.fillText("Upload Multiply, Screen, or Overlay images to stack them.", 138, canvas.height / 2 + 32);
			}

			context.save();
			context.strokeStyle = "rgba(255,255,255,0.28)";
			context.lineWidth = 3;
			context.setLineDash([14, 10]);
			context.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);
			context.restore();

			context.fillStyle = "rgba(10,10,16,0.74)";
			context.fillRect(36, canvas.height - 118, 410, 70);
			context.fillStyle = "#f4f4f5";
			context.font = "600 24px sans-serif";
			context.fillText(productDraft.title || "Product artboard preview", 56, canvas.height - 76);
			context.fillStyle = "rgba(244,244,245,0.72)";
			context.font = "18px sans-serif";
			context.fillText(`Layers: ${layerEntries.length}/3 uploaded`, 56, canvas.height - 44);

			setArtboardPreview(canvas.toDataURL("image/png"));
		};

		void draw();
	}, [blendAssets, productDraft.title, uploadedAssets]);

	const handleUploadProduct = async () => {
		if (!productDraft.title.trim() || !productDraft.mainCategory.trim() || !productDraft.category.trim()) {
			setUploadError("Title, main category and category are required.");
			return;
		}

		if (!productDraft.description.trim()) {
			setUploadError("Description is required. Please add a short product description.");
			return;
		}

		// All visible artboard layers in current order
		const visibleArtboardLayers = artboardLayerImages.filter((item) => visibleLayers.has(item.id));
		// Entries that actually have a new file (for fallback view-asset helpers)
		const artboardFileEntries = visibleArtboardLayers
			.filter((item) => Boolean(item.file))
			.map((item) => ({ item, mode: layerBlendModes[item.id] || "normal" as PreviewBlendMode }));
		const firstArtboardFile = artboardFileEntries[0]?.item.file ?? null;
		const firstBlendFileByMode = (mode: BlendLayerKey) =>
			artboardFileEntries.find((entry) => entry.mode === mode)?.item.file ?? null;
		const topNormalArtboardFile =
			[...artboardFileEntries].reverse().find((entry) => entry.mode === "normal")?.item.file ?? null;

		const hasNewThumbnailFile = thumbnailAssets.some((item) => Boolean(item.file));

		if (!thumbnailAssets.length || (!editingProductId && !hasNewThumbnailFile)) {
			setUploadError("Please upload at least one thumbnail image.");
			return;
		}

		if (editingProductId) {
			setIsUploadingProduct(true);
			setUploadError("");
			setUploadSuccess("");

			try {
				const formData = new FormData();
				formData.append("title", productDraft.title.trim());
				formData.append("description", productDraft.description.trim());
				formData.append("mainCategory", productDraft.mainCategory.trim());
				formData.append("category", productDraft.category.trim());
				formData.append("objectKey", productDraft.objectKey.trim());
				formData.append("status", "published");

				thumbnailAssets.forEach((item) => {
					if (item.file) {
						formData.append("thumbnails", item.file);
					}
				});

				// Build artboardLayerMeta: ordered list of all visible layers.
				// Each entry is either { fileIndex, blendMode } for new files
				// or { url, label, blendMode } for existing (no-file) layers.
				let nextFileIndex = 0;
				const artboardLayerMeta = visibleArtboardLayers.map((item) => {
					const mode = layerBlendModes[item.id] || "normal";
					if (item.file) {
						return { fileIndex: nextFileIndex++, blendMode: mode };
					}
					return { url: item.src, label: item.name, blendMode: mode };
				});
				visibleArtboardLayers.forEach((item) => {
					if (item.file) formData.append("artboardLayers", item.file);
				});
				formData.append("artboardLayerMeta", JSON.stringify(artboardLayerMeta));

				const firstUploadedThumbnail = thumbnailAssets.find((item) => item.file)?.file ?? null;
				const primaryBaseFile = viewAssets.primary.baseMockup?.file ?? firstArtboardFile ?? firstUploadedThumbnail;
				if (primaryBaseFile) {
					formData.append("primaryBaseMockup", primaryBaseFile);
				}
				const primaryOverlayFile = viewAssets.primary.overlayImage?.file ?? topNormalArtboardFile;
				if (primaryOverlayFile) {
					formData.append("primaryOverlayImage", primaryOverlayFile);
				}
				if (viewAssets.front.baseMockup?.file) {
					formData.append("frontBaseMockup", viewAssets.front.baseMockup.file);
				}
				if (viewAssets.front.overlayImage?.file) {
					formData.append("frontOverlayImage", viewAssets.front.overlayImage.file);
				}
				if (viewAssets.back.baseMockup?.file) {
					formData.append("backBaseMockup", viewAssets.back.baseMockup.file);
				}
				if (viewAssets.back.overlayImage?.file) {
					formData.append("backOverlayImage", viewAssets.back.overlayImage.file);
				}

				(["multiply", "screen", "overlay"] as BlendLayerKey[]).forEach((layer) => {
					const mappedLayerFile = blendAssets[layer]?.file ?? firstBlendFileByMode(layer);
					if (mappedLayerFile) {
						formData.append(layer, mappedLayerFile);
					}
				});

				if (designAreaSlots.body?.file) formData.append("designAreaBody", designAreaSlots.body.file);
				if (designAreaSlots.leftSleeve?.file) formData.append("designAreaLeftSleeve", designAreaSlots.leftSleeve.file);
				if (designAreaSlots.rightSleeve?.file) formData.append("designAreaRightSleeve", designAreaSlots.rightSleeve.file);

				// Design Area Images array
				let _daUpdateIdx = 0;
				let _sizeUpdateIdx = 0;
				const daUpdateMeta = designAreaAssets.map((item) => {
					const label = item.displayName?.trim() || item.name;
					const base: Record<string, unknown> = item.file
						? { fileIndex: _daUpdateIdx++, label }
						: { url: item.src, label };
					const corners = perspectiveCornersById[item.id];
					if (corners && !isDefaultCorners(corners)) base.perspectiveCorners = corners;
					const st = sizeTransformByAreaId[item.id];
					if (st && (st.x !== 0 || st.y !== 0 || st.scale !== 1 || st.rotation !== 0)) base.sizeTransform = st;
					const si = sizeImageByAreaId[item.id];
					if (si) {
						if (si.file) base.sizeImageFileIndex = _sizeUpdateIdx++;
						else if (si.src) base.sizeImageUrl = si.src;
					}
					return base;
				});
				designAreaAssets.forEach((item) => { if (item.file) formData.append("designAreaImages", item.file); });
				designAreaAssets.forEach((item) => {
					const si = sizeImageByAreaId[item.id];
					if (si?.file) formData.append("sizeImages", si.file);
				});
				formData.append("designAreaImagesMeta", JSON.stringify(daUpdateMeta));

				let _caUpdateIdx = 0;
				const caUpdateMeta = colorAreaAssets.map((item) => {
					const label = item.displayName?.trim() || item.name;
					if (item.file) return { fileIndex: _caUpdateIdx++, label };
					return { url: item.src, label };
				});
				colorAreaAssets.forEach((item) => { if (item.file) formData.append("colorAreaImages", item.file); });
				formData.append("colorAreaImagesMeta", JSON.stringify(caUpdateMeta));

				let _defaultUpdateIdx = 0;
				const defaultUpdateMeta = defaultImageAssets.map((item) => {
					const label = item.name;
					if (item.file) return { fileIndex: _defaultUpdateIdx++, label };
					return { url: item.src, label };
				});
				defaultImageAssets.forEach((item) => { if (item.file) formData.append("defaultImages", item.file); });
				formData.append("defaultImagesMeta", JSON.stringify(defaultUpdateMeta));

				if (colorAreaSlots.body?.file) formData.append("colorAreaBody", colorAreaSlots.body.file);
				if (colorAreaSlots.sleeves?.file) formData.append("colorAreaSleeves", colorAreaSlots.sleeves.file);
				if (colorAreaSlots.collar?.file) formData.append("colorAreaCollar", colorAreaSlots.collar.file);

				const response = await fetch(`${apiBaseUrl}/mockups/${editingProductId}`, {
					method: "PUT",
					credentials: "include",
					headers: getAdminHeaders(),
					body: formData,
				});

				const result = await response.json();
				if (!response.ok || !result?.ok) {
					throw new Error(result?.message || "Product update failed.");
				}

				const updated = result.item;
				const previewImage =
					updated.thumbnails?.[0]?.url ||
					thumbnailAssets.find((item) => item.id === selectedThumbnailId)?.src ||
					thumbnailAssets[0]?.src ||
					"https://images.unsplash.com/photo-1634032188532-f11af97817ab?auto=format&fit=crop&w=1080&q=80";

				setProducts((prev) =>
					prev.map((item) =>
						item.id === editingProductId
							? {
								...item,
								title: updated.title,
								category: updated.category,
								thumbnail: previewImage,
								status: updated.status === "published" ? "Published" : "Draft",
							}
							: item,
					),
				);

				setUploadSuccess("Product updated successfully.");
				resetStructuredProductForm();
				setView("products");
			} catch (error) {
				setUploadError(error instanceof Error ? error.message : "Product update failed.");
			} finally {
				setIsUploadingProduct(false);
			}
			return;
		}

		setIsUploadingProduct(true);
		setUploadError("");
		setUploadSuccess("");

		try {
			const formData = new FormData();
			formData.append("title", productDraft.title.trim());
			formData.append("description", productDraft.description.trim());
			formData.append("mainCategory", productDraft.mainCategory.trim());
			formData.append("category", productDraft.category.trim());
			formData.append("status", "published");
			formData.append("objectKey", productDraft.objectKey.trim());

			thumbnailAssets.forEach((item) => {
				if (item.file) {
					formData.append("thumbnails", item.file);
				}
			});
			let _createFileIndex = 0;
			const createLayerMeta = visibleArtboardLayers.map((item) => {
				const mode = layerBlendModes[item.id] || "normal";
				if (item.file) return { fileIndex: _createFileIndex++, label: item.name, blendMode: mode };
				return { url: item.src, label: item.name, blendMode: mode };
			});
			visibleArtboardLayers.forEach((item) => {
				if (item.file) formData.append("artboardLayers", item.file);
			});
			formData.append("artboardLayerMeta", JSON.stringify(createLayerMeta));

			const firstUploadedThumbnail = thumbnailAssets.find((item) => item.file)?.file ?? null;
			const primaryBaseFile = viewAssets.primary.baseMockup?.file ?? firstArtboardFile ?? firstUploadedThumbnail;
			if (primaryBaseFile) {
				formData.append("primaryBaseMockup", primaryBaseFile);
			}
			const primaryOverlayFile = viewAssets.primary.overlayImage?.file ?? topNormalArtboardFile;
			if (primaryOverlayFile) {
				formData.append("primaryOverlayImage", primaryOverlayFile);
			}
			if (viewAssets.front.baseMockup?.file) {
				formData.append("frontBaseMockup", viewAssets.front.baseMockup.file);
			}
			if (viewAssets.front.overlayImage?.file) {
				formData.append("frontOverlayImage", viewAssets.front.overlayImage.file);
			}
			if (viewAssets.back.baseMockup?.file) {
				formData.append("backBaseMockup", viewAssets.back.baseMockup.file);
			}
			if (viewAssets.back.overlayImage?.file) {
				formData.append("backOverlayImage", viewAssets.back.overlayImage.file);
			}

			(["multiply", "screen", "overlay"] as BlendLayerKey[]).forEach((layer) => {
				const mappedLayerFile = blendAssets[layer]?.file ?? firstBlendFileByMode(layer);
				if (mappedLayerFile) {
					formData.append(layer, mappedLayerFile);
				}
			});

			if (designAreaSlots.body?.file) formData.append("designAreaBody", designAreaSlots.body.file);
			if (designAreaSlots.leftSleeve?.file) formData.append("designAreaLeftSleeve", designAreaSlots.leftSleeve.file);
			if (designAreaSlots.rightSleeve?.file) formData.append("designAreaRightSleeve", designAreaSlots.rightSleeve.file);

			// Design Area Images array
			let _daCreateIdx = 0;
			let _sizeCreateIdx = 0;
			const daCreateMeta = designAreaAssets.map((item) => {
				const label = item.displayName?.trim() || item.name;
				const base: Record<string, unknown> = item.file
					? { fileIndex: _daCreateIdx++, label }
					: { url: item.src, label };
				const corners = perspectiveCornersById[item.id];
				if (corners && !isDefaultCorners(corners)) base.perspectiveCorners = corners;
				const st = sizeTransformByAreaId[item.id];
				if (st && (st.x !== 0 || st.y !== 0 || st.scale !== 1 || st.rotation !== 0)) base.sizeTransform = st;
				const si = sizeImageByAreaId[item.id];
				if (si) {
					if (si.file) base.sizeImageFileIndex = _sizeCreateIdx++;
					else if (si.src) base.sizeImageUrl = si.src;
				}
				return base;
			});
			designAreaAssets.forEach((item) => { if (item.file) formData.append("designAreaImages", item.file); });
			designAreaAssets.forEach((item) => {
				const si = sizeImageByAreaId[item.id];
				if (si?.file) formData.append("sizeImages", si.file);
			});
			formData.append("designAreaImagesMeta", JSON.stringify(daCreateMeta));

			let _caCreateIdx = 0;
			const caCreateMeta = colorAreaAssets.map((item) => {
				const label = item.displayName?.trim() || item.name;
				if (item.file) return { fileIndex: _caCreateIdx++, label };
				return { url: item.src, label };
			});
			colorAreaAssets.forEach((item) => { if (item.file) formData.append("colorAreaImages", item.file); });
			formData.append("colorAreaImagesMeta", JSON.stringify(caCreateMeta));

			let _defaultCreateIdx = 0;
			const defaultCreateMeta = defaultImageAssets.map((item) => {
				const label = item.name;
				if (item.file) return { fileIndex: _defaultCreateIdx++, label };
				return { url: item.src, label };
			});
			defaultImageAssets.forEach((item) => { if (item.file) formData.append("defaultImages", item.file); });
			formData.append("defaultImagesMeta", JSON.stringify(defaultCreateMeta));

			if (colorAreaSlots.body?.file) formData.append("colorAreaBody", colorAreaSlots.body.file);
			if (colorAreaSlots.sleeves?.file) formData.append("colorAreaSleeves", colorAreaSlots.sleeves.file);
			if (colorAreaSlots.collar?.file) formData.append("colorAreaCollar", colorAreaSlots.collar.file);

			const response = await fetch(`${apiBaseUrl}/mockups`, {
				method: "POST",
				credentials: "include",
				headers: getAdminHeaders(),
				body: formData,
			});

			const result = await response.json();

			if (!response.ok || !result?.ok) {
				throw new Error(result?.message || "Product upload failed.");
			}

			const item = result.item;
			const previewImage =
				item.thumbnails?.[0]?.url ||
				item.views?.primary?.baseMockup?.url ||
				artboardPreview ||
				thumbnailAssets[0]?.src ||
				"https://images.unsplash.com/photo-1634032188532-f11af97817ab?auto=format&fit=crop&w=1080&q=80";

			setProducts((prev) => [
				{
					id: item._id,
					thumbnail: previewImage,
					title: item.title,
					category: item.category,
					downloads: 0,
					status: item.status === "published" ? "Published" : "Draft",
					createdAt: item.createdAt,
				},
				...prev,
			]);

			setUploadSuccess("Product uploaded successfully.");
			resetStructuredProductForm();
			setView("products");
		} catch (error) {
			setUploadError(error instanceof Error ? error.message : "Product upload failed.");
		} finally {
			setIsUploadingProduct(false);
		}
	};

	const renderContent = () => {
		if (view === "dashboard") {
			return (
				<div className="space-y-6">
					<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
						<StatCard icon={Users} label="Total Users" value={dashboardTotals.users.toString()} />
						<StatCard icon={Box} label="Total Mockups" value={dashboardTotals.products.toString()} />
						<StatCard icon={Download} label="Downloads" value={dashboardTotals.downloads.toLocaleString()} />
					</div>

					<section className="rounded-xl border border-white/8 bg-[#16161F] p-6 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
						<h3 className="text-lg font-semibold text-zinc-100">Platform Snapshot</h3>
						<p className="mt-2 text-sm text-zinc-400">
							Mockyo admin is optimized for quick control: publish products, monitor downloads, and track users from one clean panel.
						</p>
					</section>
				</div>
			);
		}

		if (view === "products") {
			return (
				<section className="rounded-xl border border-white/8 bg-[#16161F] p-6 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
					<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
						<h3 className="text-lg font-semibold text-zinc-100">Products</h3>
						<button
							type="button"
							onClick={() => {
								resetStructuredProductForm();
								setAddProductStep(1);
								setView("add-product");
							}}
							className="rounded-lg bg-[#FF6B35] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#ff7d4f]"
						>
							Add Product
						</button>
					</div>

					<div className="overflow-x-auto">
						<table className="w-full min-w-[760px] text-left text-sm">
							<thead>
								<tr className="border-b border-white/8 text-zinc-400">
									<th className="py-3 font-medium">Thumbnail</th>
									<th className="py-3 font-medium">Title</th>
									<th className="py-3 font-medium">Category</th>
									<th className="py-3 font-medium">Downloads</th>
									<th className="py-3 font-medium">Status</th>
									<th className="py-3 font-medium text-right">Actions</th>
								</tr>
							</thead>
							<tbody>
								{filteredProducts.map((product) => (
									<tr key={product.id} className="border-b border-white/6 text-zinc-200">
										<td className="py-3">
											<img
												src={product.thumbnail}
												alt={product.title}
												className="h-12 w-12 rounded-lg object-cover"
											/>
										</td>
										<td className="py-3">{product.title}</td>
										<td className="py-3 text-zinc-400">{product.category}</td>
										<td className="py-3">{product.downloads.toLocaleString()}</td>
										<td className="py-3">
											<span
												className={`rounded-full px-2.5 py-1 text-xs ${
													product.status === "Published"
														? "bg-emerald-500/12 text-emerald-300"
														: "bg-zinc-500/15 text-zinc-300"
												}`}
											>
												{product.status}
											</span>
										</td>
										<td className="py-3">
											<div className="flex items-center justify-end gap-2">
												<button
													type="button"
													onClick={() => handleEditProduct(product)}
													className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-zinc-200 transition hover:border-[#FF6B35]/40 hover:text-[#FF6B35]"
												>
													<Pencil className="h-3.5 w-3.5" />
													Edit
												</button>
												<button
													type="button"
													onClick={() => handleDelete(product.id)}
													className="inline-flex items-center gap-1 rounded-md border border-red-400/20 px-2.5 py-1.5 text-xs text-red-300 transition hover:bg-red-500/10"
												>
													<Trash2 className="h-3.5 w-3.5" />
													Delete
												</button>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</section>
			);
		}

		if (view === "add-product") {

		// ─── Step 2: Details + Thumbnails ───────────────────────────────────────
		if (addProductStep === 2) {
			return (
				<section className="space-y-6">
					{/* Header */}
					<div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-white/8 bg-[#16161F] p-6 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
						<div>
							<p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FF6B35]">Step 2 of 2</p>
							<h2 className="mt-1 text-2xl font-semibold text-zinc-100">{editingProductId ? "Edit Product" : "Product Details"}</h2>
							<p className="mt-1 text-sm text-zinc-400">Fill in the product info and upload thumbnail images.</p>
						</div>
						<div className="flex items-center gap-3">
							<button
								type="button"
								onClick={() => {
									if (editingProductId) {
										resetStructuredProductForm();
										setAddProductStep(1);
										setView("products");
										return;
									}
									setAddProductStep(1);
								}}
								className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-[#FF6B35]/40 hover:text-[#FF6B35]"
							>
								Back
							</button>
							<button
								type="button"
								onClick={handleUploadProduct}
								disabled={isUploadingProduct}
								className="rounded-lg bg-[#FF6B35] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#ff7d4f] disabled:opacity-60"
							>
								{isUploadingProduct ? "Publishing…" : editingProductId ? "Update" : "Publish"}
							</button>
						</div>
					</div>

					{uploadError && (
						<div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{uploadError}</div>
					)}

					{/* Two-panel layout */}
					<div className="flex flex-col gap-6 xl:flex-row">
						{/* Left: Details form */}
						<div className="rounded-xl border border-white/8 bg-[#16161F] p-6 shadow-[0_12px_30px_rgba(0,0,0,0.18)] xl:w-[360px]">
							<h3 className="mb-5 text-base font-semibold text-zinc-100">Details</h3>
							<div className="space-y-4">
								<div>
									<label className="mb-1.5 block text-xs font-medium text-zinc-400">Title <span className="text-red-400">*</span></label>
									<input
										type="text"
										value={productDraft.title}
										onChange={(e) => setProductDraft((p) => ({ ...p, title: e.target.value }))}
										placeholder="e.g. Premium Hoodie Mockup"
										className="h-10 w-full rounded-lg border border-white/10 bg-[#0E0E14] px-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-[#FF6B35]"
									/>
								</div>
								<div>
									<label className="mb-1.5 block text-xs font-medium text-zinc-400">Description <span className="text-red-400">*</span></label>
									<textarea
										value={productDraft.description}
										onChange={(e) => setProductDraft((p) => ({ ...p, description: e.target.value }))}
										placeholder="Short product description…"
										rows={3}
										className="w-full rounded-lg border border-white/10 bg-[#0E0E14] px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-[#FF6B35] resize-none"
									/>
								</div>
								<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
									<div>
										<label className="mb-1.5 block text-xs font-medium text-zinc-400">Main Category</label>
										<select
											value={productDraft.mainCategory}
											onChange={(e) => setProductDraft((p) => ({ ...p, mainCategory: e.target.value }))}
											className="h-10 w-full rounded-lg border border-white/10 bg-[#0E0E14] px-3 text-sm text-zinc-100 outline-none transition focus:border-[#FF6B35]"
										>
											{mainCategories.map((item) => (
												<option key={item} value={item}>{item}</option>
											))}
										</select>
									</div>
									<div>
										<label className="mb-1.5 block text-xs font-medium text-zinc-400">Category <span className="text-red-400">*</span></label>
										<select
											value={productDraft.category}
											onChange={(e) => setProductDraft((p) => ({ ...p, category: e.target.value }))}
											className="h-10 w-full rounded-lg border border-white/10 bg-[#0E0E14] px-3 text-sm text-zinc-100 outline-none transition focus:border-[#FF6B35]"
										>
											{categories.map((item) => (
												<option key={item} value={item}>{item}</option>
											))}
										</select>
									</div>
								</div>
								<div>
									<label className="mb-1.5 block text-xs font-medium text-zinc-400">Object Key</label>
									<input
										type="text"
										value={productDraft.objectKey}
										onChange={(e) => setProductDraft((p) => ({ ...p, objectKey: e.target.value }))}
										placeholder="e.g. Oversized T-shirt Mockup Front View.zip"
										className="h-10 w-full rounded-lg border border-white/10 bg-[#0E0E14] px-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-[#FF6B35]"
									/>
									<p className="mt-2 text-xs text-zinc-500">
										এই product download করার সময় backend শুধু এই object key-টাই ধরবে. Public link বা fallback link আর use হবে না.
									</p>
								</div>
							</div>
						</div>

						{/* Right: Thumbnails */}
						<div className="flex-1 rounded-xl border border-white/8 bg-[#16161F] p-6 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
							<div className="mb-5 flex items-center justify-between">
								<h3 className="text-base font-semibold text-zinc-100">Thumbnails</h3>
							</div>
							<p className="mb-4 text-xs text-zinc-500">
								Allowed per image: min {THUMBNAIL_MIN_SIZE_LABEL}, max {THUMBNAIL_MAX_SIZE_LABEL} (up to 4 images). Resolution: {THUMBNAIL_DIMENSION_LABEL}.
							</p>

							{thumbnailAssets.length === 0 ? (
								<button
									type="button"
									onClick={() => thumbnailInputRef.current?.click()}
									className="flex h-64 w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/20 bg-white/3 text-zinc-400 transition hover:border-[#FF6B35]/40 hover:bg-white/5 hover:text-[#FF6B35]"
								>
									<Upload className="h-7 w-7" />
									<div className="text-center">
										<p className="text-sm font-medium">Click to upload thumbnails</p>
										<p className="mt-0.5 text-xs text-zinc-500">PNG, JPG | {THUMBNAIL_MIN_SIZE_LABEL} - {THUMBNAIL_MAX_SIZE_LABEL} each | {THUMBNAIL_DIMENSION_LABEL}</p>
									</div>
								</button>
							) : (() => {
								const activeImg = thumbnailAssets.find((i) => i.id === selectedThumbnailId) ?? thumbnailAssets[0];
								return (
									<div>
										{/* Large preview */}
										<div className="relative mb-3 overflow-hidden rounded-xl border border-white/10 bg-black/30" style={{ aspectRatio: "1/1" }}>
											<img src={activeImg.src} alt={activeImg.name} className="h-full w-full object-cover" />
											<button
												type="button"
												onClick={() => {
													removeUploadedItem(activeImg.id, setThumbnailAssets);
													setSelectedThumbnailId(thumbnailAssets.find((i) => i.id !== activeImg.id)?.id ?? null);
												}}
												className="absolute right-2 top-2 rounded-md bg-black/60 p-1.5 text-zinc-300 transition hover:text-red-300"
												aria-label="Remove thumbnail"
											>
												<X className="h-4 w-4" />
											</button>
											<p className="absolute bottom-0 left-0 right-0 truncate bg-black/60 px-3 py-1.5 text-xs text-zinc-300">{activeImg.name}</p>
										</div>
										{/* Small strip */}
										<div className="flex gap-2">
											{thumbnailAssets.map((img) => (
												<button
													key={img.id}
													type="button"
													onClick={() => setSelectedThumbnailId(img.id)}
													className={`relative aspect-square w-1/4 overflow-hidden rounded-lg border-2 transition ${
														img.id === activeImg.id ? "border-[#FF6B35]" : "border-white/10 hover:border-white/30"
													}`}
												>
													<img src={img.src} alt={img.name} className="h-full w-full object-cover" />
												</button>
											))}
											{thumbnailAssets.length < 4 && (
												<button
													type="button"
													onClick={() => thumbnailInputRef.current?.click()}
													className="flex aspect-square w-1/4 items-center justify-center rounded-lg border-2 border-dashed border-white/20 text-zinc-500 transition hover:border-[#FF6B35]/40 hover:text-[#FF6B35]"
												>
													<Upload className="h-5 w-5" />
												</button>
											)}
										</div>
									</div>
								);
							})()}

							<input
								ref={thumbnailInputRef}
								type="file"
								accept="image/*"
								multiple
								onChange={(e) => handleThumbnailUpload(e.currentTarget.files)}
								className="hidden"
								aria-label="Upload thumbnail images"
							/>
						</div>
					</div>
				</section>
			);
		}

		// ─── Step 1: Layers + Artboard ──────────────────────────────────────────
		return (
			<section className="space-y-6">
				<div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-white/8 bg-[#16161F] p-6 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
					<div>
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FF6B35]">Step 1 of 2</p>
						<h2 className="mt-1 text-2xl font-semibold text-zinc-100">{editingProductId ? "Edit Product" : "Add Product"}</h2>
						<p className="mt-1 text-sm text-zinc-400">Set up your layers and preview the composition before moving to the next step.</p>
					</div>
					<div className="flex items-center gap-3">
						<button
							type="button"
							onClick={() => setView("products")}
							className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-[#FF6B35]/40 hover:text-[#FF6B35]"
						>
							Back
						</button>
						<button
							type="button"
							onClick={() => setAddProductStep(2)}
							className="rounded-lg bg-[#FF6B35] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#ff7d4f]"
						>
							Next
						</button>
					</div>
				</div>
				<div className="grid gap-6 xl:grid-cols-[0.64fr_1.36fr] xl:items-stretch">
					<div className="rounded-xl border border-white/8 bg-[#16161F] p-6 shadow-[0_12px_30px_rgba(0,0,0,0.18)] xl:h-full xl:max-h-[680px] xl:overflow-y-auto">
						<div className="mb-6">
							<div>
								<h3 className="text-lg font-semibold text-zinc-100">Layers</h3>
								<p className="mt-2 text-sm text-zinc-400">Manage mockup layers and preview controls here.</p>
							</div>
						</div>
						<div className="rounded-2xl border border-white/10 bg-white/5 p-5">
							<div className="mb-3">
								<p className="text-sm font-medium text-zinc-100">Blend Mode</p>
							</div>
							<select
								value={selectedLayerImageId ? (layerBlendModes[selectedLayerImageId] || "normal") : "normal"}
								onChange={(e) => {
									if (selectedLayerImageId) {
										setLayerBlendModes((prev) => ({
											...prev,
											[selectedLayerImageId]: e.target.value as PreviewBlendMode,
										}));
									}
								}}
								disabled={!selectedLayerImageId}
								className={`h-11 w-full rounded-xl border border-white/10 bg-[#0E0E14] px-3 text-sm text-zinc-100 outline-none transition focus:border-[#FF6B35] ${
									!selectedLayerImageId ? "cursor-not-allowed opacity-50" : ""
								}`}
							>
								<option value="normal">Normal</option>
								<option value="multiply">Multiply</option>
								<option value="screen">Screen</option>
								<option value="overlay">Overlay</option>
							</select>
						</div>

						<div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5">
							<div className="mb-3 flex items-center justify-between">
								<p className="text-sm font-medium text-zinc-100">Actions</p>
								<button
									type="button"
									onClick={() => {
										if (selectedColorAreaId) {
											setColorAreaAssets((prev) => prev.filter((item) => item.id !== selectedColorAreaId));
											setVisibleColorAreas((prev) => {
												const next = new Set(prev);
												next.delete(selectedColorAreaId);
												return next;
											});
											setSelectedColorAreaId(null);
										} else if (selectedDefaultImageId) {
											setDefaultImageAssets((prev) => prev.filter((item) => item.id !== selectedDefaultImageId));
											setVisibleDefaultImages((prev) => {
												const next = new Set(prev);
												next.delete(selectedDefaultImageId);
												return next;
											});
											setSelectedDefaultImageId(null);
										} else if (selectedDesignAreaId) {
											setDesignAreaAssets((prev) => prev.filter((item) => item.id !== selectedDesignAreaId));
											setVisibleDesignAreas((prev) => {
												const next = new Set(prev);
												next.delete(selectedDesignAreaId);
												return next;
											});
											setSelectedDesignAreaId(null);
										} else if (selectedLayerImageId) {
											setArtboardLayerImages((prev) => prev.filter((img) => img.id !== selectedLayerImageId));
											const newModes = { ...layerBlendModes };
											delete newModes[selectedLayerImageId];
											setLayerBlendModes(newModes);
											const newVisible = new Set(visibleLayers);
											newVisible.delete(selectedLayerImageId);
											setVisibleLayers(newVisible);
											setSelectedLayerImageId(null);
										}
									}}
									disabled={!selectedLayerImageId && !selectedDesignAreaId && !selectedColorAreaId && !selectedDefaultImageId}
									className={`rounded transition ${
										(selectedLayerImageId || selectedDesignAreaId || selectedColorAreaId || selectedDefaultImageId)
											? "cursor-pointer text-red-400 hover:text-red-300"
											: "cursor-not-allowed text-zinc-600"
									}`}
								>
									<Trash2 className="h-5 w-5" />
								</button>
							</div>
						</div>

						<div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5">
							<div className="mb-3">
								<p className="text-sm font-medium text-zinc-100">Blending Images</p>
							</div>
							{artboardLayerImages.length > 0 ? (
								<div className="space-y-2">
									{artboardLayerImages.map((image) => (
										<div
											key={image.id}
											className="flex items-center gap-2"
										>
											<button
												type="button"
												draggable
												onDragStart={(e) => handleLayerDragStart(e, image.id)}
												onDragOver={handleLayerDragOver}
												onDrop={(e) => handleLayerDrop(e, image.id)}
												onDragEnd={handleLayerDragEnd}
												onClick={() => toggleExclusiveLayerSelection("blend", image.id)}
												className={`flex-1 cursor-move rounded-lg border p-2 transition ${
													draggedLayerId === image.id
														? "border-yellow-500 bg-yellow-500/10 opacity-50"
														: selectedLayerImageId === image.id
															? "border-[#FF6B35] bg-[#FF6B35]/10"
															: "border-white/10 bg-black/30 hover:border-white/20"
												}`}
											>
												<p className="truncate text-left text-xs text-zinc-300">{image.name}</p>
											</button>
											<button
												type="button"
												onClick={() => {
													const newVisible = new Set(visibleLayers);
													if (newVisible.has(image.id)) {
														newVisible.delete(image.id);
													} else {
														newVisible.add(image.id);
													}
													setVisibleLayers(newVisible);
												}}
												className="rounded p-1 text-zinc-400 transition hover:text-zinc-200"
											>
												{visibleLayers.has(image.id) ? (
													<Eye className="h-4 w-4" />
												) : (
													<Ban className="h-4 w-4" />
												)}
											</button>
										</div>
									))}
									<button
										type="button"
										onClick={() => artboardLayerInputRef.current?.click()}
										className="w-full rounded-xl border border-dashed border-white/20 bg-white/5 px-3 py-2 text-xs text-zinc-400 transition hover:border-[#FF6B35]/40 hover:bg-white/10 hover:text-[#FF6B35]"
									>
										<div className="flex items-center justify-center gap-1">
											<Upload className="h-3.5 w-3.5" />
											Add More
										</div>
									</button>
								</div>
							) : (
								<button
									type="button"
									onClick={() => artboardLayerInputRef.current?.click()}
									className="w-full rounded-xl border border-dashed border-white/20 bg-white/5 px-3 py-3 text-sm text-zinc-400 transition hover:border-[#FF6B35]/40 hover:bg-white/10 hover:text-[#FF6B35]"
								>
									<div className="flex items-center justify-center gap-2">
										<Upload className="h-4 w-4" />
										Upload Images
									</div>
								</button>
							)}
							<input
								ref={artboardLayerInputRef}
								type="file"
								accept="image/*"
								multiple
								onChange={(e) => handleArtboardLayerUpload(e.currentTarget.files)}
								className="hidden"
								aria-label="Upload artboard layer images"
							/>
						</div>

						<div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5">
							<div className="mb-3">
								<p className="text-sm font-medium text-zinc-100">Design Area Images</p>
							</div>
							{designAreaAssets.length > 0 ? (
								<div className="space-y-2">
									{designAreaAssets.map((image) => (
										<div key={image.id} className="space-y-1.5">
											<div
												draggable
												onDragStart={(e) => handleDesignAreaDragStart(e, image.id)}
												onDragOver={handleDesignAreaDragOver}
												onDrop={(e) => handleDesignAreaDrop(e, image.id)}
												onDragEnd={handleDesignAreaDragEnd}
												onClick={() => toggleExclusiveLayerSelection("design", image.id)}
												className={`space-y-1.5 rounded-lg border p-2 transition cursor-move ${
													draggedDesignAreaId === image.id
														? "border-yellow-500 bg-yellow-500/10 opacity-60"
														: selectedDesignAreaId === image.id
														? "border-[#FF6B35] bg-[#FF6B35]/10"
														: "border-white/10 bg-black/30 hover:border-white/20"
												}`}
											>
												<div className="flex items-center gap-2">
													<p className="flex-1 truncate text-xs text-zinc-300">{image.name}</p>
													<button
														type="button"
														onClick={(e) => {
															e.stopPropagation();
															setVisibleDesignAreas((prev) => {
																const next = new Set(prev);
																if (next.has(image.id)) next.delete(image.id);
																else next.add(image.id);
																return next;
															});
														}}
														className="rounded p-1 text-zinc-400 transition hover:text-zinc-200"
														aria-label="Toggle design area visibility"
													>
														{visibleDesignAreas.has(image.id) ? (
															<Eye className="h-4 w-4" />
														) : (
															<Ban className="h-4 w-4" />
														)}
													</button>
												</div>
												<input
													type="text"
													value={image.displayName ?? image.name}
													onClick={(e) => e.stopPropagation()}
													onChange={(e) => {
														const next = e.target.value;
														setDesignAreaAssets((prev) =>
															prev.map((item) =>
																item.id === image.id ? { ...item, displayName: next } : item,
															),
														);
													}}
													placeholder="Editor layer name (e.g. Upload Design for Body)"
													className="w-full rounded-md border border-white/15 bg-black/35 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-[#FF6B35]"
												/>
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation();
														sizeImageInputRefs.current[image.id]?.click();
													}}
													className={`w-full rounded-md border px-2 py-1 text-[10px] font-medium transition ${
														sizeImageByAreaId[image.id]
															? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
															: "border-white/15 bg-black/25 text-zinc-400 hover:border-[#FF6B35]/40 hover:text-[#FF6B35]"
													}`}
												>
													{sizeImageByAreaId[image.id] ? "✓ Size Uploaded — Change" : "⊞ Upload Size"}
												</button>
												<input
													ref={(el) => { sizeImageInputRefs.current[image.id] = el; }}
													type="file"
													accept="image/*"
													className="hidden"
													onChange={(e) => {
														const file = e.currentTarget.files?.[0];
														if (!file) return;
														const reader = new FileReader();
														reader.onload = () => {
															const dataUrl = typeof reader.result === "string" ? reader.result : "";
															setSizeImageByAreaId((prev) => ({
																...prev,
																[image.id]: { src: dataUrl, file },
															}));
															const img = new Image();
															img.onload = () => {
																setSizeImageNaturalSizeById((prev) => ({ ...prev, [image.id]: { w: img.naturalWidth, h: img.naturalHeight } }));
															};
															img.src = dataUrl;
														};
														reader.readAsDataURL(file);
														e.currentTarget.value = "";
													}}
												/>
											</div>
										</div>
									))}
									<button
										type="button"
										onClick={() => designAreaInputRef.current?.click()}
										className="w-full rounded-xl border border-dashed border-white/20 bg-white/5 px-3 py-2 text-xs text-zinc-400 transition hover:border-[#FF6B35]/40 hover:bg-white/10 hover:text-[#FF6B35]"
									>
										<div className="flex items-center justify-center gap-1">
											<Upload className="h-3.5 w-3.5" />
											Add More
										</div>
									</button>
								</div>
							) : (
								<button
									type="button"
									onClick={() => designAreaInputRef.current?.click()}
									className="w-full rounded-xl border border-dashed border-white/20 bg-white/5 px-3 py-3 text-sm text-zinc-400 transition hover:border-[#FF6B35]/40 hover:bg-white/10 hover:text-[#FF6B35]"
								>
									<div className="flex items-center justify-center gap-2">
										<Upload className="h-4 w-4" />
										Upload Images
									</div>
								</button>
							)}
							<input
								ref={designAreaInputRef}
								type="file"
								accept="image/*"
								multiple
								onChange={(e) => handleDesignAreaUpload(e.currentTarget.files)}
								className="hidden"
								aria-label="Upload design area images"
							/>
						</div>

						<div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5">
							<div className="mb-3">
								<p className="text-sm font-medium text-zinc-100">Color Area Images</p>
							</div>
							{colorAreaAssets.length > 0 ? (
								<div className="space-y-2">
									{colorAreaAssets.map((image) => (
										<div key={image.id} className="space-y-1.5">
											<div
												draggable
												onDragStart={(e) => handleColorAreaDragStart(e, image.id)}
												onDragOver={handleColorAreaDragOver}
												onDrop={(e) => handleColorAreaDrop(e, image.id)}
												onDragEnd={handleColorAreaDragEnd}
												onClick={() => toggleExclusiveLayerSelection("color", image.id)}
												className={`space-y-1.5 rounded-lg border p-2 transition cursor-move ${
													draggedColorAreaId === image.id
														? "border-yellow-500 bg-yellow-500/10 opacity-60"
														: selectedColorAreaId === image.id
															? "border-[#FF6B35] bg-[#FF6B35]/10"
															: "border-white/10 bg-black/30 hover:border-white/20"
												}`}
											>
												<div className="flex items-center gap-2">
													<p className="flex-1 truncate text-xs text-zinc-300">{image.name}</p>
													<button
														type="button"
														onClick={(e) => {
															e.stopPropagation();
															setVisibleColorAreas((prev) => {
																const next = new Set(prev);
																if (next.has(image.id)) next.delete(image.id);
																else next.add(image.id);
																return next;
															});
														}}
														className="rounded p-1 text-zinc-400 transition hover:text-zinc-200"
														aria-label="Toggle color area visibility"
													>
														{visibleColorAreas.has(image.id) ? (
															<Eye className="h-4 w-4" />
														) : (
															<Ban className="h-4 w-4" />
														)}
													</button>
												</div>
												<input
													type="text"
													value={image.displayName ?? image.name}
													onClick={(e) => e.stopPropagation()}
													onChange={(e) => {
														const next = e.target.value;
														setColorAreaAssets((prev) =>
															prev.map((item) =>
																item.id === image.id ? { ...item, displayName: next } : item,
															),
														);
													}}
													placeholder="Editor layer name (e.g. Choose color area)"
													className="w-full rounded-md border border-white/15 bg-black/35 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-[#FF6B35]"
												/>
											</div>
										</div>
									))}
									<button
										type="button"
										onClick={() => colorAreaInputRef.current?.click()}
										className="w-full rounded-xl border border-dashed border-white/20 bg-white/5 px-3 py-2 text-xs text-zinc-400 transition hover:border-[#FF6B35]/40 hover:bg-white/10 hover:text-[#FF6B35]"
									>
										<div className="flex items-center justify-center gap-1">
											<Upload className="h-3.5 w-3.5" />
											Add More
										</div>
									</button>
								</div>
							) : (
								<button
									type="button"
									onClick={() => colorAreaInputRef.current?.click()}
									className="w-full rounded-xl border border-dashed border-white/20 bg-white/5 px-3 py-3 text-sm text-zinc-400 transition hover:border-[#FF6B35]/40 hover:bg-white/10 hover:text-[#FF6B35]"
								>
									<div className="flex items-center justify-center gap-2">
										<Upload className="h-4 w-4" />
										Upload Images
									</div>
								</button>
							)}
							<input
								ref={colorAreaInputRef}
								type="file"
								accept="image/*"
								multiple
								onChange={(e) => handleColorAreaUpload(e.currentTarget.files)}
								className="hidden"
								aria-label="Upload color area images"
							/>
						</div>


					</div>
					<div className="xl:h-full">
						<div className="mx-auto mb-2 flex w-full max-w-[680px] items-center justify-end gap-2">
							<button
								type="button"
								onClick={() => setIsHandToolEnabled((prev) => !prev)}
								className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition ${
									isHandToolEnabled
										? "border-[#FF6B35]/70 bg-[#FF6B35]/20 text-[#FF6B35]"
										: "border-white/20 bg-white/5 text-zinc-300 hover:border-[#FF6B35]/40 hover:text-[#FF6B35]"
								}`}
								aria-pressed={isHandToolEnabled}
							>
								<Move className="h-3.5 w-3.5" />
								Hand Tool
							</button>
						</div>
						<div ref={artboardStageRef} className="relative mx-auto w-full max-w-[680px] aspect-square overflow-hidden">
							<div
								ref={draggableArtboardRef}
								onWheel={handleArtboardWheel}
								onMouseDown={() => {
									if (!isHandToolEnabled) setSizeTransformEditingAreaId(null);
								}}
								onPointerDown={handleArtboardPointerDown}
								onPointerMove={handleArtboardPointerMove}
								onPointerUp={handleArtboardPointerUp}
								onPointerCancel={handleArtboardPointerUp}
								className="relative w-full max-w-[610px] bg-white shadow-[0_18px_40px_rgba(0,0,0,0.18)]"
								style={{
									touchAction: "none",
									position: "absolute",
									left: artboardOffset.x,
									top: artboardOffset.y,
									transform: `scale(${artboardZoom})`,
									transformOrigin: "center center",
									transition: "transform 0.1s ease-out",
									height: artboardLayerImages.length > 0 ? "auto" : "671px",
									isolation: "isolate",
									overflow: "hidden",
									cursor: isHandToolEnabled ? (isDraggingArtboard ? "grabbing" : "grab") : "default",
								}}
							>
								{(() => {
									const visibleImages = artboardLayerImages.filter((item) => visibleLayers.has(item.id));
									const firstVisible = visibleImages[0];

									return (
										<>
											{firstVisible && (
												<img
													key={`${firstVisible.id}-sizer`}
													src={firstVisible.src}
													alt=""
													aria-hidden="true"
													className="w-full"
													style={{
														display: "block",
														visibility: "hidden",
														pointerEvents: "none",
														userSelect: "none",
														height: "auto",
													}}
												/>
											)}
											{visibleImages.map((image, index) => {
										const zIndex = visibleImages.length - index;

										return (
											<img
												key={image.id}
												src={image.src}
												alt="Artboard layer"
												className="w-full"
												style={{
													display: "block",
													mixBlendMode: layerBlendModes[image.id] || "normal",
													position: "absolute",
													zIndex,
													top: 0,
													left: 0,
													height: "100%",
													objectFit: "cover",
													pointerEvents: "none",
													userSelect: "none",
												}}
											/>
										);
											})}
										</>
									);
								})()}
								{/* Size images for all design areas */}
								{designAreaAssets.map((area) => {
									const sizeImg = sizeImageByAreaId[area.id];
									if (!sizeImg) return null;
									const t = getSizeTransform(area.id);
									const artboardEl = draggableArtboardRef.current;
									const artW = artboardEl?.offsetWidth || 610;
									const artH = artboardEl?.offsetHeight || artW;
									const nat = sizeImageNaturalSizeById[area.id];
									let baseW = artW;
									let baseH = artH;
									if (nat) {
										const fitScale = Math.min(artW / nat.w, artH / nat.h);
										baseW = nat.w * fitScale;
										baseH = nat.h * fitScale;
									}
									const boxW = baseW * t.scale;
									const boxH = baseH * t.scale;
									const isEditing = sizeTransformEditingAreaId === area.id;
									const isPerspectiveMode = isEditing && sizeEditMode === "perspective";
									const corners = perspectiveCornersById[area.id] || DEFAULT_CORNERS;
									const hasPerspective = !isDefaultCorners(corners);
									const rad = (t.rotation * Math.PI) / 180;
									const cosA = Math.cos(rad);
									const sinA = Math.sin(rad);

									return (
										<div key={`size-preview-${area.id}`} style={{ display: 'contents' }}>
											{/* Bottom layer preview clipped by top-layer mask */}
											<div
												style={{
													position: "absolute",
													inset: 0,
													zIndex: isEditing ? 499 : 49,
													pointerEvents: "none",
													WebkitMaskImage: `url(${area.src})`,
													WebkitMaskSize: "cover",
													WebkitMaskRepeat: "no-repeat",
													WebkitMaskPosition: "center",
													maskImage: `url(${area.src})`,
													maskSize: "cover",
													maskRepeat: "no-repeat",
													maskPosition: "center",
												}}
											>
												<div
													style={{
														position: "absolute",
														top: "50%",
														left: "50%",
														width: boxW,
														height: boxH,
														transform: `translate(-50%, -50%) translate(${t.x}px, ${t.y}px) rotate(${t.rotation}deg)`,
														transformOrigin: "center center",
													}}
												>
													<div
														style={{
															width: "100%",
															height: "100%",
															transformOrigin: "0 0",
															transform: hasPerspective ? computeMatrix3dStyle(corners, boxW, boxH) : undefined,
														}}
													>
														<img
															src={sizeImg.src}
															alt=""
															style={{
																width: "100%",
																height: "100%",
																objectFit: "fill",
																display: "block",
																opacity: isEditing ? 0.7 : 0.4,
															}}
														/>
													</div>
												</div>
											</div>

											{/* Image container: positioned + rotated */}
											<div
												style={{
													position: "absolute",
													top: "50%",
													left: "50%",
													width: boxW,
													height: boxH,
													zIndex: isEditing ? 500 : 50,
													transform: `translate(-50%, -50%) translate(${t.x}px, ${t.y}px) rotate(${t.rotation}deg)`,
													transformOrigin: "center center",
													pointerEvents: "none",
												}}
											>
												<div
													style={{
														width: "100%",
														height: "100%",
													}}
												>
													<img
														src={sizeImg.src}
														alt=""
														onMouseDown={(e) => {
															e.stopPropagation();
															if (isEditing && sizeEditMode === "normal") {
																handleSizeDragMouseDown(e, area.id);
															} else if (!isEditing) {
																setSizeTransformEditingAreaId(area.id);
																setSizeEditMode("normal");
															}
														}}
														style={{
															width: "100%",
															height: "100%",
															objectFit: "fill",
															display: "block",
															pointerEvents: "auto",
															cursor: isEditing && sizeEditMode === "normal" ? "move" : "pointer",
															opacity: 0,
														}}
													/>
												</div>

												{/* Bounding box when editing */}
												{isEditing && (
													<>
														{/* Dashed border + drag area (normal mode only) */}
														{sizeEditMode === "normal" && (
															<div
																onMouseDown={(e) => handleSizeDragMouseDown(e, area.id)}
																style={{
																	position: "absolute",
																	inset: 0,
																	border: "1.5px dashed rgba(255,107,53,0.9)",
																	boxShadow: "0 0 0 1px rgba(255,107,53,0.18)",
																	cursor: "move",
																	pointerEvents: "auto",
																}}
															/>
														)}

														{/* Normal mode: corner dots (decorative) */}
														{sizeEditMode === "normal" && ([["top", "left"], ["top", "right"], ["bottom", "left"], ["bottom", "right"]] as const).map(([v, h]) => (
															<div
																key={`${v}-${h}`}
																style={{
																	position: "absolute",
																	[v]: -4,
																	[h]: -4,
																	width: 8,
																	height: 8,
																	borderRadius: "50%",
																	background: "#FF6B35",
																	border: "1.5px solid #fff",
																	pointerEvents: "none",
																}}
															/>
														))}

														{/* Perspective mode: blue border + draggable corner points */}
														{sizeEditMode === "perspective" && (
															<>
																<div
																	style={{
																		position: "absolute",
																		inset: 0,
																		border: "1.5px dashed rgba(56,189,248,0.95)",
																		boxShadow: "0 0 0 1px rgba(56,189,248,0.22)",
																		pointerEvents: "none",
																	}}
																/>
																{(["topLeft", "topRight", "bottomLeft", "bottomRight"] as const).map((cornerKey) => {
																	const cornerPos = corners[cornerKey];
																	return (
																		<div
																			key={cornerKey}
																			onMouseDown={(e) => {
																				e.stopPropagation();
																				e.preventDefault();
																				const artboard = draggableArtboardRef.current;
																				if (!artboard) return;

																				const onMove = (ev: MouseEvent) => {
																					const rect = artboard.getBoundingClientRect();
																					const mouseArtX = ev.clientX - rect.left;
																					const mouseArtY = ev.clientY - rect.top;
																					const relX = mouseArtX - (artW / 2 + t.x);
																					const relY = mouseArtY - (artH / 2 + t.y);
																					const unrotX = relX * cosA + relY * sinA;
																					const unrotY = -relX * sinA + relY * cosA;
																					const nx = (unrotX + boxW / 2) / boxW;
																					const ny = (unrotY + boxH / 2) / boxH;

																					setPerspectiveCornersById((prev) => ({
																						...prev,
																						[area.id]: {
																							...(prev[area.id] || DEFAULT_CORNERS),
																							[cornerKey]: {
																								x: Math.round(Math.max(-1, Math.min(2, nx)) * 1000) / 1000,
																								y: Math.round(Math.max(-1, Math.min(2, ny)) * 1000) / 1000,
																							},
																						},
																					}));
																				};

																				const onUp = () => {
																					window.removeEventListener("mousemove", onMove);
																					window.removeEventListener("mouseup", onUp);
																				};
																				window.addEventListener("mousemove", onMove);
																				window.addEventListener("mouseup", onUp);
																			}}
																			style={{
																				position: "absolute",
																				left: `${cornerPos.x * 100}%`,
																				top: `${cornerPos.y * 100}%`,
																				width: 12,
																				height: 12,
																				borderRadius: "50%",
																				background: "#38bdf8",
																				border: "2px solid #fff",
																				transform: "translate(-50%, -50%)",
																				cursor: "move",
																				pointerEvents: "auto",
																				zIndex: 2,
																				boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
																			}}
																		/>
																	);
																})}
															</>
														)}

														{/* Toolbar: rotate + delete + normal + inert extra icon */}
														<div
															style={{
																position: "absolute",
																top: -34,
																left: "50%",
																transform: "translateX(-50%)",
																display: "flex",
																alignItems: "center",
																gap: 4,
																pointerEvents: "auto",
															}}
														>
															{/* Rotate */}
															<button
																type="button"
																aria-label="Rotate size image"
																onMouseDown={(e) => {
																	e.stopPropagation();
																	handleSizeRotateMouseDown(e, area.id);
																}}
																style={{
																	width: 22,
																	height: 22,
																	borderRadius: "50%",
																	background: "#11131B",
																	border: "1.5px solid #FF6B35",
																	cursor: "grab",
																	display: "flex",
																	alignItems: "center",
																	justifyContent: "center",
																}}
															>
																<svg width="10" height="10" viewBox="0 0 10 10" fill="none">
																	<path d="M5 1.5A3.5 3.5 0 1 1 1.5 5" stroke="#FF6B35" strokeWidth="1.2" strokeLinecap="round" />
																	<polygon points="1.5,2.5 1.5,5 4,3.8" fill="#FF6B35" />
																</svg>
															</button>
															{/* Delete */}
															<button
																type="button"
																aria-label="Delete size image"
																onMouseDown={(e) => e.stopPropagation()}
																onClick={() => {
																	setSizeImageByAreaId((prev) => {
																		const next = { ...prev };
																		delete next[area.id];
																		return next;
																	});
																	setSizeImageNaturalSizeById((prev) => {
																		const next = { ...prev };
																		delete next[area.id];
																		return next;
																	});
																	setSizeTransformByAreaId((prev) => {
																		const next = { ...prev };
																		delete next[area.id];
																		return next;
																	});
																	setPerspectiveCornersById((prev) => {
																		const next = { ...prev };
																		delete next[area.id];
																		return next;
																	});
																	setSizeTransformEditingAreaId(null);
																}}
																style={{
																	width: 22,
																	height: 22,
																	borderRadius: "50%",
																	background: "#11131B",
																	border: "1.5px solid #ef4444",
																	cursor: "pointer",
																	display: "flex",
																	alignItems: "center",
																	justifyContent: "center",
																}}
															>
																<Trash2 size={10} strokeWidth={2.2} color="#ef4444" />
															</button>
															{/* Normal mode */}
															<button
																type="button"
																aria-label="Normal transform mode"
																onMouseDown={(e) => e.stopPropagation()}
																onClick={() => setSizeEditMode("normal")}
																style={{
																	width: 22,
																	height: 22,
																	borderRadius: "50%",
																	background: sizeEditMode === "normal" ? "#FF6B35" : "#11131B",
																	border: `1.5px solid ${sizeEditMode === "normal" ? "#fff" : "#FF6B35"}`,
																	cursor: "pointer",
																	display: "flex",
																	alignItems: "center",
																	justifyContent: "center",
																}}
															>
																<Move size={10} strokeWidth={2.2} color={sizeEditMode === "normal" ? "#fff" : "#FF6B35"} />
															</button>
															{/* Perspective mode */}
															<button
																type="button"
																aria-label="Perspective warp mode"
																onMouseDown={(e) => e.stopPropagation()}
																onClick={() => {
																	setSizeEditMode("perspective");
																	if (!perspectiveCornersById[area.id]) {
																		setPerspectiveCornersById((prev) => ({
																			...prev,
																			[area.id]: { ...DEFAULT_CORNERS },
																		}));
																	}
																}}
																style={{
																	width: 22,
																	height: 22,
																	borderRadius: "50%",
																	background: sizeEditMode === "perspective" ? "#38bdf8" : "#11131B",
																	border: `1.5px solid ${sizeEditMode === "perspective" ? "#fff" : "#38bdf8"}`,
																	cursor: "pointer",
																	display: "flex",
																	alignItems: "center",
																	justifyContent: "center",
																}}
															>
																<Grid3X3 size={10} strokeWidth={2.2} color={sizeEditMode === "perspective" ? "#fff" : "#38bdf8"} />
															</button>
														</div>

														{/* Stem line to rotate */}
														{sizeEditMode === "normal" && (
															<div
																style={{
																	position: "absolute",
																	top: -10,
																	left: "50%",
																	transform: "translateX(-50%)",
																	width: 1,
																	height: 10,
																	background: "rgba(255,107,53,0.6)",
																	pointerEvents: "none",
																}}
															/>
														)}

														{/* Scale handles (normal mode only) */}
														{sizeEditMode === "normal" && (
															<>
																<button
																	type="button"
																	aria-label="Scale size image"
																	onMouseDown={(e) => {
																		e.stopPropagation();
																		handleSizeScaleMouseDown(e, area.id);
																	}}
																	style={{
																		position: "absolute",
																		bottom: -8,
																		right: -8,
																		width: 16,
																		height: 16,
																		borderRadius: 2,
																		background: "#FF6B35",
																		border: "1.5px solid #fff",
																		cursor: "nwse-resize",
																		pointerEvents: "auto",
																	}}
																/>
																<button
																	type="button"
																	aria-label="Scale size image"
																	onMouseDown={(e) => {
																		e.stopPropagation();
																		handleSizeScaleMouseDown(e, area.id);
																	}}
																	style={{
																		position: "absolute",
																		bottom: -8,
																		left: -8,
																		width: 16,
																		height: 16,
																		borderRadius: 2,
																		background: "#FF6B35",
																		border: "1.5px solid #fff",
																		cursor: "nesw-resize",
																		pointerEvents: "auto",
																	}}
																/>
															</>
														)}
													</>
												)}
											</div>
										</div>
									);
								})}
							</div>
						</div>
					</div>
				</div>
			</section>
		);
	}

	if (view === "users") {
		return (
				<section className="rounded-xl border border-white/8 bg-[#16161F] p-6 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
					<h3 className="mb-4 text-lg font-semibold text-zinc-100">Users</h3>
					<div className="overflow-x-auto">
							<table className="w-full min-w-[900px] text-left text-sm">
								<thead>
									<tr className="border-b border-white/8 text-zinc-400">
										<th className="py-3 font-medium">Name</th>
										<th className="py-3 font-medium">Email</th>
										<th className="py-3 font-medium">Role</th>
										<th className="py-3 font-medium">Status</th>
										<th className="py-3 font-medium">Total Downloads</th>
										<th className="py-3 font-medium">View</th>
									</tr>
							</thead>
							<tbody>
								{filteredUsers.map((user) => (
									<tr key={user.id} className="border-b border-white/6 text-zinc-200">
										<td className="py-3 font-medium">{user.name}</td>
										<td className="py-3 text-zinc-400">{user.email}</td>
										<td className="py-3">
											<span className="rounded-full bg-white/8 px-2.5 py-1 text-xs text-zinc-200">{user.role}</span>
										</td>
										<td className="py-3">
											<span
												className={`rounded-full px-2.5 py-1 text-xs ${
													!user.isEmailVerified
														? "bg-amber-500/12 text-amber-300"
														: user.status === "Active"
															? "bg-emerald-500/12 text-emerald-300"
															: "bg-red-500/12 text-red-300"
												}`}
											>
												{user.isEmailVerified ? user.status : "Not Verified"}
											</span>
										</td>
										<td className="py-3">{user.totalDownloads.toLocaleString()}</td>
										<td className="py-3">
											<button
												type="button"
												onClick={async () => {
													setSelectedUser(user);
													setEditRole(user.role);
													setEditStatus(user.status);
													setDlFilter("all");
													const fresh = await loadUsers();
													if (fresh) {
														const freshUser = fresh.find((u) => u.id === user.id);
														if (freshUser) {
															setSelectedUser(freshUser);
															setEditRole(freshUser.role);
															setEditStatus(freshUser.status);
														}
													}
												}}
												className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-zinc-200 transition hover:border-[#FF6B35]/40 hover:text-[#FF6B35]"
											>
												<Eye className="h-3.5 w-3.5" />
												View
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</section>
			);
		}

		if (view === "categories") {
			return (
				<section className="space-y-6">
					<div className="rounded-xl border border-white/8 bg-[#16161F] p-6 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
						<h3 className="text-lg font-semibold text-zinc-100">Categories</h3>
						<p className="mt-2 text-sm text-zinc-400">Main Category -&gt; Category architecture for the product form.</p>
					</div>

					{categoryNotice ? (
						<div className={`rounded-xl px-4 py-3 text-sm ${
							categoryNoticeTone === "success"
								? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
								: "border border-red-500/25 bg-red-500/10 text-red-300"
						}`}>
							{categoryNotice}
						</div>
					) : null}

					<div className="grid gap-6 xl:grid-cols-2">
						<div className="rounded-xl border border-white/8 bg-[#16161F] p-6 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
							<h4 className="text-base font-semibold text-zinc-100">Add Main Category</h4>
							<div className="mt-4 flex gap-3">
								<input
									type="text"
									value={newMainCategoryName}
									onChange={(e) => setNewMainCategoryName(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											handleAddMainCategory();
										}
									}}
									placeholder="e.g. Accessories"
									className="h-10 flex-1 rounded-lg border border-white/10 bg-[#0E0E14] px-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-[#FF6B35]"
								/>
								<button
									type="button"
									onClick={handleAddMainCategory}
									className="rounded-lg bg-[#FF6B35] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#ff7d4f]"
								>
									Add
								</button>
							</div>
						</div>

						<div className="rounded-xl border border-white/8 bg-[#16161F] p-6 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
							<h4 className="text-base font-semibold text-zinc-100">Add Category</h4>
							<div className="mt-4">
								<label className="mb-1.5 block text-xs font-medium text-zinc-400">Main Category</label>
								<select
									value={categoryManagerMain}
									onChange={(e) => setCategoryManagerMain(e.target.value)}
									className="h-10 w-full rounded-lg border border-white/10 bg-[#0E0E14] px-3 text-sm text-zinc-100 outline-none transition focus:border-[#FF6B35]"
								>
									{mainCategories.map((item) => (
										<option key={item} value={item}>{item}</option>
									))}
								</select>
							</div>
							<div className="mt-4 flex gap-3">
								<input
									type="text"
									value={newCategoryName}
									onChange={(e) => setNewCategoryName(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											handleAddCategory();
										}
									}}
									placeholder="e.g. Polo Shirt"
									className="h-10 flex-1 rounded-lg border border-white/10 bg-[#0E0E14] px-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-[#FF6B35]"
								/>
								<button
									type="button"
									onClick={handleAddCategory}
									className="rounded-lg bg-[#FF6B35] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#ff7d4f]"
								>
									Add
								</button>
							</div>
						</div>

					</div>

					<div className="grid gap-6 xl:grid-cols-2">
						<div className="rounded-xl border border-white/8 bg-[#16161F] p-6 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
							<div className="mb-4 flex items-center justify-between">
								<h4 className="text-base font-semibold text-zinc-100">Main Category List</h4>
								<span className="rounded-full bg-white/8 px-2.5 py-1 text-xs text-zinc-300">{mainCategories.length}</span>
							</div>
							<div className="flex flex-wrap gap-2">
								{mainCategories.map((item) => (
									<div key={item} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-200">
										<span>{item}</span>
										<button
											type="button"
											onClick={() => removeMainCategory(item)}
											className="text-zinc-400 transition hover:text-red-300"
											aria-label={`Remove ${item}`}
										>
											<X className="h-3.5 w-3.5" />
										</button>
									</div>
								))}
							</div>
						</div>

						<div className="rounded-xl border border-white/8 bg-[#16161F] p-6 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
							<div className="mb-4 flex items-center justify-between">
								<h4 className="text-base font-semibold text-zinc-100">Category List ({categoryManagerMain || "None"})</h4>
								<span className="rounded-full bg-white/8 px-2.5 py-1 text-xs text-zinc-300">{managerCategories.length}</span>
							</div>
							<div className="flex flex-wrap gap-2">
								{managerCategories.map((item) => (
									<div key={item} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-200">
										<span>{item}</span>
										<button
											type="button"
											onClick={() => removeCategory(categoryManagerMain, item)}
											className="text-zinc-400 transition hover:text-red-300"
											aria-label={`Remove ${item}`}
										>
											<X className="h-3.5 w-3.5" />
										</button>
									</div>
								))}
							</div>
						</div>

					</div>
				</section>
			);
		}

		if (view === "analytics") {
			return <AnalyticsPanel />;
		}

		if (view === "reviews") {
			const handleApprove = async (review: AdminReview) => {
				try {
					const response = await fetch(`${apiBaseUrl}/reviews/${review.id}/approve`, {
						method: "PATCH",
						credentials: "include",
						headers: getAdminHeaders(),
					});
					const result = await response.json().catch(() => null);
					if (!response.ok || !result?.ok) {
						throw new Error(result?.message || "Failed to approve review.");
					}
					await loadReviewQueues();
				} catch (error) {
					console.error("Failed to approve review:", error);
				}
			};

			const handleReject = async (review: AdminReview) => {
				try {
					const response = await fetch(`${apiBaseUrl}/reviews/${review.id}`, {
						method: "DELETE",
						credentials: "include",
						headers: getAdminHeaders(),
					});
					const result = await response.json().catch(() => null);
					if (!response.ok || !result?.ok) {
						throw new Error(result?.message || "Failed to reject review.");
					}
					await loadReviewQueues();
				} catch (error) {
					console.error("Failed to reject review:", error);
				}
			};

			const handleRemoveApproved = async (id: string) => {
				try {
					const response = await fetch(`${apiBaseUrl}/reviews/${id}`, {
						method: "DELETE",
						credentials: "include",
						headers: getAdminHeaders(),
					});
					const result = await response.json().catch(() => null);
					if (!response.ok || !result?.ok) {
						throw new Error(result?.message || "Failed to remove approved review.");
					}
					await loadReviewQueues();
				} catch (error) {
					console.error("Failed to remove approved review:", error);
				}
			};

			const StarRow = ({ count }: { count: number }) => (
				<div className="flex items-center gap-0.5">
					{Array.from({ length: 5 }).map((_, i) => (
						<span key={i} className={i < count ? "text-[#FF6B35]" : "text-zinc-600"}>★</span>
					))}
				</div>
			);

			return (
				<div className="space-y-6">
					{/* Pending */}
					<section className="rounded-xl border border-white/8 bg-[#16161F] p-6 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
						<h3 className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
							<MessageSquare className="h-5 w-5 text-[#FF6B35]" />
							Pending Reviews
							{pendingReviews.length > 0 && (
								<span className="ml-1 rounded-full bg-[#FF6B35]/20 px-2 py-0.5 text-xs font-medium text-[#FF6B35]">{pendingReviews.length}</span>
							)}
						</h3>
						{pendingReviews.length === 0 ? (
							<p className="mt-3 text-sm text-zinc-500">No pending reviews.</p>
						) : (
							<div className="mt-4 space-y-3">
								{pendingReviews.map((review) => (
									<div key={review.id} className="flex flex-col gap-3 rounded-lg border border-white/8 bg-[#0E0E14] p-4 sm:flex-row sm:items-start sm:justify-between">
										<div className="min-w-0 flex-1">
											<div className="flex flex-wrap items-center gap-2">
												<p className="font-semibold text-zinc-100">{review.name}</p>
												<StarRow count={review.rating} />
												<span className="text-xs text-zinc-500">{new Date(review.submittedAt).toLocaleDateString()}</span>
											</div>
											<p className="mt-2 text-sm leading-6 text-zinc-400">{review.text}</p>
										</div>
										<div className="flex shrink-0 gap-2">
											<button
												type="button"
												onClick={() => handleApprove(review)}
												className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20"
											>
												<Check className="h-3.5 w-3.5" />
												Approve
											</button>
											<button
												type="button"
												onClick={() => handleReject(review)}
												className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/20"
											>
												<X className="h-3.5 w-3.5" />
												Reject
											</button>
										</div>
									</div>
								))}
							</div>
						)}
					</section>

					{/* Approved */}
					<section className="rounded-xl border border-white/8 bg-[#16161F] p-6 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
						<h3 className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
							<ShieldCheck className="h-5 w-5 text-emerald-400" />
							Approved Reviews
							{approvedReviews.length > 0 && (
								<span className="ml-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">{approvedReviews.length}</span>
							)}
						</h3>
						<p className="mt-1 text-xs text-zinc-500">These reviews are visible on the public Reviews page.</p>
						{approvedReviews.length === 0 ? (
							<p className="mt-3 text-sm text-zinc-500">No approved reviews yet.</p>
						) : (
							<div className="mt-4 space-y-3">
								{approvedReviews.map((review) => (
									<div key={review.id} className="flex flex-col gap-3 rounded-lg border border-white/8 bg-[#0E0E14] p-4 sm:flex-row sm:items-start sm:justify-between">
										<div className="min-w-0 flex-1">
											<div className="flex flex-wrap items-center gap-2">
												<p className="font-semibold text-zinc-100">{review.name}</p>
												<StarRow count={review.rating} />
												<span className="ml-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-300">Approved</span>
												<span className="text-xs text-zinc-500">{new Date(review.submittedAt).toLocaleDateString()}</span>
											</div>
											<p className="mt-2 text-sm leading-6 text-zinc-400">{review.text}</p>
										</div>
										<button
											type="button"
											onClick={() => handleRemoveApproved(review.id)}
											className="flex shrink-0 items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/20"
										>
											<Trash2 className="h-3.5 w-3.5" />
											Remove
										</button>
									</div>
								))}
							</div>
						)}
					</section>
				</div>
			);
		}

		if (view === "subscribers") {
			return <SubscribersPanel apiBaseUrl={apiBaseUrl} getAdminHeaders={getAdminHeaders} />;
		}

		return (
			<section className="rounded-xl border border-white/8 bg-[#16161F] p-6 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
				<h3 className="text-lg font-semibold text-zinc-100">Settings</h3>
				<p className="mt-2 text-sm text-zinc-400">Configure workspace settings, permissions, and platform preferences.</p>
			</section>
		);
	};

	return (
		<div className="min-h-screen bg-[#0A0A0F] text-zinc-100" style={{ fontFamily: "Inter, ui-sans-serif, system-ui" }}>
			<div className="grid min-h-screen grid-cols-1 md:grid-cols-[256px_minmax(0,1fr)]">
				<aside className="border-r border-white/6 bg-[#111118] p-4 md:h-screen md:sticky md:top-0 md:p-5">
					<div className="mb-7 flex items-center gap-3 px-2">
						<img src={mockyoLogo} alt="Mockyo" className="h-9 w-auto rounded-none" />
						<h1 className="text-xl font-bold tracking-tight">Mockyo</h1>
					</div>

					<nav className="space-y-1.5">
						{menuItems.map((item) => {
							const Icon = item.icon;
							const active = view === item.id;
							return (
								<button
									key={item.id}
									type="button"
									onClick={() => setView(item.id)}
									className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
										active
											? "bg-[#FF6B35] text-white"
											: "text-zinc-300 hover:bg-white/5 hover:text-zinc-100"
									}`}
								>
									<Icon className={`h-4 w-4 ${active ? "text-white" : "text-zinc-400 group-hover:text-zinc-200"}`} />
									<span>{item.label}</span>
								</button>
							);
						})}
					</nav>
				</aside>

<main className="min-w-0 p-4 md:p-7">
{uploadSuccess ? (
<div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
{uploadSuccess}
</div>
) : null}

{selectedUser && (
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
<div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-white/8 bg-[#16161F] p-6 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
<div className="mb-6 flex items-start justify-between">
<div>
<h3 className="text-2xl font-semibold text-zinc-100">{selectedUser.name}</h3>
<p className="mt-1 text-sm text-zinc-400">{selectedUser.email}</p>
</div>
<button
type="button"
onClick={() => setSelectedUser(null)}
className="text-zinc-400 transition hover:text-zinc-200"
>
<X className="h-5 w-5" />
</button>
</div>

<div className="mb-6 grid gap-4 sm:grid-cols-2">
<div className="rounded-lg bg-white/5 p-4">
<p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Role</p>
<select
  value={editRole}
  onChange={(e) => setEditRole(e.target.value as "User" | "Admin")}
  className="mt-2 w-full rounded-lg border border-white/10 bg-[#0E0E14] px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-[#FF6B35]"
>
  <option value="User">User</option>
  <option value="Admin">Admin</option>
</select>
</div>
<div className="rounded-lg bg-white/5 p-4">
<p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Status</p>
<select
	value={editStatus}
	onChange={(e) => setEditStatus(e.target.value as "Active" | "Banned")}
	className="mt-2 w-full rounded-lg border border-white/10 bg-[#0E0E14] px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-[#FF6B35]"
>
	<option value="Active">Active</option>
	<option value="Banned">Banned</option>
</select>
</div>
<div className="rounded-lg bg-white/5 p-4">
<p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Total Downloads</p>
<p className="mt-2 text-sm font-medium text-zinc-100">{selectedUser.totalDownloads.toLocaleString()}</p>
</div>
<div className="rounded-lg bg-white/5 p-4">
<p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Joined Date</p>
<p className="mt-2 text-sm font-medium text-zinc-100">{new Date(selectedUser.joinedAt).toLocaleDateString()}</p>
</div>
</div>

<div className="mb-6">
<div className="mb-3 flex items-center justify-between">
	<h4 className="text-sm font-semibold text-zinc-200">Download History</h4>
	<select
		value={dlFilter}
		onChange={(e) => setDlFilter(e.target.value)}
		className="h-8 rounded-lg border border-white/10 bg-[#0E0E14] px-3 text-xs text-zinc-100 outline-none focus:border-[#FF6B35]"
	>
		<option value="all">All</option>
		<option value="today">Today</option>
		<option value="7d">Last 7 Days</option>
		<option value="30d">Last 30 Days</option>
		<option value="180d">Last 6 Months</option>
		<option value="365d">Last Year</option>
	</select>
</div>
<div className="rounded-lg border border-white/8 bg-white/5 p-3 max-h-64 overflow-y-auto">
	{(() => {
		const now = new Date();
		const filtered = (selectedUser.downloads ?? [])
			.filter((d) => {
				if (dlFilter === "all") return true;
				const date = new Date(d.downloadedAt);
				if (dlFilter === "today") return date.toDateString() === now.toDateString();
				const cutoff = new Date(now);
				cutoff.setDate(now.getDate() - parseInt(dlFilter));
				return date >= cutoff;
			})
			.slice()
			.sort((a, b) => new Date(b.downloadedAt).getTime() - new Date(a.downloadedAt).getTime());
		if (filtered.length === 0) {
			return <p className="text-sm text-zinc-400">{selectedUser.totalDownloads > 0 ? "History not available for past downloads." : "No downloads yet"}</p>;
		}
		return (
			<div className="space-y-2">
				{filtered.map((dl, idx) => {
					const fallbackTitle = dl.mockupId
						? products.find((item) => item.id === dl.mockupId)?.title || "Unknown"
						: "Unknown";
					const title = dl.productTitle && dl.productTitle !== "Unknown" ? dl.productTitle : fallbackTitle;
					return (
					<div key={idx} className="flex items-center justify-between border-b border-white/8 pb-2 last:border-0 last:pb-0">
						<span className="text-sm text-zinc-300">{title}</span>
						<span className="text-xs text-zinc-400">{new Date(dl.downloadedAt).toLocaleString()}</span>
					</div>
					);
				})}
			</div>
		);
	})()}
</div>
</div>

{saveMsg && (
  <div className="mb-3 rounded-lg bg-emerald-500/15 border border-emerald-500/20 px-4 py-2 text-sm text-emerald-300">
    ✓ Changes saved successfully
  </div>
)}
<div className="flex gap-3">
<button
type="button"
onClick={handleSaveUser}
className="flex-1 rounded-lg bg-[#FF6B35] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#ff7d4f]"
>
Save
</button>
<button
type="button"
onClick={async () => {
const ok = await handleDeleteUser(selectedUser.id);
if (ok) setSelectedUser(null);
}}
className="flex-1 rounded-lg border border-red-400/20 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/10"
>
<Trash2 className="mr-2 inline h-4 w-4" />
Delete
</button>
<button
type="button"
onClick={() => setSelectedUser(null)}
className="flex-1 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/15"
>
Close
</button>
</div>
</div>
</div>
)}

{showSharedToolbar ? (
<>
<header className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-[#16161F] px-4 py-3 shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
<h2 className="text-xl font-semibold tracking-tight">{pageTitle}</h2>

<div className="flex items-center gap-3">
<label className="relative block">
<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
<input
value={search}
onChange={(e) => setSearch(e.target.value)}
placeholder="Search products..."
className="h-10 w-60 rounded-xl border border-white/10 bg-[#0E0E14] pl-9 pr-3 text-sm text-zinc-100 outline-none focus:border-[#FF6B35]"
/>
</label>

<div className="relative" ref={profileMenuRef}>
<button
type="button"
onClick={() => setShowProfileMenu(!showProfileMenu)}
className="h-10 w-10 rounded-full border border-white/10 bg-gradient-to-br from-[#FF6B35] to-[#ff8e66] transition hover:border-white/20 cursor-pointer"
aria-label="Profile menu"
/>
{showProfileMenu && (
<div className="absolute right-0 top-12 z-50 w-48 rounded-lg border border-white/10 bg-[#0E0E14] shadow-lg">
<div className="border-b border-white/10 px-4 py-3">
<p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Admin</p>
<p className="mt-1 font-medium text-zinc-100">{readAdminSession()?.name || "Admin"}</p>
<p className="text-xs text-zinc-500">{readAdminSession()?.email || ""}</p>
</div>
<button
type="button"
onClick={() => setView("settings")}
className="w-full px-4 py-2.5 text-left text-sm text-zinc-200 transition hover:bg-white/5 flex items-center gap-2"
>
<Settings className="h-4 w-4 text-zinc-400" />
Settings
</button>
<button
type="button"
onClick={() => {
void fetch(`${apiBaseUrl}/auth/admin/logout`, {
	method: "POST",
	credentials: "include",
}).finally(() => {
	clearAdminSession();
	setShowProfileMenu(false);
	navigate("/admin-login", { replace: true });
});
}}
className="w-full px-4 py-2.5 text-left text-sm text-red-300 transition hover:bg-red-500/10 flex items-center gap-2"
>
<LogOut className="h-4 w-4" />
Sign out
</button>
</div>
)}
</div>
</div>
</header>

<section className="mb-6 rounded-xl border border-white/8 bg-[#16161F] p-4 shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
<div className="flex flex-wrap items-end gap-3">
<div>
<label className="mb-1 block text-xs uppercase tracking-[0.14em] text-zinc-400">Quick range</label>
<select
value={quickRange}
onChange={(e) => applyQuickRange(e.target.value as QuickRange)}
className="h-10 min-w-36 rounded-lg border border-white/10 bg-[#0E0E14] px-3 text-sm text-zinc-100 outline-none focus:border-[#FF6B35]"
>
<option value="custom">Custom</option>
<option value="today">Today</option>
<option value="7d">Last 7 days</option>
<option value="30d">Last 30 days</option>
</select>
</div>

<div>
<label className="mb-1 block text-xs uppercase tracking-[0.14em] text-zinc-400">From date</label>
<input
type="date"
value={fromDate}
onChange={(e) => {
setQuickRange("custom");
setFromDate(e.target.value);
}}
className="h-10 rounded-lg border border-white/10 bg-[#0E0E14] px-3 text-sm text-zinc-100 outline-none focus:border-[#FF6B35]"
/>
</div>

<div>
<label className="mb-1 block text-xs uppercase tracking-[0.14em] text-zinc-400">To date</label>
<input
type="date"
value={toDate}
onChange={(e) => {
setQuickRange("custom");
setToDate(e.target.value);
}}
className="h-10 rounded-lg border border-white/10 bg-[#0E0E14] px-3 text-sm text-zinc-100 outline-none focus:border-[#FF6B35]"
/>
</div>

<button
type="button"
onClick={resetFilters}
className="h-10 rounded-lg border border-white/10 px-3 text-sm text-zinc-200 transition hover:border-[#FF6B35]/40 hover:text-[#FF6B35]"
>
Reset filters
</button>
</div>
</section>
</>
 ) : null}

{renderContent()}
</main>
</div>
</div>
);
}
