import { AlignCenter, AlignLeft, AlignRight, ChevronDown, ImagePlus, Palette, Search, Trash2, Type, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { markGuestDownloadUsed, requireSigninForExtraDownload } from "../lib/guestDownloadAccess";
import { readAuthUser } from "../imports/authStore";
import { useNavigate, useParams } from "react-router";
import { type PerspectiveCorners, DEFAULT_CORNERS, isDefaultCorners, computeMatrix3dStyle, drawCanvasWarp } from "../lib/perspectiveWarp";
import { readEditorWorkspace, removeEditorWorkspace, writeEditorWorkspace } from "../lib/editorWorkspaceStorage";

export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const apiBaseUrl =
    import.meta.env.VITE_API_URL?.trim() ||
    (typeof window !== "undefined"
      ? `${window.location.protocol === "https:" ? "https:" : "http:"}//${window.location.hostname}:5000/api`
      : "http://localhost:5000/api");
  const [mobilePanel, setMobilePanel] = useState<"left" | "right" | null>(null);
  const [isWorkspaceReady, setIsWorkspaceReady] = useState(false);

  const getEditorStorageKey = (productId: string) => `mockyo.editor.workspace.${productId}`;

  type LayerItem = { url: string; label: string; blendMode: string };
  type DesignAreaItem = {
    id: string;
    url: string;
    label: string;
    sizeImageUrl?: string;
    sizeTransform?: DesignTransform;
    perspectiveCorners?: PerspectiveCorners;
  };
  type ColorAreaItem = { id: string; url: string; label: string };
  type UploadedDesignItem = { id: string; src: string };
  type SidebarMockupItem = {
    id: string;
    title: string;
    image: string;
    mainCategory: string;
    category: string;
  };
  type DesignTransform = { x: number; y: number; scale: number; rotation: number };
  const defaultDesignTransform: DesignTransform = { x: 0, y: 0, scale: 1, rotation: 0 };
  const [layers, setLayers] = useState<LayerItem[]>([]);
  const [designAreaImages, setDesignAreaImages] = useState<DesignAreaItem[]>([]);
  const [selectedDesignAreaUrl, setSelectedDesignAreaUrl] = useState<string | null>(null);
  const [selectedDesignId, setSelectedDesignId] = useState<string | null>(null);
  const [uploadedDesignByArea, setUploadedDesignByArea] = useState<Record<string, UploadedDesignItem[]>>({});
  const [designTransformById, setDesignTransformById] = useState<Record<string, DesignTransform>>({});
  const [designNaturalSizes, setDesignNaturalSizes] = useState<Record<string, { w: number; h: number }>>({});
  const [bottomLayerNaturalByAreaId, setBottomLayerNaturalByAreaId] = useState<Record<string, { w: number; h: number }>>({});
  const [colorAreaImages, setColorAreaImages] = useState<ColorAreaItem[]>([]);
  const [selectedColorAreaUrl, setSelectedColorAreaUrl] = useState<string | null>(null);
  const [appliedColorByArea, setAppliedColorByArea] = useState<Record<string, string>>({});
  const [colorPickerTargetUrl, setColorPickerTargetUrl] = useState<string | null>(null);
  const [artboardBgColor, setArtboardBgColor] = useState<string | null>(null);
  const BACKGROUND_PICKER_KEY = "__artboard_bg__";
  type OverlayItem = {
    id: string;
    type: "text" | "logo";
    x: number;
    y: number;
    scale: number;
    rotation: number;
    text?: string;
    fontSize?: number;
    fontColor?: string;
    textAlign?: "left" | "center" | "right";
    src?: string;
  };
  type PersistedEditorWorkspace = {
    selectedDesignAreaUrl: string | null;
    selectedDesignId: string | null;
    uploadedDesignByArea: Record<string, UploadedDesignItem[]>;
    designTransformById: Record<string, DesignTransform>;
    designNaturalSizes: Record<string, { w: number; h: number }>;
    selectedColorAreaUrl: string | null;
    appliedColorByArea: Record<string, string>;
    artboardBgColor: string | null;
    overlayItems: OverlayItem[];
    selectedOverlayId: string | null;
  };

  const readPersistedWorkspace = (productId: string) =>
    readEditorWorkspace<PersistedEditorWorkspace>(getEditorStorageKey(productId));

  const writePersistedWorkspace = async (productId: string, snapshot: PersistedEditorWorkspace | null) => {
    const storageKey = getEditorStorageKey(productId);
    if (!snapshot) {
      await removeEditorWorkspace(storageKey);
      return;
    }
    await writeEditorWorkspace(storageKey, snapshot);
  };

  const [overlayItems, setOverlayItems] = useState<OverlayItem[]>([]);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [editingTextOverlayId, setEditingTextOverlayId] = useState<string | null>(null);
  const [pendingOverlayText, setPendingOverlayText] = useState("");
  const [pendingOverlayFontSize] = useState(24);
  const [pendingOverlayFontColor, setPendingOverlayFontColor] = useState("#FFFFFF");
  const [pendingOverlayTextAlign, setPendingOverlayTextAlign] = useState<"left" | "center" | "right">("center");
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [textColorHsv, setTextColorHsv] = useState({ h: 0, s: 0, v: 100 });
  const textSaturationRef = useRef<HTMLDivElement | null>(null);
  const isDraggingOverlay = useRef(false);
  const overlayDragStart = useRef({ mouseX: 0, mouseY: 0, x: 0, y: 0, id: "" });
  const isScalingOverlay = useRef(false);
  const overlayScaleStart = useRef({ mouseX: 0, mouseY: 0, scale: 1, id: "" });
  const isRotatingOverlay = useRef(false);
  const overlayRotateStart = useRef({ angle: 0, rotation: 0, id: "" });
  const [rotationGuide, setRotationGuide] = useState<{ areaUrl: string; designId: string; angle: number; snapped: boolean } | null>(null);
  const [pendingHsv, setPendingHsv] = useState({ h: 20, s: 79, v: 100 });
  const [hexInputValue, setHexInputValue] = useState("#FF6B35");
  const [productTitle, setProductTitle] = useState("Editor Workspace");
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const [designWrapperPercent, setDesignWrapperPercent] = useState(20);
  const [rightPanelSearch, setRightPanelSearch] = useState("");
  const [rightPanelMockups, setRightPanelMockups] = useState<SidebarMockupItem[]>([]);
  const [isRightPanelLoading, setIsRightPanelLoading] = useState(false);

  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"PNG" | "JPEG">("PNG");
  const [exportSize, setExportSize] = useState<
    "4000x4000 px" | "1000x1000 px" | "500x500 px"
  >("1000x1000 px");
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const saturationRef = useRef<HTMLDivElement | null>(null);
  const artboardCanvasRef = useRef<HTMLDivElement | null>(null);

  const [artboardPos, setArtboardPos] = useState({ x: 0, y: 0 });
  const [artboardZoom, setArtboardZoom] = useState(1);
  const [artboardPixelSize, setArtboardPixelSize] = useState<{ w: number; h: number } | null>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });
  const isDraggingDesign = useRef(false);
  const designDragStart = useRef({ mouseX: 0, mouseY: 0, x: 0, y: 0, areaUrl: "", designId: "" });
  const isScalingDesign = useRef(false);
  const designScaleStart = useRef({ distance: 0, scale: 1, areaUrl: "", designId: "" });
  const isRotatingDesign = useRef(false);
  const designRotateStart = useRef({ angle: 0, rotation: 0, areaUrl: "", designId: "" });
  const normalizedDesignIdsRef = useRef<Set<string>>(new Set());

  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
  const DESIGN_ROTATION_SNAP_STEP = 45;
  const OVERLAY_ROTATION_SNAP_STEP = 15;
  const ROTATION_SNAP_THRESHOLD = 3;
  const MIN_DESIGN_SCALE = 0.01;

  const normalizeAngle = (angle: number) => {
    let normalized = angle % 360;
    if (normalized > 180) normalized -= 360;
    if (normalized <= -180) normalized += 360;
    return normalized;
  };

  const getSnappedRotation = (angle: number, snapStep: number) => {
    const nearest = Math.round(angle / snapStep) * snapStep;
    const snapped = Math.abs(angle - nearest) <= ROTATION_SNAP_THRESHOLD;
    return {
      angle: snapped ? nearest : angle,
      snapped,
      guideAngle: normalizeAngle(snapped ? nearest : angle),
    };
  };

  const createDesignId = () => {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `design-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  };

  const hsvToHex = (h: number, s: number, v: number) => {
    const sv = s / 100;
    const vv = v / 100;
    const c = vv * sv;
    const hh = (h % 360) / 60;
    const x = c * (1 - Math.abs((hh % 2) - 1));

    let r = 0;
    let g = 0;
    let b = 0;

    if (hh >= 0 && hh < 1) [r, g, b] = [c, x, 0];
    else if (hh >= 1 && hh < 2) [r, g, b] = [x, c, 0];
    else if (hh >= 2 && hh < 3) [r, g, b] = [0, c, x];
    else if (hh >= 3 && hh < 4) [r, g, b] = [0, x, c];
    else if (hh >= 4 && hh < 5) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];

    const m = vv - c;
    const toHex = (n: number) => {
      const hex = Math.round((n + m) * 255).toString(16);
      return hex.length === 1 ? `0${hex}` : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  const hexToHsv = (hex: string) => {
    const cleanHex = hex.replace("#", "");
    const fullHex = cleanHex.length === 3
      ? cleanHex.split("").map((c) => c + c).join("")
      : cleanHex;

    const num = Number.parseInt(fullHex, 16);
    const r = ((num >> 16) & 255) / 255;
    const g = ((num >> 8) & 255) / 255;
    const b = (num & 255) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;

    let h = 0;
    if (d !== 0) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h = Math.round(h * 60);
      if (h < 0) h += 360;
    }

    const s = max === 0 ? 0 : (d / max) * 100;
    const v = max * 100;

    return { h, s: Math.round(s), v: Math.round(v) };
  };

  const pendingColor = useMemo(
    () => hsvToHex(pendingHsv.h, pendingHsv.s, pendingHsv.v),
    [pendingHsv],
  );
  const designWrapperStrength = useMemo(() => designWrapperPercent / 100, [designWrapperPercent]);

  useEffect(() => {
    setHexInputValue(pendingColor.toUpperCase());
  }, [pendingColor]);

  const setSvByPointer = (clientX: number, clientY: number) => {
    const rect = saturationRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = clamp(clientX - rect.left, 0, rect.width);
    const y = clamp(clientY - rect.top, 0, rect.height);

    const s = Math.round((x / rect.width) * 100);
    const v = Math.round((1 - y / rect.height) * 100);

    setPendingHsv((prev) => ({ ...prev, s, v }));
  };

  // Fetch product layers from backend when id is present
  useEffect(() => {
    if (!id) return;
    setIsWorkspaceReady(false);
    setIsLoadingProduct(true);
    setUploadedDesignByArea({});
    setDesignTransformById({});
    setDesignNaturalSizes({});
    setBottomLayerNaturalByAreaId({});
    setSelectedDesignId(null);
    setAppliedColorByArea({});
    setArtboardBgColor(null);
    setOverlayItems([]);
    setSelectedOverlayId(null);
    const load = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/mockups/${id}`);
        const result = await res.json();
        if (!res.ok || !result?.ok || !result.item) return;
        const item = result.item;
        const persisted = await readPersistedWorkspace(id);
        if (item.title) setProductTitle(item.title);

        // Design area images
        if (Array.isArray(item.designAreaImages) && item.designAreaImages.length > 0) {
          const da: DesignAreaItem[] = item.designAreaImages
            .filter((d: any) => d?.url)
            .map((d: any, i: number) => ({
              id: `design-area-${i}`,
              url: d.url,
              label: d.label || `Layer ${i + 1}`,
              sizeImageUrl: d?.sizeImage?.url || undefined,
              perspectiveCorners: d?.perspectiveCorners
                ? {
                    topLeft: { x: d.perspectiveCorners.topLeft?.x ?? 0, y: d.perspectiveCorners.topLeft?.y ?? 0 },
                    topRight: { x: d.perspectiveCorners.topRight?.x ?? 1, y: d.perspectiveCorners.topRight?.y ?? 0 },
                    bottomLeft: { x: d.perspectiveCorners.bottomLeft?.x ?? 0, y: d.perspectiveCorners.bottomLeft?.y ?? 1 },
                    bottomRight: { x: d.perspectiveCorners.bottomRight?.x ?? 1, y: d.perspectiveCorners.bottomRight?.y ?? 1 },
                  }
                : undefined,
              sizeTransform: {
                x: d?.sizeTransform?.x ?? 0,
                y: d?.sizeTransform?.y ?? 0,
                scale: d?.sizeTransform?.scale ?? 1,
                rotation: d?.sizeTransform?.rotation ?? 0,
              },
            }));
          setDesignAreaImages(da);
          const nextSelectedDesignAreaUrl =
            persisted?.selectedDesignAreaUrl && da.some((area) => area.url === persisted.selectedDesignAreaUrl)
              ? persisted.selectedDesignAreaUrl
              : da[0]?.url ?? null;
          setSelectedDesignAreaUrl(nextSelectedDesignAreaUrl);
        } else {
          setDesignAreaImages([]);
          setSelectedDesignAreaUrl(null);
        }

        // Color area images
        if (Array.isArray(item.colorAreaImages) && item.colorAreaImages.length > 0) {
          const ca: ColorAreaItem[] = item.colorAreaImages
            .filter((d: any) => d?.url)
            .map((d: any, i: number) => ({ id: `color-area-${i}`, url: d.url, label: d.label || `Color ${i + 1}` }));
          setColorAreaImages(ca);
          const nextSelectedColorAreaUrl =
            persisted?.selectedColorAreaUrl && ca.some((area) => area.url === persisted.selectedColorAreaUrl)
              ? persisted.selectedColorAreaUrl
              : ca[0]?.url ?? null;
          setSelectedColorAreaUrl(nextSelectedColorAreaUrl);
        } else {
          setColorAreaImages([]);
          setSelectedColorAreaUrl(null);
        }

        const collected: LayerItem[] = [];
        if (Array.isArray(item.artboardLayers) && item.artboardLayers.length > 0) {
          item.artboardLayers.forEach((layer: any, index: number) => {
            if (!layer?.url) return;
            collected.push({
              url: layer.url,
              label: layer.label || `Layer ${index + 1}`,
              blendMode: layer.blendMode || "normal",
            });
          });
          setLayers(collected);
        } else {
          // Primary base mockup (bottom layer)
          if (item.views?.primary?.baseMockup?.url)
            collected.push({ url: item.views.primary.baseMockup.url, label: "Base", blendMode: "normal" });
          // Blend layers in order: multiply -> screen -> overlay
          const blendMap: Record<string, string> = {
            multiply: "multiply",
            screen: "screen",
            overlay: "overlay",
          };
          for (const [key, mode] of Object.entries(blendMap)) {
            const layer = item.blendLayers?.[key];
            if (layer?.url) collected.push({ url: layer.url, label: layer.label || key, blendMode: mode });
          }
          // Primary overlay image (top layer)
          if (item.views?.primary?.overlayImage?.url)
            collected.push({ url: item.views.primary.overlayImage.url, label: "Overlay", blendMode: "normal" });

          setLayers(collected);
        }

        if (persisted) {
          setSelectedDesignId(persisted.selectedDesignId);
          setUploadedDesignByArea(persisted.uploadedDesignByArea || {});
          setDesignTransformById(persisted.designTransformById || {});
          setDesignNaturalSizes(persisted.designNaturalSizes || {});
          setAppliedColorByArea(persisted.appliedColorByArea || {});
          setArtboardBgColor(persisted.artboardBgColor ?? null);
          setOverlayItems(persisted.overlayItems || []);
          setSelectedOverlayId(persisted.selectedOverlayId ?? null);
        }
      } catch {
        // silently fail — artboard stays blank
      } finally {
        setIsLoadingProduct(false);
        setIsWorkspaceReady(true);
      }
    };
    void load();
  }, [id, apiBaseUrl]);

  useEffect(() => {
    if (!id || !isWorkspaceReady) return;

    const hasPersistedContent =
      Object.keys(uploadedDesignByArea).length > 0 ||
      Object.keys(appliedColorByArea).length > 0 ||
      overlayItems.length > 0 ||
      Boolean(artboardBgColor);

    if (!hasPersistedContent) {
      void writePersistedWorkspace(id, null);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void writePersistedWorkspace(id, {
        selectedDesignAreaUrl,
        selectedDesignId,
        uploadedDesignByArea,
        designTransformById,
        designNaturalSizes,
        selectedColorAreaUrl,
        appliedColorByArea,
        artboardBgColor,
        overlayItems,
        selectedOverlayId,
      });
    }, 150);

    return () => window.clearTimeout(timeoutId);
  }, [
    id,
    isWorkspaceReady,
    selectedDesignAreaUrl,
    selectedDesignId,
    uploadedDesignByArea,
    designTransformById,
    designNaturalSizes,
    selectedColorAreaUrl,
    appliedColorByArea,
    artboardBgColor,
    overlayItems,
    selectedOverlayId,
  ]);

  useEffect(() => {
    const el = artboardCanvasRef.current;
    if (!el) return;
    const update = () => setArtboardPixelSize({ w: el.offsetWidth, h: el.offsetHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [layers]);

  useEffect(() => {
    const entries = designAreaImages.filter((area) => area.sizeImageUrl);
    if (!entries.length) return;

    entries.forEach((area) => {
      if (!area.sizeImageUrl || bottomLayerNaturalByAreaId[area.id]) return;
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        setBottomLayerNaturalByAreaId((prev) => ({
          ...prev,
          [area.id]: { w: img.naturalWidth, h: img.naturalHeight },
        }));
      };
      img.src = area.sizeImageUrl;
    });
  }, [designAreaImages, bottomLayerNaturalByAreaId]);

  useEffect(() => {
    let isActive = true;

    const loadRightPanelMockups = async () => {
      setIsRightPanelLoading(true);
      try {
        const res = await fetch(`${apiBaseUrl}/mockups`);
        const result = await res.json();
        if (!res.ok || !result?.ok || !Array.isArray(result.items)) return;

        const mapped: SidebarMockupItem[] = result.items.map((item: any) => ({
          id: String(item?._id || ""),
          title: item?.title || "Untitled",
          image:
            item?.thumbnails?.[0]?.url ||
            item?.views?.primary?.baseMockup?.url ||
            "https://images.unsplash.com/photo-1634032188532-f11af97817ab?auto=format&fit=crop&w=1080&q=80",
          mainCategory: item?.mainCategory || "Apparel",
          category: item?.category || "Uncategorized",
        }));

        if (isActive) {
          setRightPanelMockups(mapped.filter((item) => item.id));
        }
      } catch {
        if (isActive) setRightPanelMockups([]);
      } finally {
        if (isActive) setIsRightPanelLoading(false);
      }
    };

    void loadRightPanelMockups();

    return () => {
      isActive = false;
    };
  }, [apiBaseUrl]);

  const filteredRightPanelMockups = useMemo(() => {
    const query = rightPanelSearch.trim().toLowerCase();
    if (!query) return rightPanelMockups;

    return rightPanelMockups.filter((item) => {
      const categoryText = [item.mainCategory, item.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return item.title.toLowerCase().includes(query) || categoryText.includes(query);
    });
  }, [rightPanelMockups, rightPanelSearch]);

  const trimTransparentImage = (source: string): Promise<{ src: string; w: number; h: number }> =>
    new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const fullCanvas = document.createElement("canvas");
        fullCanvas.width = Math.max(1, img.naturalWidth);
        fullCanvas.height = Math.max(1, img.naturalHeight);
        const fullCtx = fullCanvas.getContext("2d");
        if (!fullCtx) {
          resolve({ src: source, w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
          return;
        }

        fullCtx.drawImage(img, 0, 0);
        const { data, width, height } = fullCtx.getImageData(0, 0, fullCanvas.width, fullCanvas.height);

        let minX = width;
        let minY = height;
        let maxX = -1;
        let maxY = -1;

        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const alpha = data[(y * width + x) * 4 + 3];
            if (alpha > 8) {
              if (x < minX) minX = x;
              if (y < minY) minY = y;
              if (x > maxX) maxX = x;
              if (y > maxY) maxY = y;
            }
          }
        }

        if (maxX < minX || maxY < minY) {
          resolve({ src: source, w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
          return;
        }

        const trimW = maxX - minX + 1;
        const trimH = maxY - minY + 1;
        if (trimW === width && trimH === height) {
          resolve({ src: source, w: width, h: height });
          return;
        }

        const trimmedCanvas = document.createElement("canvas");
        trimmedCanvas.width = trimW;
        trimmedCanvas.height = trimH;
        const trimmedCtx = trimmedCanvas.getContext("2d");
        if (!trimmedCtx) {
          resolve({ src: source, w: width, h: height });
          return;
        }

        trimmedCtx.drawImage(fullCanvas, minX, minY, trimW, trimH, 0, 0, trimW, trimH);
        resolve({ src: trimmedCanvas.toDataURL("image/png"), w: trimW, h: trimH });
      };
      img.onerror = () => resolve({ src: source, w: 1, h: 1 });
      img.src = source;
    });

  const handleDesignUpload = (files: FileList | null, areaUrlOverride?: string) => {
    const areaUrl = areaUrlOverride ?? selectedDesignAreaUrl;
    if (!files || !files.length || !areaUrl) return;
    const incomingFiles = Array.from(files);
    const lastDesignId = createDesignId();

    incomingFiles.forEach((file, index) => {
      const designId = index === incomingFiles.length - 1 ? lastDesignId : createDesignId();
      const reader = new FileReader();
      reader.onload = async () => {
        const src = typeof reader.result === "string" ? reader.result : "";
        if (!src) return;

        const trimmed = await trimTransparentImage(src);

        setUploadedDesignByArea((prev) => ({
          ...prev,
          [areaUrl]: [...(prev[areaUrl] ?? []), { id: designId, src: trimmed.src }],
        }));
        setDesignTransformById((prev) => ({
          ...prev,
          [designId]: prev[designId] ?? defaultDesignTransform,
        }));
        setDesignNaturalSizes((prev) => ({
          ...prev,
          [designId]: { w: trimmed.w, h: trimmed.h },
        }));
      };
      reader.readAsDataURL(file);
    });

    setSelectedDesignId(lastDesignId);
  };

  useEffect(() => {
    const pending: Array<{ areaUrl: string; designId: string; src: string }> = [];

    Object.entries(uploadedDesignByArea).forEach(([areaUrl, designs]) => {
      designs.forEach((design) => {
        if (normalizedDesignIdsRef.current.has(design.id)) return;
        normalizedDesignIdsRef.current.add(design.id);
        pending.push({ areaUrl, designId: design.id, src: design.src });
      });
    });

    pending.forEach(({ areaUrl, designId, src }) => {
      void trimTransparentImage(src).then((trimmed) => {
        setUploadedDesignByArea((prev) => {
          const list = prev[areaUrl] ?? [];
          let changed = false;
          const nextList = list.map((item) => {
            if (item.id !== designId) return item;
            if (item.src === trimmed.src) return item;
            changed = true;
            return { ...item, src: trimmed.src };
          });
          if (!changed) return prev;
          return { ...prev, [areaUrl]: nextList };
        });

        setDesignNaturalSizes((prev) => {
          const existing = prev[designId];
          if (existing && existing.w === trimmed.w && existing.h === trimmed.h) return prev;
          return {
            ...prev,
            [designId]: { w: trimmed.w, h: trimmed.h },
          };
        });
      });
    });
  }, [uploadedDesignByArea]);

  const getDesignsForArea = (areaUrl: string) => uploadedDesignByArea[areaUrl] ?? [];

  const getSelectedDesign = () => {
    if (!selectedDesignAreaUrl || !selectedDesignId) return null;
    return getDesignsForArea(selectedDesignAreaUrl).find((design) => design.id === selectedDesignId) ?? null;
  };

  const getDesignTransform = (designId: string): DesignTransform => {
    return designTransformById[designId] ?? defaultDesignTransform;
  };

  const syncDesignNaturalSize = (designId: string, w: number, h: number) => {
    if (!w || !h) return;
    setDesignNaturalSizes((prev) => {
      const existing = prev[designId];
      if (existing && existing.w === w && existing.h === h) return prev;
      return {
        ...prev,
        [designId]: { w, h },
      };
    });
  };

  const getDesignBaseSize = (designId: string) => {
    const artW = artboardCanvasRef.current?.offsetWidth ?? 610;
    const artH = artboardCanvasRef.current?.offsetHeight ?? artW;
    const nat = designNaturalSizes[designId];

    if (!nat) {
      return { w: artW * 0.55, h: artH * 0.55 };
    }

    // Fit the uploaded image inside the artboard while preserving aspect ratio.
    const fit = Math.min(artW / nat.w, artH / nat.h, 1);
    return {
      w: nat.w * fit,
      h: nat.h * fit,
    };
  };

  const getBottomLayerLayout = (area: DesignAreaItem, artW: number, artH: number) => {
    if (!area.sizeImageUrl) return null;
    const t = area.sizeTransform ?? defaultDesignTransform;
    const nat = bottomLayerNaturalByAreaId[area.id];
    let baseW = artW;
    let baseH = artH;
    if (nat) {
      const fitScale = Math.min(artW / nat.w, artH / nat.h);
      baseW = nat.w * fitScale;
      baseH = nat.h * fitScale;
    }
    return {
      x: t.x,
      y: t.y,
      rotation: t.rotation,
      boxW: baseW * t.scale,
      boxH: baseH * t.scale,
      maskUrl: area.sizeImageUrl,
    };
  };

  const artboardToBottomLocal = (x: number, y: number, layout: { x: number; y: number; rotation: number }) => {
    const rad = (layout.rotation * Math.PI) / 180;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);
    const dx = x - layout.x;
    const dy = y - layout.y;
    return {
      x: dx * cosA + dy * sinA,
      y: -dx * sinA + dy * cosA,
    };
  };

  const deleteSelectedDesign = () => {
    if (!selectedDesignAreaUrl || !selectedDesignId) return;
    const areaUrl = selectedDesignAreaUrl;
    const designId = selectedDesignId;

    setUploadedDesignByArea((prev) => {
      const next = { ...prev };
      const remaining = (next[areaUrl] ?? []).filter((design) => design.id !== designId);
      if (remaining.length) next[areaUrl] = remaining;
      else delete next[areaUrl];
      return next;
    });

    setDesignTransformById((prev) => {
      const next = { ...prev };
      delete next[designId];
      return next;
    });

    setDesignNaturalSizes((prev) => {
      const next = { ...prev };
      delete next[designId];
      return next;
    });

    const remainingDesigns = getDesignsForArea(areaUrl).filter((design) => design.id !== designId);
    setSelectedDesignId(remainingDesigns[remainingDesigns.length - 1]?.id ?? null);
    setRotationGuide((prev) => (prev?.designId === designId ? null : prev));
  };

  const handleDesignPreviewMouseDown = (e: React.PointerEvent<HTMLElement>, areaUrl: string, designId: string) => {
    const transform = getDesignTransform(designId);
    setSelectedDesignAreaUrl(areaUrl);
    setSelectedDesignId(designId);
    isDraggingDesign.current = true;
    designDragStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      x: transform.x,
      y: transform.y,
      areaUrl,
      designId,
    };
    e.stopPropagation();
    e.preventDefault();
  };

  const getInteractionCenter = () => {
    const rect = artboardCanvasRef.current?.getBoundingClientRect();
    if (!rect) return null;

    if (selectedDesignId) {
      const t = getDesignTransform(selectedDesignId);
      return {
        x: rect.left + rect.width / 2 + t.x * artboardZoom,
        y: rect.top + rect.height / 2 + t.y * artboardZoom,
      };
    }

    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  };

  const getDistanceFromCenter = (clientX: number, clientY: number) => {
    const center = getInteractionCenter();
    if (!center) return 0;
    const dx = clientX - center.x;
    const dy = clientY - center.y;
    return Math.hypot(dx, dy);
  };

  const getAngleFromCenter = (clientX: number, clientY: number) => {
    const center = getInteractionCenter();
    if (!center) return 0;
    const dx = clientX - center.x;
    const dy = clientY - center.y;
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  };

  const handleDesignScaleMouseDown = (e: React.PointerEvent<HTMLButtonElement>, areaUrl: string, designId: string) => {
    const transform = getDesignTransform(designId);
    setSelectedDesignAreaUrl(areaUrl);
    setSelectedDesignId(designId);
    isScalingDesign.current = true;
    designScaleStart.current = {
      distance: Math.max(getDistanceFromCenter(e.clientX, e.clientY), 1),
      scale: transform.scale,
      areaUrl,
      designId,
    };
    e.stopPropagation();
    e.preventDefault();
  };

  const handleDesignRotateMouseDown = (e: React.PointerEvent<HTMLButtonElement>, areaUrl: string, designId: string) => {
    const transform = getDesignTransform(designId);
    setSelectedDesignAreaUrl(areaUrl);
    setSelectedDesignId(designId);
    setRotationGuide({ areaUrl, designId, angle: normalizeAngle(transform.rotation), snapped: false });
    isRotatingDesign.current = true;
    designRotateStart.current = {
      angle: getAngleFromCenter(e.clientX, e.clientY),
      rotation: transform.rotation,
      areaUrl,
      designId,
    };
    e.stopPropagation();
    e.preventDefault();
  };

  const openColorPickerForArea = (areaUrl: string) => {
    setSelectedColorAreaUrl(areaUrl);
    const existingColor = appliedColorByArea[areaUrl] || "#ff6b35";
    setPendingHsv(hexToHsv(existingColor));
    setHexInputValue(existingColor.toUpperCase());
    setColorPickerTargetUrl(areaUrl);
  };

  const applySelectedColor = () => {
    if (!colorPickerTargetUrl) return;
    if (colorPickerTargetUrl === BACKGROUND_PICKER_KEY) {
      setArtboardBgColor(pendingColor);
    } else {
      setAppliedColorByArea((prev) => ({
        ...prev,
        [colorPickerTargetUrl]: pendingColor,
      }));
    }
    setColorPickerTargetUrl(null);
    setMobilePanel(null);
  };

  const openBackgroundColorPicker = () => {
    const existingColor = artboardBgColor || "#ff6b35";
    setPendingHsv(hexToHsv(existingColor));
    setHexInputValue(existingColor.toUpperCase());
    setColorPickerTargetUrl(BACKGROUND_PICKER_KEY);
  };

  const addTextOverlay = () => {
    const id = createDesignId();
    const item: OverlayItem = { id, type: "text", x: 0, y: 0, scale: 1, rotation: 0, text: "Your Text", fontSize: 24, fontColor: "#FFFFFF", textAlign: "center" };
    setOverlayItems((prev) => [...prev, item]);
    setSelectedOverlayId(id);
    setEditingTextOverlayId(id);
    setPendingOverlayText(item.text!);
    setPendingOverlayFontColor(item.fontColor!);
    setPendingOverlayTextAlign(item.textAlign!);
    setTextColorHsv(hexToHsv(item.fontColor!));
    setShowTextColorPicker(false);
  };

  const handleLogoUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      const id = createDesignId();
      const item: OverlayItem = { id, type: "logo", x: 0, y: 0, scale: 1, rotation: 0, src };
      setOverlayItems((prev) => [...prev, item]);
      setSelectedOverlayId(id);
      setMobilePanel(null);
    };
    reader.readAsDataURL(file);
  };

  const removeOverlay = (overlayId: string) => {
    setOverlayItems((prev) => prev.filter((o) => o.id !== overlayId));
    if (selectedOverlayId === overlayId) setSelectedOverlayId(null);
  };

  const handleOverlayMouseDown = (e: React.PointerEvent, overlayId: string) => {
    const item = overlayItems.find((o) => o.id === overlayId);
    if (!item) return;
    setSelectedOverlayId(overlayId);
    setSelectedDesignId(null);
    setSelectedDesignAreaUrl(null);
    isDraggingOverlay.current = true;
    overlayDragStart.current = { mouseX: e.clientX, mouseY: e.clientY, x: item.x, y: item.y, id: overlayId };
    e.stopPropagation();
    e.preventDefault();
  };

  const handleOverlayScaleMouseDown = (e: React.PointerEvent, overlayId: string) => {
    const item = overlayItems.find((o) => o.id === overlayId);
    if (!item) return;
    isScalingOverlay.current = true;
    overlayScaleStart.current = { mouseX: e.clientX, mouseY: e.clientY, scale: item.scale, id: overlayId };
    e.stopPropagation();
    e.preventDefault();
  };

  const getOverlayCenter = (overlayId: string) => {
    const rect = artboardCanvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const item = overlayItems.find((o) => o.id === overlayId);
    if (!item) return null;
    return {
      x: rect.left + rect.width / 2 + item.x * artboardZoom,
      y: rect.top + rect.height / 2 + item.y * artboardZoom,
    };
  };

  const handleOverlayRotateMouseDown = (e: React.PointerEvent, overlayId: string) => {
    const item = overlayItems.find((o) => o.id === overlayId);
    if (!item) return;
    const center = getOverlayCenter(overlayId);
    if (!center) return;
    const startAngle = (Math.atan2(e.clientY - center.y, e.clientX - center.x) * 180) / Math.PI;
    isRotatingOverlay.current = true;
    overlayRotateStart.current = { angle: startAngle, rotation: item.rotation, id: overlayId };
    e.stopPropagation();
    e.preventDefault();
  };

  const openTextEditor = (overlayId: string) => {
    const item = overlayItems.find((o) => o.id === overlayId);
    if (!item || item.type !== "text") return;
    setEditingTextOverlayId(overlayId);
    setMobilePanel(null);
    setPendingOverlayText(item.text || "");
    setPendingOverlayFontColor(item.fontColor || "#FFFFFF");
    setPendingOverlayTextAlign(item.textAlign || "center");
    setTextColorHsv(hexToHsv(item.fontColor || "#FFFFFF"));
    setShowTextColorPicker(false);
  };

  const applyTextEdit = () => {
    if (!editingTextOverlayId) return;
    setOverlayItems((prev) =>
      prev.map((o) =>
        o.id === editingTextOverlayId
          ? { ...o, text: pendingOverlayText, fontSize: pendingOverlayFontSize, fontColor: pendingOverlayFontColor, textAlign: pendingOverlayTextAlign }
          : o,
      ),
    );
    setEditingTextOverlayId(null);
  };

  const handlePalettePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setSvByPointer(e.clientX, e.clientY);
    const move = (ev: PointerEvent) => setSvByPointer(ev.clientX, ev.clientY);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const handleArtboardMouseDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    dragStart.current = { mouseX: e.clientX, mouseY: e.clientY, posX: artboardPos.x, posY: artboardPos.y };
    e.preventDefault();
  };

  const handleArtboardWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const zoomStep = 0.08;
    const minZoom = 0.4;
    const maxZoom = 3;

    setArtboardZoom((prev) => {
      const next = e.deltaY < 0 ? prev + zoomStep : prev - zoomStep;
      return clamp(next, minZoom, maxZoom);
    });
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isScalingDesign.current) {
        const designId = designScaleStart.current.designId;
        const currentDistance = Math.max(getDistanceFromCenter(e.clientX, e.clientY), 1);
        const ratio = currentDistance / designScaleStart.current.distance;
        const nextScale = clamp(designScaleStart.current.scale * ratio, MIN_DESIGN_SCALE, 3);
        setDesignTransformById((prev) => {
          const current = prev[designId] ?? defaultDesignTransform;
          return {
            ...prev,
            [designId]: {
              ...current,
              scale: nextScale,
            },
          };
        });
        return;
      }

      if (isRotatingDesign.current) {
        const areaUrl = designRotateStart.current.areaUrl;
        const designId = designRotateStart.current.designId;
        const currentAngle = getAngleFromCenter(e.clientX, e.clientY);
        const angleDelta = currentAngle - designRotateStart.current.angle;
        const rawRotation = designRotateStart.current.rotation + angleDelta;
        const snappedRotation = getSnappedRotation(rawRotation, DESIGN_ROTATION_SNAP_STEP);
        setDesignTransformById((prev) => {
          const current = prev[designId] ?? defaultDesignTransform;
          return {
            ...prev,
            [designId]: {
              ...current,
              rotation: snappedRotation.angle,
            },
          };
        });
        setRotationGuide({
          areaUrl,
          designId,
          angle: snappedRotation.guideAngle,
          snapped: snappedRotation.snapped,
        });
        return;
      }

      if (isDraggingDesign.current) {
        const dx = e.clientX - designDragStart.current.mouseX;
        const dy = e.clientY - designDragStart.current.mouseY;
        const designId = designDragStart.current.designId;
        setDesignTransformById((prev) => {
          const current = prev[designId] ?? defaultDesignTransform;
          return {
            ...prev,
            [designId]: {
              ...current,
              x: designDragStart.current.x + dx,
              y: designDragStart.current.y + dy,
            },
          };
        });
        return;
      }

      if (isScalingOverlay.current) {
        const dx = e.clientX - overlayScaleStart.current.mouseX;
        const dy = e.clientY - overlayScaleStart.current.mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy) * Math.sign(dx + dy);
        const nextScale = clamp(overlayScaleStart.current.scale + dist / 150, 0.1, 5);
        setOverlayItems((prev) => prev.map((o) => o.id === overlayScaleStart.current.id ? { ...o, scale: nextScale } : o));
        return;
      }

      if (isRotatingOverlay.current) {
        const center = getOverlayCenter(overlayRotateStart.current.id);
        if (center) {
          const currentAngle = (Math.atan2(e.clientY - center.y, e.clientX - center.x) * 180) / Math.PI;
          const angleDelta = currentAngle - overlayRotateStart.current.angle;
          const rawRotation = overlayRotateStart.current.rotation + angleDelta;
          const snapped = getSnappedRotation(rawRotation, OVERLAY_ROTATION_SNAP_STEP);
          setOverlayItems((prev) => prev.map((o) => o.id === overlayRotateStart.current.id ? { ...o, rotation: snapped.angle } : o));
        }
        return;
      }

      if (isDraggingOverlay.current) {
        const dx = e.clientX - overlayDragStart.current.mouseX;
        const dy = e.clientY - overlayDragStart.current.mouseY;
        setOverlayItems((prev) =>
          prev.map((o) =>
            o.id === overlayDragStart.current.id
              ? { ...o, x: overlayDragStart.current.x + dx / artboardZoom, y: overlayDragStart.current.y + dy / artboardZoom }
              : o,
          ),
        );
        return;
      }

      if (!isDragging.current) return;
      const dx = e.clientX - dragStart.current.mouseX;
      const dy = e.clientY - dragStart.current.mouseY;
      setArtboardPos({ x: dragStart.current.posX + dx, y: dragStart.current.posY + dy });
    };
    const onMouseUp = () => {
      isDragging.current = false;
      isDraggingDesign.current = false;
      isScalingDesign.current = false;
      isRotatingDesign.current = false;
      isDraggingOverlay.current = false;
      isScalingOverlay.current = false;
      isRotatingOverlay.current = false;
      setRotationGuide(null);
    };
    window.addEventListener("pointermove", onMouseMove);
    window.addEventListener("pointerup", onMouseUp);
    return () => {
      window.removeEventListener("pointermove", onMouseMove);
      window.removeEventListener("pointerup", onMouseUp);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!exportMenuRef.current) return;
      if (!exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDownload = async () => {
    if (isDownloading) return;
    if (requireSigninForExtraDownload()) return;

    const sizeMap: Record<string, number> = {
      "4000x4000 px": 4000,
      "1000x1000 px": 1000,
      "500x500 px": 500,
    };
    const targetPx = sizeMap[exportSize] ?? 1000;
    const artW = artboardCanvasRef.current?.offsetWidth ?? 610;
    const artH = artboardCanvasRef.current?.offsetHeight ?? artW;
    const scale = targetPx / artW;
    const canvasW = targetPx;
    const canvasH = Math.round(artH * scale);

    const canvas = document.createElement("canvas");
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const loadImg = (src: string): Promise<HTMLImageElement> =>
      new Promise((resolve, reject) => {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });

    const drawMaskedLayer = async (
      drawFn: (tmpCtx: CanvasRenderingContext2D) => Promise<void>,
      maskSrc: string,
    ) => {
      const tmp = document.createElement("canvas");
      tmp.width = canvasW;
      tmp.height = canvasH;
      const tmpCtx = tmp.getContext("2d")!;
      await drawFn(tmpCtx);
      tmpCtx.globalCompositeOperation = "destination-in";
      const mask = await loadImg(maskSrc);
      tmpCtx.drawImage(mask, 0, 0, canvasW, canvasH);
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(tmp, 0, 0);
    };

    setIsDownloading(true);
    try {
      // Background color
      if (artboardBgColor) {
        ctx.fillStyle = artboardBgColor;
        ctx.fillRect(0, 0, canvasW, canvasH);
      } else if (exportFormat === "JPEG") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvasW, canvasH);
      }

      // 1. Color areas (bottom)
      for (const area of colorAreaImages) {
        const color = appliedColorByArea[area.url];
        if (!color) continue;
        await drawMaskedLayer(async (tmpCtx) => {
          tmpCtx.fillStyle = color;
          tmpCtx.fillRect(0, 0, canvasW, canvasH);
        }, area.url);
      }

      // 2. Design areas (middle)
      for (const area of designAreaImages) {
        const areaDesigns = getDesignsForArea(area.url);
        const bottomLayout = getBottomLayerLayout(area, artW, artH);
        const corners = area.perspectiveCorners ?? DEFAULT_CORNERS;
        const hasPerspective = !isDefaultCorners(corners);
        for (const design of areaDesigns) {
          const t = getDesignTransform(design.id);
          const baseSize = getDesignBaseSize(design.id);
          await drawMaskedLayer(async (tmpCtx) => {
            const img = await loadImg(design.src);

            if (bottomLayout) {
              const local = artboardToBottomLocal(t.x, t.y, bottomLayout);
              const layerCanvas = document.createElement("canvas");
              layerCanvas.width = Math.max(1, Math.round(bottomLayout.boxW * scale));
              layerCanvas.height = Math.max(1, Math.round(bottomLayout.boxH * scale));
              const lCtx = layerCanvas.getContext("2d")!;

              lCtx.save();
              lCtx.translate(layerCanvas.width / 2 + local.x * scale, layerCanvas.height / 2 + local.y * scale);
              lCtx.rotate((t.rotation * Math.PI) / 180);
              lCtx.scale(t.scale, t.scale);
              lCtx.drawImage(img, -(baseSize.w * scale) / 2, -(baseSize.h * scale) / 2, baseSize.w * scale, baseSize.h * scale);
              if (designWrapperStrength > 0) {
                lCtx.globalAlpha = designWrapperStrength;
                lCtx.globalCompositeOperation = "multiply";
                lCtx.drawImage(img, -(baseSize.w * scale) / 2, -(baseSize.h * scale) / 2, baseSize.w * scale, baseSize.h * scale);
                lCtx.globalCompositeOperation = "source-over";
                lCtx.globalAlpha = 1;
              }
              lCtx.restore();

              lCtx.globalCompositeOperation = "destination-in";
              const bottomMask = await loadImg(bottomLayout.maskUrl);
              lCtx.drawImage(bottomMask, 0, 0, layerCanvas.width, layerCanvas.height);

              let outputCanvas = layerCanvas;
              if (hasPerspective) {
                const warped = document.createElement("canvas");
                warped.width = layerCanvas.width;
                warped.height = layerCanvas.height;
                const wCtx = warped.getContext("2d")!;
                drawCanvasWarp(wCtx, layerCanvas, corners, warped.width, warped.height);
                outputCanvas = warped;
              }

              tmpCtx.save();
              tmpCtx.translate(canvasW / 2 + bottomLayout.x * scale, canvasH / 2 + bottomLayout.y * scale);
              tmpCtx.rotate((bottomLayout.rotation * Math.PI) / 180);
              tmpCtx.drawImage(outputCanvas, -outputCanvas.width / 2, -outputCanvas.height / 2);
              tmpCtx.restore();
            } else {
              tmpCtx.save();
              tmpCtx.translate(canvasW / 2 + t.x * scale, canvasH / 2 + t.y * scale);
              tmpCtx.rotate((t.rotation * Math.PI) / 180);
              tmpCtx.scale(t.scale, t.scale);
              tmpCtx.drawImage(img, -(baseSize.w * scale) / 2, -(baseSize.h * scale) / 2, baseSize.w * scale, baseSize.h * scale);
              if (designWrapperStrength > 0) {
                tmpCtx.globalAlpha = designWrapperStrength;
                tmpCtx.globalCompositeOperation = "multiply";
                tmpCtx.drawImage(img, -(baseSize.w * scale) / 2, -(baseSize.h * scale) / 2, baseSize.w * scale, baseSize.h * scale);
                tmpCtx.globalCompositeOperation = "source-over";
                tmpCtx.globalAlpha = 1;
              }
              tmpCtx.restore();
            }
          }, area.url);
        }
      }

      // 3. Blending layers (top) — draw bottom z first (reverse idx)
      for (let i = layers.length - 1; i >= 0; i--) {
        const layer = layers[i];
        const img = await loadImg(layer.url);
        ctx.globalCompositeOperation = (layer.blendMode === "normal" ? "source-over" : layer.blendMode) as GlobalCompositeOperation;
        ctx.drawImage(img, 0, 0, canvasW, canvasH);
        ctx.globalCompositeOperation = "source-over";
      }

      // 4. Overlay items (text & logo) on top of everything
      for (const item of overlayItems) {
        ctx.save();
        ctx.translate(canvasW / 2 + item.x * scale, canvasH / 2 + item.y * scale);
        ctx.rotate((item.rotation * Math.PI) / 180);
        ctx.scale(item.scale, item.scale);
        if (item.type === "text") {
          const fs = (item.fontSize || 24) * scale;
          ctx.font = `600 ${fs}px sans-serif`;
          ctx.fillStyle = item.fontColor || "#FFFFFF";
          ctx.textAlign = item.textAlign || "center";
          ctx.textBaseline = "middle";
          const lines = (item.text || "Text").split("\n");
          const lineH = fs * 1.3;
          const totalH = lineH * lines.length;
          // measure max width for alignment offset
          const maxW = Math.max(...lines.map((l) => ctx.measureText(l).width));
          const alignX = item.textAlign === "left" ? -maxW / 2 : item.textAlign === "right" ? maxW / 2 : 0;
          lines.forEach((line, i) => {
            ctx.fillText(line, alignX, -totalH / 2 + lineH / 2 + i * lineH);
          });
        } else if (item.src) {
          const img = await loadImg(item.src);
          const maxDim = 150 * scale;
          const ratio = Math.min(maxDim / img.naturalWidth, maxDim / img.naturalHeight, 1);
          const w = img.naturalWidth * ratio;
          const h = img.naturalHeight * ratio;
          ctx.drawImage(img, -w / 2, -h / 2, w, h);
        }
        ctx.restore();
      }

      const mimeType = exportFormat === "PNG" ? "image/png" : "image/jpeg";
      const quality = exportFormat === "JPEG" ? 0.95 : undefined;
      canvas.toBlob(
        async (blob) => {
          if (!blob) { setIsDownloading(false); return; }
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `mockup.${exportFormat.toLowerCase()}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          markGuestDownloadUsed();

          if (id) {
            try {
              await fetch(`${apiBaseUrl}/mockups/${id}/downloads/increment`, {
                method: "POST",
              });
            } catch {
              // Keep download successful even if counter update fails.
            }
          }

          const signedInUser = readAuthUser();
          if (signedInUser?.email) {
            try {
              await fetch(`${apiBaseUrl}/auth/users/downloads/increment`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mockupId: id || "", productTitle }),
              });
            } catch {
              // Keep download successful even if user counter update fails.
            }
          }

          setIsDownloading(false);
          setIsExportMenuOpen(false);
        },
        mimeType,
        quality,
      );
    } catch (err) {
      console.error("Download failed:", err);
      setIsDownloading(false);
    }
  };

  const selectedWorkspaceDesign = getSelectedDesign();
  const selectedWorkspaceTransform = selectedDesignId ? getDesignTransform(selectedDesignId) : null;
  const selectedWorkspaceScalePercent = selectedWorkspaceTransform
    ? selectedWorkspaceTransform.scale >= 1
      ? 100
      : Math.round(((clamp(selectedWorkspaceTransform.scale, MIN_DESIGN_SCALE, 1) - MIN_DESIGN_SCALE) / (1 - MIN_DESIGN_SCALE)) * 100)
    : 0;
  const selectedWorkspaceRotation = selectedWorkspaceTransform
    ? Math.round(normalizeAngle(selectedWorkspaceTransform.rotation))
    : 0;

  const setSelectedWorkspaceScalePercent = (nextPercent: number) => {
    if (!selectedDesignId) return;
    const safePercent = clamp(nextPercent, 0, 100);
    const nextScale = MIN_DESIGN_SCALE + (safePercent / 100) * (1 - MIN_DESIGN_SCALE);
    setDesignTransformById((prev) => {
      const current = prev[selectedDesignId] ?? defaultDesignTransform;
      return {
        ...prev,
        [selectedDesignId]: {
          ...current,
          scale: clamp(nextScale, MIN_DESIGN_SCALE, 3),
        },
      };
    });
  };

  const setSelectedWorkspaceRotation = (nextRotation: number) => {
    if (!selectedDesignId) return;
    const safeRotation = clamp(nextRotation, -180, 180);
    setDesignTransformById((prev) => {
      const current = prev[selectedDesignId] ?? defaultDesignTransform;
      return {
        ...prev,
        [selectedDesignId]: {
          ...current,
          rotation: safeRotation,
        },
      };
    });
    if (selectedDesignAreaUrl) {
      setRotationGuide({
        areaUrl: selectedDesignAreaUrl,
        designId: selectedDesignId,
        angle: normalizeAngle(safeRotation),
        snapped: false,
      });
    }
  };

  const handleDeleteAllDesigns = () => {
    const hasAnyDesign = Object.values(uploadedDesignByArea).some((items) => items.length > 0);
    if (!hasAnyDesign) return;

    setIsDeleteAllModalOpen(true);
  };

  const confirmDeleteAllDesigns = () => {
    setIsDeleteAllModalOpen(false);

    setUploadedDesignByArea({});
    setDesignTransformById({});
    setDesignNaturalSizes({});
    setSelectedDesignId(null);
    setSelectedDesignAreaUrl(null);
    setRotationGuide(null);
  };

  return (
    <div className="relative min-h-[calc(100vh-73px)] overflow-hidden bg-background px-4 pb-20 pt-2 md:px-6 md:pb-20 md:pt-2 lg:px-8 lg:pb-8 lg:pt-3">
      <div className="absolute inset-0 hero-bg" />
      <div className="absolute inset-0 hero-grid-bg" />

      <section className="relative z-30 mb-3.5 rounded-xl border border-white/8 bg-[#16161F] px-4 sm:px-6 py-3 sm:py-3.5 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/80">Workspace</p>
            <h1 className="mt-1 text-lg sm:text-2xl font-semibold text-zinc-100 line-clamp-1">{productTitle}</h1>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {selectedWorkspaceDesign && selectedWorkspaceTransform ? (
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-white/12 bg-black/20 px-2 py-1.5">
                <label className="flex items-center gap-2 rounded-sm border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-zinc-200">
                  <span className="font-medium text-zinc-300">Scale</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={selectedWorkspaceScalePercent}
                    onChange={(e) => setSelectedWorkspaceScalePercent(Number(e.currentTarget.value))}
                    className="w-24 accent-primary"
                  />
                  <span className="w-9 text-right font-semibold text-primary">{selectedWorkspaceScalePercent}%</span>
                </label>

                <label className="flex items-center gap-2 rounded-sm border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-zinc-200">
                  <span className="font-medium text-zinc-300">Rotate</span>
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    value={selectedWorkspaceRotation}
                    onChange={(e) => setSelectedWorkspaceRotation(Number(e.currentTarget.value))}
                    className="w-24 accent-primary"
                  />
                  <input
                    type="number"
                    min={-180}
                    max={180}
                    value={selectedWorkspaceRotation}
                    onChange={(e) => setSelectedWorkspaceRotation(Number(e.currentTarget.value || 0))}
                    className="w-14 rounded-sm border border-white/15 bg-black/30 px-1.5 py-0.5 text-right text-[11px] font-semibold text-primary outline-none focus:border-primary/60"
                  />
                  <span className="text-zinc-400">deg</span>
                </label>

                <button
                  type="button"
                  onClick={handleDeleteAllDesigns}
                  disabled={!Object.values(uploadedDesignByArea).some((items) => items.length > 0)}
                  className="rounded-sm border border-red-500/45 bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold text-red-300 transition hover:bg-red-500/18 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-zinc-500"
                >
                  Delete all design
                </button>
              </div>
            ) : null}

            <div ref={exportMenuRef} className="relative flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsExportMenuOpen((prev) => !prev)}
              className="flex h-10 items-center gap-1.5 rounded-sm bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              Export
              <ChevronDown className={`h-4 w-4 transition ${isExportMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {isExportMenuOpen ? (
              <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-[260px] rounded-lg border border-white/10 bg-[#171722] p-3 shadow-[0_16px_35px_rgba(0,0,0,0.35)]">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Format</p>
                <div className="mb-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExportFormat("JPEG")}
                    className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                      exportFormat === "JPEG"
                        ? "bg-primary/15 text-primary"
                        : "text-zinc-200 hover:bg-white/6"
                    }`}
                  >
                    JPEG
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportFormat("PNG")}
                    className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                      exportFormat === "PNG"
                        ? "bg-primary/15 text-primary"
                        : "text-zinc-200 hover:bg-white/6"
                    }`}
                  >
                    PNG
                  </button>
                </div>

                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Size</p>
                <div className="mb-4 space-y-1.5">
                  {(["4000x4000 px", "1000x1000 px", "500x500 px"] as const).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setExportSize(size)}
                      className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                        exportSize === size
                          ? "bg-primary/15 text-primary"
                          : "text-zinc-200 hover:bg-white/6"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isDownloading ? "Downloading…" : "Download"}
                </button>
              </div>
            ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className="relative z-10 flex gap-3.5" style={{ isolation: "isolate" }}>
        {/* Left Panel */}
        <section
          className={`overflow-y-auto border border-white/8 bg-[#16161F] p-5 lg:relative lg:z-0 lg:block lg:max-h-[calc(100vh-140px)] lg:w-[280px] lg:shrink-0 lg:rounded-xl lg:shadow-[0_12px_30px_rgba(0,0,0,0.18)] ${
            mobilePanel === "left"
              ? "fixed bottom-14 left-0 right-0 z-[55] max-h-[80vh] rounded-t-2xl shadow-[0_-8px_40px_rgba(0,0,0,0.55)]"
              : "hidden"
          }`}
        >
          <div className="mb-4 flex items-center justify-center lg:hidden">
            <div className="h-1 w-10 rounded-full bg-white/20" />
          </div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/80">Layers</p>
          <h2 className="mb-3 text-base font-semibold text-zinc-100">Design Area</h2>

          {designAreaImages.length === 0 ? (
            <p className="text-xs text-zinc-500">No design area images found.</p>
          ) : (
            <div className="space-y-2.5 rounded-lg border border-white/10 bg-black/10 p-2">
              {designAreaImages.map((item) => (
                (() => {
                  const areaDesigns = getDesignsForArea(item.url);
                  const selectedAreaDesign = areaDesigns.find((design) => design.id === selectedDesignId) ?? areaDesigns[areaDesigns.length - 1] ?? null;
                  return (
                <div
                  key={item.id}
                  className={`group flex w-full items-center rounded-sm border border-dashed px-3 py-2 text-left transition ${
                    selectedDesignAreaUrl === item.url
                      ? "border-primary/90 bg-primary/12 shadow-[inset_0_0_0_1px_rgba(255,107,53,0.25)]"
                      : "border-white/20 bg-black/25 hover:border-primary/55 hover:bg-white/5"
                  }`}
                >
                  {areaDesigns.length === 0 ? (
                    <label
                      className="min-w-0 flex-1 cursor-pointer text-left"
                      onClick={() => {
                        setSelectedDesignAreaUrl(item.url);
                        setSelectedDesignId(null);
                      }}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="sr-only"
                        onChange={(e) => {
                          handleDesignUpload(e.currentTarget.files, item.url);
                          e.currentTarget.value = "";
                          setMobilePanel(null);
                        }}
                      />
                      <span className="flex items-center gap-1.5 truncate text-xs font-medium text-zinc-200">
                        <Upload className="h-3.5 w-3.5 shrink-0 text-primary transition group-hover:scale-105" />
                        <span className="truncate">{item.label}</span>
                      </span>
                      <span className="mt-0.5 block text-[10px] text-zinc-500">Click to upload design</span>
                    </label>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDesignAreaUrl(item.url);
                        setSelectedDesignId(selectedAreaDesign?.id ?? null);
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="flex items-center gap-1.5 truncate text-xs font-medium text-zinc-200">
                        <Upload className="h-3.5 w-3.5 shrink-0 text-primary transition group-hover:scale-105" />
                        <span className="truncate">{item.label}</span>
                      </span>
                      <span className="mt-0.5 block text-[10px] text-primary">{areaDesigns.length} design{areaDesigns.length > 1 ? "s" : ""} added</span>
                    </button>
                  )}
                  <label
                    className="ml-2 cursor-pointer rounded-sm border border-primary/35 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-primary transition hover:bg-primary/10"
                    onClick={() => {
                      setSelectedDesignAreaUrl(item.url);
                      setSelectedDesignId(selectedAreaDesign?.id ?? null);
                    }}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="sr-only"
                      onChange={(e) => {
                        handleDesignUpload(e.currentTarget.files, item.url);
                        e.currentTarget.value = "";
                        setMobilePanel(null);
                      }}
                    />
                    Add
                  </label>
                </div>
                  );
                })()
              ))}

              <p className="pt-1 text-[11px] text-zinc-500">Dashed layer rows indicate upload targets.</p>
            </div>
          )}

          <h2 className="mb-3 mt-5 text-base font-semibold text-zinc-100">Color Area</h2>

          {colorAreaImages.length === 0 ? (
            <p className="text-xs text-zinc-500">No color area images found.</p>
          ) : (
            <div className="space-y-2.5 rounded-lg border border-white/10 bg-black/10 p-2">
              {colorAreaImages.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    openColorPickerForArea(item.url);
                  }}
                  className={`group flex w-full items-center rounded-sm border border-dashed px-3 py-2 text-left transition ${
                    selectedColorAreaUrl === item.url
                      ? "border-primary/90 bg-primary/12 shadow-[inset_0_0_0_1px_rgba(255,107,53,0.25)]"
                      : "border-white/20 bg-black/25 hover:border-primary/55 hover:bg-white/5"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 truncate text-xs font-medium text-zinc-200">
                      <Palette className="h-3.5 w-3.5 shrink-0 text-primary transition group-hover:scale-105" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {appliedColorByArea[item.url] ? (
                      <span className="mt-0.5 block text-[10px] text-primary">Change Color</span>
                    ) : (
                      <span className="mt-0.5 block text-[10px] text-zinc-500">Click to choose color</span>
                    )}
                  </div>
                </button>
              ))}

              <p className="pt-1 text-[11px] text-zinc-500">Click any layer to open color palette.</p>
            </div>
          )}

          <h2 className="mb-3 mt-5 text-base font-semibold text-zinc-100">Background <span className="text-xs font-normal text-zinc-500">(Optional)</span></h2>
          <div className="space-y-2.5 rounded-lg border border-white/10 bg-black/10 p-2">
            <button
              type="button"
              onClick={() => {
                openBackgroundColorPicker();
              }}
              className={`group flex w-full items-center rounded-sm border border-dashed px-3 py-2 text-left transition ${
                artboardBgColor
                  ? "border-primary/90 bg-primary/12 shadow-[inset_0_0_0_1px_rgba(255,107,53,0.25)]"
                  : "border-white/20 bg-black/25 hover:border-primary/55 hover:bg-white/5"
              }`}
            >
              {artboardBgColor && (
                <div
                  className="mr-2.5 h-5 w-5 shrink-0 rounded-sm border border-white/20"
                  style={{ backgroundColor: artboardBgColor }}
                />
              )}
              <div className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 truncate text-xs font-medium text-zinc-200">
                  <Palette className="h-3.5 w-3.5 shrink-0 text-primary transition group-hover:scale-105" />
                  <span className="truncate">Add Background</span>
                </span>
                {artboardBgColor ? (
                  <span className="mt-0.5 block text-[10px] text-primary">Change Color</span>
                ) : (
                  <span className="mt-0.5 block text-[10px] text-zinc-500">Click to add solid color</span>
                )}
              </div>
              {artboardBgColor && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setArtboardBgColor(null);
                  }}
                  className="ml-2 shrink-0 rounded p-0.5 text-zinc-500 transition hover:bg-white/10 hover:text-red-400"
                  title="Remove background"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                addTextOverlay();
                setMobilePanel(null);
              }}
              className="group flex w-full items-center rounded-sm border border-dashed border-white/20 bg-black/25 px-3 py-2 text-left transition hover:border-primary/55 hover:bg-white/5"
            >
              <div className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 truncate text-xs font-medium text-zinc-200">
                  <Type className="h-3.5 w-3.5 shrink-0 text-primary transition group-hover:scale-105" />
                  <span className="truncate">Add Text</span>
                </span>
                <span className="mt-0.5 block text-[10px] text-zinc-500">Click to add text overlay</span>
              </div>
            </button>
            <label
              className="group flex w-full cursor-pointer items-center rounded-sm border border-dashed border-white/20 bg-black/25 px-3 py-2 text-left transition hover:border-primary/55 hover:bg-white/5"
            >
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => { handleLogoUpload(e.currentTarget.files); e.currentTarget.value = ""; }}
              />
              <div className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 truncate text-xs font-medium text-zinc-200">
                  <ImagePlus className="h-3.5 w-3.5 shrink-0 text-primary transition group-hover:scale-105" />
                  <span className="truncate">Add Logo</span>
                </span>
                <span className="mt-0.5 block text-[10px] text-zinc-500">Click to upload logo image</span>
              </div>
            </label>
            {overlayItems.length > 0 && (
              <div className="mt-1 space-y-1.5">
                {overlayItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedOverlayId(item.id);
                      setSelectedDesignId(null);
                      setSelectedDesignAreaUrl(null);
                    }}
                    className={`flex items-center justify-between rounded-sm border px-2.5 py-1.5 text-xs transition cursor-pointer ${
                      selectedOverlayId === item.id
                        ? "border-primary/70 bg-primary/10 text-zinc-100"
                        : "border-white/10 bg-black/20 text-zinc-300 hover:border-white/20"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      {item.type === "text" ? <Type className="h-3 w-3 text-primary" /> : <ImagePlus className="h-3 w-3 text-primary" />}
                      <span className="truncate">{item.type === "text" ? (item.text || "Text") : "Logo"}</span>
                    </span>
                    <div className="flex items-center gap-1">
                      {item.type === "text" && (
                        <button type="button" onClick={(e) => { e.stopPropagation(); openTextEditor(item.id); }} className="rounded p-0.5 text-zinc-500 hover:bg-white/10 hover:text-zinc-200" title="Edit text">
                          <Type className="h-3 w-3" />
                        </button>
                      )}
                      <button type="button" onClick={(e) => { e.stopPropagation(); removeOverlay(item.id); }} className="rounded p-0.5 text-zinc-500 hover:bg-white/10 hover:text-red-400" title="Remove">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Artboard Canvas */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden">
          <div
            ref={artboardCanvasRef}
            onPointerDown={handleArtboardMouseDown}
            onWheel={handleArtboardWheel}
            className="relative w-full max-w-[610px] shrink-0 cursor-grab shadow-[0_8px_40px_rgba(0,0,0,0.45)] select-none active:cursor-grabbing"
            style={{
              transform: `translate(${artboardPos.x}px, ${artboardPos.y}px) scale(${artboardZoom})`,
              transformOrigin: "center center",
              isolation: "isolate",
              overflow: "hidden",
              backgroundColor: artboardBgColor || "#ffffff",
              height: layers.length === 0 ? "600px" : "auto",
            }}
          >
            {isLoadingProduct && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80" style={{ zIndex: 100 }}>
                <span className="text-sm text-zinc-400">Loading layers…</span>
              </div>
            )}

            {/* Sizer image — keeps container height, hidden */}
            {layers[0] && (
              <img
                src={layers[0].url}
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

            {/* All layers absolutely stacked — first layer = highest z (matches admin) */}
            {layers.map((layer, idx) => (
              <img
                key={`${layer.label}-${idx}`}
                src={layer.url}
                alt={layer.label}
                className="w-full"
                style={{
                  display: "block",
                  mixBlendMode: layer.blendMode as React.CSSProperties["mixBlendMode"],
                  position: "absolute",
                  zIndex: 300 + (layers.length - idx),
                  top: 0,
                  left: 0,
                  height: "100%",
                  objectFit: "cover",
                  pointerEvents: "none",
                  userSelect: "none",
                }}
              />
            ))}

            {designAreaImages.flatMap((area, areaIdx) => {
              const areaDesigns = getDesignsForArea(area.url);
              const artW = artboardPixelSize?.w ?? artboardCanvasRef.current?.offsetWidth ?? 610;
              const artH = artboardPixelSize?.h ?? artboardCanvasRef.current?.offsetHeight ?? artW;
              const bottomLayout = getBottomLayerLayout(area, artW, artH);
              const corners = area.perspectiveCorners ?? DEFAULT_CORNERS;
              const hasPerspective = !isDefaultCorners(corners);
              return areaDesigns.map((design, designIdx) => {
                const transform = getDesignTransform(design.id);
                const baseSize = getDesignBaseSize(design.id);
                const localOffset = bottomLayout
                  ? artboardToBottomLocal(transform.x, transform.y, bottomLayout)
                  : null;
                const innerContent = (
                  <>
                    <img
                      src={design.src}
                      alt={area.label}
                      onLoad={(e) => {
                        syncDesignNaturalSize(
                          design.id,
                          e.currentTarget.naturalWidth,
                          e.currentTarget.naturalHeight,
                        );
                      }}
                      onPointerDown={(e) => handleDesignPreviewMouseDown(e, area.url, design.id)}
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        width: baseSize.w,
                        height: baseSize.h,
                        objectFit: "contain",
                        pointerEvents: "auto",
                        cursor: selectedDesignId === design.id ? "move" : "pointer",
                        userSelect: "none",
                        transform: `translate(-50%, -50%) translate(${localOffset?.x ?? transform.x}px, ${localOffset?.y ?? transform.y}px) scale(${transform.scale}) rotate(${transform.rotation}deg)`,
                        transformOrigin: "center center",
                      }}
                    />
                    {designWrapperStrength > 0 ? (
                      <img
                        src={design.src}
                        alt=""
                        aria-hidden="true"
                        style={{
                          position: "absolute",
                          top: "50%",
                          left: "50%",
                          width: baseSize.w,
                          height: baseSize.h,
                          objectFit: "contain",
                          pointerEvents: "none",
                          userSelect: "none",
                          mixBlendMode: "multiply",
                          opacity: designWrapperStrength,
                          transform: `translate(-50%, -50%) translate(${localOffset?.x ?? transform.x}px, ${localOffset?.y ?? transform.y}px) scale(${transform.scale}) rotate(${transform.rotation}deg)`,
                          transformOrigin: "center center",
                        }}
                      />
                    ) : null}
                  </>
                );
                return (
                  <div
                    key={`design-preview-${area.id}-${design.id}`}
                    style={{
                      position: "absolute",
                      inset: 0,
                      zIndex: 100 + designIdx,
                      overflow: "hidden",
                      pointerEvents: "none",
                      WebkitMaskImage: `url(${area.url})`,
                      WebkitMaskSize: "cover",
                      WebkitMaskRepeat: "no-repeat",
                      WebkitMaskPosition: "center",
                      maskImage: `url(${area.url})`,
                      maskSize: "cover",
                      maskRepeat: "no-repeat",
                      maskPosition: "center",
                    }}
                  >
                    {bottomLayout ? (
                      <div
                        style={{
                          position: "absolute",
                          top: "50%",
                          left: "50%",
                          width: bottomLayout.boxW,
                          height: bottomLayout.boxH,
                          transform: `translate(-50%, -50%) translate(${bottomLayout.x}px, ${bottomLayout.y}px) rotate(${bottomLayout.rotation}deg)`,
                          transformOrigin: "center center",
                          overflow: "hidden",
                          WebkitMaskImage: `url(${bottomLayout.maskUrl})`,
                          WebkitMaskSize: "cover",
                          WebkitMaskRepeat: "no-repeat",
                          WebkitMaskPosition: "center",
                          maskImage: `url(${bottomLayout.maskUrl})`,
                          maskSize: "cover",
                          maskRepeat: "no-repeat",
                          maskPosition: "center",
                        }}
                      >
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            transformOrigin: "0 0",
                            transform: hasPerspective ? computeMatrix3dStyle(corners, bottomLayout.boxW, bottomLayout.boxH) : undefined,
                          }}
                        >
                          {innerContent}
                        </div>
                      </div>
                    ) : (
                      innerContent
                    )}
                  </div>
                );
              });
            })}

            {selectedDesignAreaUrl && selectedDesignId && getSelectedDesign() ? (() => {
              const t = getDesignTransform(selectedDesignId);
              const baseSize = getDesignBaseSize(selectedDesignId);
              const bbW = baseSize.w;
              const bbH = baseSize.h;
              const boxScale = Math.max(t.scale, 0.01);
              const boxW = bbW * boxScale;
              const boxH = bbH * boxScale;
              const selectedArea = designAreaImages.find((area) => area.url === selectedDesignAreaUrl) ?? null;
              const artW = artboardPixelSize?.w ?? artboardCanvasRef.current?.offsetWidth ?? 610;
              const artH = artboardPixelSize?.h ?? artboardCanvasRef.current?.offsetHeight ?? artW;
              const selectedBottomLayout = selectedArea ? getBottomLayerLayout(selectedArea, artW, artH) : null;
              const selectedLocalOffset = selectedBottomLayout
                ? artboardToBottomLocal(t.x, t.y, selectedBottomLayout)
                : null;
              const bottomRad = ((selectedBottomLayout?.rotation ?? 0) * Math.PI) / 180;
              const cosB = Math.cos(bottomRad);
              const sinB = Math.sin(bottomRad);
              const controlOffsetX = selectedBottomLayout && selectedLocalOffset
                ? selectedBottomLayout.x + selectedLocalOffset.x * cosB - selectedLocalOffset.y * sinB
                : t.x;
              const controlOffsetY = selectedBottomLayout && selectedLocalOffset
                ? selectedBottomLayout.y + selectedLocalOffset.x * sinB + selectedLocalOffset.y * cosB
                : t.y;
              const controlRotation = t.rotation + (selectedBottomLayout?.rotation ?? 0);
              const showRotationGuide = rotationGuide?.areaUrl === selectedDesignAreaUrl && rotationGuide.designId === selectedDesignId;
              return (
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    width: boxW,
                    height: boxH,
                    zIndex: 500,
                    transform: `translate(-50%, -50%) translate(${controlOffsetX}px, ${controlOffsetY}px) rotate(${controlRotation}deg)`,
                    transformOrigin: "center center",
                    pointerEvents: "none",
                  }}
                >
                  {showRotationGuide ? (
                    <>
                      <div
                        style={{
                          position: "absolute",
                          top: "50%",
                          left: "50%",
                          width: Math.max(boxW, boxH) + 80,
                          height: 1,
                          background: rotationGuide.snapped ? "rgba(255,107,53,0.95)" : "rgba(255,107,53,0.45)",
                          boxShadow: rotationGuide.snapped ? "0 0 0 1px rgba(255,107,53,0.18), 0 0 16px rgba(255,107,53,0.25)" : "none",
                          transform: `translate(-50%, -50%) rotate(${rotationGuide.angle}deg)`,
                          transformOrigin: "center center",
                          pointerEvents: "none",
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          top: -58,
                          left: "50%",
                          transform: "translateX(-50%)",
                          padding: "4px 8px",
                          borderRadius: 999,
                          background: rotationGuide.snapped ? "rgba(255,107,53,0.16)" : "rgba(17,19,27,0.9)",
                          border: rotationGuide.snapped ? "1px solid rgba(255,107,53,0.8)" : "1px solid rgba(255,255,255,0.12)",
                          color: rotationGuide.snapped ? "#ffb08f" : "#d4d4d8",
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.04em",
                          whiteSpace: "nowrap",
                          pointerEvents: "none",
                        }}
                      >
                        {Math.round(rotationGuide.angle)}°{rotationGuide.snapped ? " snap" : ""}
                      </div>
                    </>
                  ) : null}

                  <div
                    onPointerDown={(e) => handleDesignPreviewMouseDown(e, selectedDesignAreaUrl, selectedDesignId)}
                    style={{
                      position: "absolute",
                      inset: 0,
                      border: "1.5px dashed rgba(255,107,53,0.9)",
                      boxShadow: "0 0 0 1px rgba(255,107,53,0.18)",
                      cursor: "move",
                      pointerEvents: "auto",
                    }}
                  />

                  {([["top", "left"], ["top", "right"], ["bottom", "left"], ["bottom", "right"]] as const).map(([v, h]) => (
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

                  <button
                    type="button"
                    aria-label="Delete design"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={deleteSelectedDesign}
                    style={{
                      position: "absolute",
                      top: -30,
                      right: -30,
                      width: 22,
                      height: 22,
                      borderRadius: 999,
                      background: "#11131B",
                      border: "1.5px solid #FF6B35",
                      color: "#FF6B35",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      pointerEvents: "auto",
                    }}
                  >
                    <Trash2 size={12} strokeWidth={2.2} />
                  </button>

                  <button
                    type="button"
                    aria-label="Rotate design"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      handleDesignRotateMouseDown(e, selectedDesignAreaUrl, selectedDesignId);
                    }}
                    style={{
                      position: "absolute",
                      top: -28,
                      left: "50%",
                      transform: "translateX(-50%)",
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: "#11131B",
                      border: "1.5px solid #FF6B35",
                      cursor: "grab",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      pointerEvents: "auto",
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M5 1.5A3.5 3.5 0 1 1 1.5 5" stroke="#FF6B35" strokeWidth="1.2" strokeLinecap="round" />
                      <polygon points="1.5,2.5 1.5,5 4,3.8" fill="#FF6B35" />
                    </svg>
                  </button>

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

                  <button
                    type="button"
                    aria-label="Scale design"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      handleDesignScaleMouseDown(e, selectedDesignAreaUrl, selectedDesignId);
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
                    aria-label="Scale design"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      handleDesignScaleMouseDown(e, selectedDesignAreaUrl, selectedDesignId);
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

                </div>
              );
            })() : null}



            {colorAreaImages.map((area, idx) => {
              const appliedColor = appliedColorByArea[area.url];
              if (!appliedColor) return null;
              return (
                <div
                  key={`color-preview-${area.id}`}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    height: "100%",
                    width: "100%",
                    backgroundColor: appliedColor,
                    zIndex: 10 + idx,
                    pointerEvents: "none",
                    userSelect: "none",
                    WebkitMaskImage: `url(${area.url})`,
                    WebkitMaskSize: "cover",
                    WebkitMaskRepeat: "no-repeat",
                    WebkitMaskPosition: "center",
                    maskImage: `url(${area.url})`,
                    maskSize: "cover",
                    maskRepeat: "no-repeat",
                    maskPosition: "center",
                  }}
                />
              );
            })}

            {/* Overlay items (text & logo) */}
            {overlayItems.map((item) => (
              <div
                key={`overlay-${item.id}`}
                onPointerDown={(e) => handleOverlayMouseDown(e, item.id)}
                onDoubleClick={() => item.type === "text" ? openTextEditor(item.id) : undefined}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: `translate(-50%, -50%) translate(${item.x}px, ${item.y}px) rotate(${item.rotation}deg) scale(${item.scale})`,
                  zIndex: 500,
                  cursor: "move",
                  userSelect: "none",
                  pointerEvents: "auto",
                }}
              >
                {item.type === "text" ? (
                  <span
                    style={{
                      fontSize: item.fontSize || 24,
                      color: item.fontColor || "#FFFFFF",
                      fontWeight: 600,
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.3,
                      display: "block",
                      padding: "2px 6px",
                      textAlign: item.textAlign || "center",
                    }}
                  >
                    {item.text || "Text"}
                  </span>
                ) : item.src ? (
                  <img
                    src={item.src}
                    alt="Logo"
                    draggable={false}
                    style={{ maxWidth: 150, maxHeight: 150, display: "block", pointerEvents: "none" }}
                  />
                ) : null}

                {/* Bounding box & controls — same style as design areas */}
                {selectedOverlayId === item.id && (
                  <>
                    {/* Dashed border */}
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        border: "1.5px dashed rgba(255,107,53,0.9)",
                        boxShadow: "0 0 0 1px rgba(255,107,53,0.18)",
                        pointerEvents: "none",
                      }}
                    />

                    {/* Corner dots */}
                    {([["top", "left"], ["top", "right"], ["bottom", "left"], ["bottom", "right"]] as const).map(([v, h]) => (
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

                    {/* Delete button */}
                    <button
                      type="button"
                      aria-label="Delete overlay"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => removeOverlay(item.id)}
                      style={{
                        position: "absolute",
                        top: -30,
                        right: -30,
                        width: 22,
                        height: 22,
                        borderRadius: 999,
                        background: "#11131B",
                        border: "1.5px solid #FF6B35",
                        color: "#FF6B35",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        pointerEvents: "auto",
                      }}
                    >
                      <Trash2 size={12} strokeWidth={2.2} />
                    </button>

                    {/* Rotate handle */}
                    <button
                      type="button"
                      aria-label="Rotate overlay"
                      onPointerDown={(e) => { e.stopPropagation(); handleOverlayRotateMouseDown(e, item.id); }}
                      style={{
                        position: "absolute",
                        top: -28,
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: "#11131B",
                        border: "1.5px solid #FF6B35",
                        cursor: "grab",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        pointerEvents: "auto",
                      }}
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M5 1.5A3.5 3.5 0 1 1 1.5 5" stroke="#FF6B35" strokeWidth="1.2" strokeLinecap="round" />
                        <polygon points="1.5,2.5 1.5,5 4,3.8" fill="#FF6B35" />
                      </svg>
                    </button>

                    {/* Connector line to rotate handle */}
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

                    {/* Scale handle bottom-right */}
                    <button
                      type="button"
                      aria-label="Scale overlay"
                      onPointerDown={(e) => { e.stopPropagation(); handleOverlayScaleMouseDown(e, item.id); }}
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

                    {/* Scale handle bottom-left */}
                    <button
                      type="button"
                      aria-label="Scale overlay"
                      onPointerDown={(e) => { e.stopPropagation(); handleOverlayScaleMouseDown(e, item.id); }}
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
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel */}
        <section
          className={`overflow-y-auto border border-white/8 bg-[#16161F] p-4 lg:relative lg:z-0 lg:block lg:max-h-[calc(100vh-140px)] lg:w-[280px] lg:shrink-0 lg:rounded-xl lg:shadow-[0_12px_30px_rgba(0,0,0,0.18)] ${
            mobilePanel === "right"
              ? "fixed bottom-14 left-0 right-0 z-[55] max-h-[80vh] rounded-t-2xl shadow-[0_-8px_40px_rgba(0,0,0,0.55)]"
              : "hidden"
          }`}
        >
          <div className="mb-3 flex items-center justify-center lg:hidden">
            <div className="h-1 w-10 rounded-full bg-white/20" />
          </div>
          <div className="mb-3 rounded-lg border border-white/10 bg-black/25 p-2.5">
            <label htmlFor="right-panel-search" className="mb-2 block text-xs font-semibold tracking-wide text-zinc-400">
              Search Mockups
            </label>
            <div className="flex items-center gap-2 rounded-md border border-white/12 bg-[#0f1017] px-2.5 py-2">
              <Search className="h-4 w-4 text-zinc-500" />
              <input
                id="right-panel-search"
                type="text"
                value={rightPanelSearch}
                onChange={(event) => setRightPanelSearch(event.target.value)}
                placeholder="Search by title or category"
                className="h-5 w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
            {isRightPanelLoading ? (
              <p className="rounded-md border border-white/8 bg-black/20 px-3 py-2 text-xs text-zinc-400">Loading mockups...</p>
            ) : filteredRightPanelMockups.length === 0 ? (
              <p className="rounded-md border border-white/8 bg-black/20 px-3 py-2 text-xs text-zinc-400">No mockups found.</p>
            ) : (
              filteredRightPanelMockups.map((mockup) => {
                const categoryLabel = [mockup.mainCategory, mockup.category]
                  .filter(Boolean)
                  .join(" / ");

                return (
                  <button
                    key={mockup.id}
                    type="button"
                    onClick={() => navigate(`/editor/${mockup.id}`)}
                    className={`w-full overflow-hidden rounded-lg border text-left transition-colors ${
                      id === mockup.id
                        ? "border-primary/70 bg-primary/10"
                        : "border-white/10 bg-black/25 hover:border-primary/40 hover:bg-black/35"
                    }`}
                  >
                    <img src={mockup.image} alt={mockup.title} className="aspect-square w-full object-cover" />
                    <div className="p-2.5">
                      <p className="line-clamp-1 text-sm font-semibold text-zinc-100">{mockup.title}</p>
                      <p className="mt-1 line-clamp-1 text-[11px] text-zinc-400">{categoryLabel}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>
      </div>

      {isDeleteAllModalOpen ? (
        <div
          className="fixed inset-0 z-[75] flex items-center justify-center bg-black/65 p-4"
          onClick={() => setIsDeleteAllModalOpen(false)}
        >
          <div
            className="w-full max-w-[420px] rounded-2xl border border-white/12 bg-[radial-gradient(circle_at_top,rgba(255,107,53,0.15),transparent_42%),linear-gradient(180deg,#141520_0%,#10111A_100%)] p-5 shadow-[0_30px_70px_rgba(0,0,0,0.5)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/80">Confirm Action</p>
            <h3 className="mt-2 text-xl font-semibold text-zinc-100">Delete all uploaded designs?</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              This will permanently remove designs from all design areas in this workspace.
            </p>

            <div className="mt-5 rounded-xl border border-red-500/25 bg-red-500/8 px-3 py-2.5 text-xs text-red-200">
              This action cannot be undone.
            </div>

            <div className="mt-6 flex gap-2.5">
              <button
                type="button"
                onClick={() => setIsDeleteAllModalOpen(false)}
                className="flex-1 rounded-lg border border-white/14 bg-white/[0.03] px-3 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.08]"
              >
                Keep designs
              </button>
              <button
                type="button"
                onClick={confirmDeleteAllDesigns}
                className="flex-1 rounded-lg border border-red-500/40 bg-red-500/14 px-3 py-2.5 text-sm font-semibold text-red-200 transition hover:bg-red-500/24"
              >
                Delete all
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {colorPickerTargetUrl ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={() => setColorPickerTargetUrl(null)}>
          <div
            className="w-full max-w-[360px] rounded-xl border border-white/12 bg-[#11111A] p-3 shadow-[0_22px_50px_rgba(0,0,0,0.55)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Color Palette</p>
            <p className="mb-3 text-sm font-semibold text-zinc-100">
              {colorPickerTargetUrl === BACKGROUND_PICKER_KEY
                ? "Artboard Background"
                : colorAreaImages.find((item) => item.url === colorPickerTargetUrl)?.label || "Selected Color Area"}
            </p>

            <div className="space-y-2">
              <div
                ref={saturationRef}
                onPointerDown={handlePalettePointerDown}
                className="relative h-44 w-full cursor-crosshair rounded-md"
                style={{ backgroundColor: `hsl(${pendingHsv.h}, 100%, 50%)` }}
              >
                <div className="absolute inset-0 rounded-md bg-gradient-to-r from-white to-transparent" />
                <div className="absolute inset-0 rounded-md bg-gradient-to-t from-black to-transparent" />
                <div
                  className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white shadow-[0_0_0_1px_rgba(0,0,0,0.7)]"
                  style={{
                    left: `${pendingHsv.s}%`,
                    top: `${100 - pendingHsv.v}%`,
                    backgroundColor: pendingColor,
                  }}
                />
              </div>

              <input
                type="range"
                min={0}
                max={360}
                value={pendingHsv.h}
                onChange={(e) => setPendingHsv((prev) => ({ ...prev, h: Number(e.target.value) }))}
                className="h-2 w-full cursor-pointer appearance-none rounded-sm bg-[linear-gradient(to_right,#ff0000,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000)]"
              />

              <div className="flex items-center gap-2">
                <div
                  className="h-8 w-8 rounded-sm border border-white/20"
                  style={{ backgroundColor: pendingColor }}
                />
                <input
                  type="text"
                  value={hexInputValue}
                  onChange={(e) => {
                    const value = e.target.value.trim();
                    setHexInputValue(value.toUpperCase());
                    if (/^#?[0-9a-fA-F]{6}$/.test(value)) {
                      const hex = value.startsWith("#") ? value : `#${value}`;
                      setPendingHsv(hexToHsv(hex));
                    }
                  }}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData("text").trim();
                    if (!pasted) return;
                    const clean = pasted.replace(/\s+/g, "");
                    if (/^#?[0-9a-fA-F]{6}$/.test(clean)) {
                      e.preventDefault();
                      const hex = clean.startsWith("#") ? clean : `#${clean}`;
                      setHexInputValue(hex.toUpperCase());
                      setPendingHsv(hexToHsv(hex));
                    }
                  }}
                  className="h-8 w-full rounded-sm border border-white/20 bg-[#0E0E14] px-2 text-xs text-zinc-100 outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-6 gap-1">
                {["#FF6B35", "#F97316", "#EAB308", "#22C55E", "#3B82F6", "#A855F7", "#EF4444", "#14B8A6", "#06B6D4", "#84CC16", "#64748B", "#FFFFFF"].map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    onClick={() => setPendingHsv(hexToHsv(swatch))}
                    className="h-5 w-full rounded-sm border border-white/15"
                    style={{ backgroundColor: swatch }}
                    aria-label={`Pick ${swatch}`}
                  />
                ))}
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setColorPickerTargetUrl(null)}
                className="flex-1 rounded-sm border border-white/20 px-2 py-1.5 text-[11px] text-zinc-300 transition hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applySelectedColor}
                className="flex-1 rounded-sm bg-primary px-2 py-1.5 text-[11px] font-semibold text-primary-foreground transition hover:bg-primary/90"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editingTextOverlayId ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" onClick={() => setEditingTextOverlayId(null)}>
          <div
            className="w-full max-w-[380px] rounded-2xl border border-white/10 bg-[#11111A] p-5 shadow-[0_22px_50px_rgba(0,0,0,0.6)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/80">Text Overlay</p>
            <p className="mb-4 text-sm font-semibold text-zinc-100">Edit Text</p>

            <div className="space-y-4">
              {/* Text Input */}
              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-zinc-400">Text Content</label>
                <textarea
                  value={pendingOverlayText}
                  onChange={(e) => setPendingOverlayText(e.target.value)}
                  placeholder="Enter your text..."
                  rows={3}
                  className="w-full resize-y rounded-lg border border-white/15 bg-[#0E0E14] px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-primary/70 focus:ring-1 focus:ring-primary/30"
                  autoFocus
                />
              </div>

              {/* Alignment */}
              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-zinc-400">Alignment</label>
                <div className="flex gap-1">
                  {([["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]] as const).map(([val, Icon]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setPendingOverlayTextAlign(val)}
                      className={`flex h-9 w-10 items-center justify-center rounded-lg border transition ${pendingOverlayTextAlign === val ? "border-primary bg-primary/15 text-primary" : "border-white/12 text-zinc-400 hover:bg-white/5 hover:text-zinc-200"}`}
                    >
                      <Icon size={16} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Row */}
              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-zinc-400">Color</label>
                <div className="relative flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTextColorPicker((p) => !p)}
                    className="h-10 w-10 shrink-0 rounded-lg border border-white/15 transition hover:border-primary/50"
                    style={{ backgroundColor: pendingOverlayFontColor }}
                    title="Open color picker"
                  />
                  <span className="text-xs font-mono text-zinc-300">{pendingOverlayFontColor.toUpperCase()}</span>
                  {/* Color Picker Popup - centered on screen */}
                  {showTextColorPicker && (
                    <>
                    <div className="fixed inset-0 z-[89]" onClick={() => setShowTextColorPicker(false)} />
                    <div
                      className="fixed left-1/2 top-1/2 z-[90] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#13131D] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.04)]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Saturation / Brightness pad */}
                      <div
                        ref={textSaturationRef}
                        onPointerDown={(e) => {
                          const update = (cx: number, cy: number) => {
                            const rect = textSaturationRef.current?.getBoundingClientRect();
                            if (!rect) return;
                            const x = clamp(cx - rect.left, 0, rect.width);
                            const y = clamp(cy - rect.top, 0, rect.height);
                            const s = Math.round((x / rect.width) * 100);
                            const v = Math.round((1 - y / rect.height) * 100);
                            const next = { ...textColorHsv, s, v };
                            setTextColorHsv(next);
                            setPendingOverlayFontColor(hsvToHex(next.h, next.s, next.v));
                          };
                          update(e.clientX, e.clientY);
                          const move = (ev: PointerEvent) => update(ev.clientX, ev.clientY);
                          const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
                          window.addEventListener("pointermove", move);
                          window.addEventListener("pointerup", up);
                        }}
                        className="relative h-40 w-full cursor-crosshair rounded-xl overflow-hidden"
                        style={{ backgroundColor: `hsl(${textColorHsv.h}, 100%, 50%)` }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
                        <div
                          className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-white shadow-[0_0_0_1.5px_rgba(0,0,0,0.5),0_2px_8px_rgba(0,0,0,0.4)]"
                          style={{
                            left: `${textColorHsv.s}%`,
                            top: `${100 - textColorHsv.v}%`,
                            backgroundColor: pendingOverlayFontColor,
                          }}
                        />
                      </div>

                      {/* Hue slider */}
                      <div className="mt-3 px-0.5">
                        <input
                          type="range"
                          min={0}
                          max={360}
                          value={textColorHsv.h}
                          onChange={(e) => {
                            const h = Number(e.target.value);
                            const next = { ...textColorHsv, h };
                            setTextColorHsv(next);
                            setPendingOverlayFontColor(hsvToHex(next.h, next.s, next.v));
                          }}
                          className="h-3 w-full cursor-pointer appearance-none rounded-full bg-[linear-gradient(to_right,#ff0000,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000)]"
                        />
                      </div>

                      {/* Swatches */}
                      <div className="mt-3 grid grid-cols-10 gap-1.5">
                        {["#FFFFFF", "#C0C0C0", "#808080", "#000000", "#FF0000", "#FF6B35", "#F97316", "#EAB308", "#84CC16", "#22C55E", "#14B8A6", "#06B6D4", "#3B82F6", "#6366F1", "#A855F7", "#EC4899", "#EF4444", "#D4D4D8", "#78716C", "#64748B"].map((swatch) => (
                          <button
                            key={swatch}
                            type="button"
                            onClick={() => { setTextColorHsv(hexToHsv(swatch)); setPendingOverlayFontColor(swatch); }}
                            className={`aspect-square w-full rounded-md border-[1.5px] transition-all hover:scale-110 hover:shadow-[0_0_8px_rgba(255,255,255,0.15)] ${pendingOverlayFontColor.toUpperCase() === swatch ? "border-primary ring-1 ring-primary/40" : "border-white/10"}`}
                            style={{ backgroundColor: swatch }}
                            aria-label={`Pick ${swatch}`}
                          />
                        ))}
                      </div>

                      {/* Hex input + preview + OK */}
                      <div className="mt-3 flex items-center gap-2">
                        <div
                          className="h-9 w-9 shrink-0 rounded-lg border border-white/12"
                          style={{ backgroundColor: pendingOverlayFontColor }}
                        />
                        <div className="relative flex-1">
                          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-mono text-zinc-500">#</span>
                          <input
                            type="text"
                            value={pendingOverlayFontColor.toUpperCase().replace("#", "")}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
                              const hex = `#${raw}`;
                              setPendingOverlayFontColor(hex);
                              if (/^#[0-9a-fA-F]{6}$/.test(hex)) setTextColorHsv(hexToHsv(hex));
                            }}
                            className="h-9 w-full rounded-lg border border-white/12 bg-[#0a0a12] pl-7 pr-2.5 text-xs font-mono text-zinc-100 outline-none transition focus:border-primary/60 focus:ring-1 focus:ring-primary/25"
                            maxLength={6}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowTextColorPicker(false)}
                          className="h-9 shrink-0 rounded-lg bg-primary px-4 text-xs font-semibold text-white transition hover:bg-primary/80"
                        >
                          OK
                        </button>
                      </div>
                    </div>
                    </>
                  )}
                </div>
              </div>
              <div
                className="overflow-hidden rounded-lg border border-white/8 bg-[#0a0a12] p-4"
                style={{ fontSize: Math.min(pendingOverlayFontSize, 48), color: pendingOverlayFontColor, fontWeight: 600, whiteSpace: "pre-wrap", lineHeight: 1.3, textAlign: pendingOverlayTextAlign }}
              >
                {pendingOverlayText || "Preview"}
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setEditingTextOverlayId(null)} className="flex-1 rounded-lg border border-white/15 px-3 py-2 text-xs text-zinc-300 transition hover:bg-white/5">
                Cancel
              </button>
              <button type="button" onClick={applyTextEdit} className="flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90">
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Mobile bottom panel backdrop */}
      {mobilePanel !== null && (
        <div
          className="fixed inset-0 z-[54] bg-black/50 lg:hidden"
          onClick={() => setMobilePanel(null)}
        />
      )}

      {/* Mobile Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-[60] flex h-14 items-center justify-around border-t border-white/10 bg-[#16161F] px-4 shadow-[0_-4px_20px_rgba(0,0,0,0.4)] lg:hidden">
        <button
          type="button"
          onClick={() => setMobilePanel(mobilePanel === "left" ? null : "left")}
          className={`flex flex-col items-center gap-1 rounded-lg px-8 py-2 text-[10px] transition ${
            mobilePanel === "left" ? "text-primary" : "text-zinc-400"
          }`}
        >
          <Upload className="h-5 w-5" />
          <span>Upload</span>
        </button>
        <button
          type="button"
          onClick={() => setMobilePanel(mobilePanel === "right" ? null : "right")}
          className={`flex flex-col items-center gap-1 rounded-lg px-8 py-2 text-[10px] transition ${
            mobilePanel === "right" ? "text-primary" : "text-zinc-400"
          }`}
        >
          <Search className="h-5 w-5" />
          <span>Browse</span>
        </button>
      </div>
    </div>
  );
}
