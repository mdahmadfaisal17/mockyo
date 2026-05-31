export type PerspectiveCorners = {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
  bottomRight: { x: number; y: number };
};

export type WrapEdgeKey = "top" | "right" | "bottom" | "left";
export type WrapHandleKey = "start" | "end";
export type WrapBezierHandles = Record<WrapEdgeKey, Record<WrapHandleKey, { x: number; y: number }>>;

export const DEFAULT_CORNERS: PerspectiveCorners = {
  topLeft: { x: 0, y: 0 },
  topRight: { x: 1, y: 0 },
  bottomLeft: { x: 0, y: 1 },
  bottomRight: { x: 1, y: 1 },
};

export const createDefaultWrapHandles = (): WrapBezierHandles => ({
  top: { start: { x: 0.25, y: 0 }, end: { x: 0.75, y: 0 } },
  right: { start: { x: 1, y: 0.25 }, end: { x: 1, y: 0.75 } },
  bottom: { start: { x: 0.75, y: 1 }, end: { x: 0.25, y: 1 } },
  left: { start: { x: 0, y: 0.75 }, end: { x: 0, y: 0.25 } },
});

export function isDefaultCorners(c: PerspectiveCorners): boolean {
  return (
    c.topLeft.x === 0 && c.topLeft.y === 0 &&
    c.topRight.x === 1 && c.topRight.y === 0 &&
    c.bottomLeft.x === 0 && c.bottomLeft.y === 1 &&
    c.bottomRight.x === 1 && c.bottomRight.y === 1
  );
}

export function computeMatrix3dStyle(corners: PerspectiveCorners, w: number, h: number): string {
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
}

function cubicBezierPoint(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  amount: number,
) {
  const inv = 1 - amount;
  const a = inv * inv * inv;
  const b = 3 * inv * inv * amount;
  const c = 3 * inv * amount * amount;
  const d = amount * amount * amount;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

export function drawCanvasBezierMeshWarp(
  dstCtx: CanvasRenderingContext2D,
  srcCanvas: HTMLCanvasElement,
  corners: PerspectiveCorners,
  wrapHandles: WrapBezierHandles,
  canvasW: number,
  canvasH: number,
  subdivisions = 32,
) {
  const toCanvasPoint = (point: { x: number; y: number }) => ({
    x: point.x * canvasW,
    y: point.y * canvasH,
  });
  const cornerPoints = {
    topLeft: toCanvasPoint(corners.topLeft),
    topRight: toCanvasPoint(corners.topRight),
    bottomLeft: toCanvasPoint(corners.bottomLeft),
    bottomRight: toCanvasPoint(corners.bottomRight),
  };
  const edgePoint = (edgeKey: WrapEdgeKey, amount: number) => {
    if (edgeKey === "top") {
      return cubicBezierPoint(cornerPoints.topLeft, toCanvasPoint(wrapHandles.top.start), toCanvasPoint(wrapHandles.top.end), cornerPoints.topRight, amount);
    }
    if (edgeKey === "right") {
      return cubicBezierPoint(cornerPoints.topRight, toCanvasPoint(wrapHandles.right.start), toCanvasPoint(wrapHandles.right.end), cornerPoints.bottomRight, amount);
    }
    if (edgeKey === "bottom") {
      return cubicBezierPoint(cornerPoints.bottomRight, toCanvasPoint(wrapHandles.bottom.start), toCanvasPoint(wrapHandles.bottom.end), cornerPoints.bottomLeft, amount);
    }
    return cubicBezierPoint(cornerPoints.bottomLeft, toCanvasPoint(wrapHandles.left.start), toCanvasPoint(wrapHandles.left.end), cornerPoints.topLeft, amount);
  };
  const meshPoint = (u: number, v: number) => {
    const top = edgePoint("top", u);
    const bottom = edgePoint("bottom", 1 - u);
    const left = edgePoint("left", 1 - v);
    const right = edgePoint("right", v);
    const bilinear = {
      x:
        (1 - u) * (1 - v) * cornerPoints.topLeft.x +
        u * (1 - v) * cornerPoints.topRight.x +
        (1 - u) * v * cornerPoints.bottomLeft.x +
        u * v * cornerPoints.bottomRight.x,
      y:
        (1 - u) * (1 - v) * cornerPoints.topLeft.y +
        u * (1 - v) * cornerPoints.topRight.y +
        (1 - u) * v * cornerPoints.bottomLeft.y +
        u * v * cornerPoints.bottomRight.y,
    };
    return {
      x: (1 - v) * top.x + v * bottom.x + (1 - u) * left.x + u * right.x - bilinear.x,
      y: (1 - v) * top.y + v * bottom.y + (1 - u) * left.y + u * right.y - bilinear.y,
    };
  };

  dstCtx.imageSmoothingEnabled = true;
  dstCtx.imageSmoothingQuality = "high";

  for (let row = 0; row < subdivisions; row++) {
    for (let col = 0; col < subdivisions; col++) {
      const u0 = col / subdivisions;
      const u1 = (col + 1) / subdivisions;
      const v0 = row / subdivisions;
      const v1 = (row + 1) / subdivisions;
      const sx0 = u0 * canvasW;
      const sx1 = u1 * canvasW;
      const sy0 = v0 * canvasH;
      const sy1 = v1 * canvasH;
      const d00 = meshPoint(u0, v0);
      const d10 = meshPoint(u1, v0);
      const d01 = meshPoint(u0, v1);
      const d11 = meshPoint(u1, v1);

      drawTexturedTriangle(dstCtx, srcCanvas, sx0, sy0, sx1, sy0, sx0, sy1, d00.x, d00.y, d10.x, d10.y, d01.x, d01.y);
      drawTexturedTriangle(dstCtx, srcCanvas, sx1, sy0, sx1, sy1, sx0, sy1, d10.x, d10.y, d11.x, d11.y, d01.x, d01.y);
    }
  }
}

export function drawCanvasWarp(
  dstCtx: CanvasRenderingContext2D,
  srcCanvas: HTMLCanvasElement,
  corners: PerspectiveCorners,
  canvasW: number,
  canvasH: number,
  subdivisions = 20,
) {
  const tl = { x: corners.topLeft.x * canvasW, y: corners.topLeft.y * canvasH };
  const tr = { x: corners.topRight.x * canvasW, y: corners.topRight.y * canvasH };
  const bl = { x: corners.bottomLeft.x * canvasW, y: corners.bottomLeft.y * canvasH };
  const br = { x: corners.bottomRight.x * canvasW, y: corners.bottomRight.y * canvasH };

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const bilinear = (u: number, v: number) => ({
    x: lerp(lerp(tl.x, tr.x, u), lerp(bl.x, br.x, u), v),
    y: lerp(lerp(tl.y, tr.y, u), lerp(bl.y, br.y, u), v),
  });

  for (let row = 0; row < subdivisions; row++) {
    for (let col = 0; col < subdivisions; col++) {
      const u0 = col / subdivisions;
      const u1 = (col + 1) / subdivisions;
      const v0 = row / subdivisions;
      const v1 = (row + 1) / subdivisions;

      const sx0 = u0 * canvasW;
      const sx1 = u1 * canvasW;
      const sy0 = v0 * canvasH;
      const sy1 = v1 * canvasH;

      const d00 = bilinear(u0, v0);
      const d10 = bilinear(u1, v0);
      const d01 = bilinear(u0, v1);
      const d11 = bilinear(u1, v1);

      drawTexturedTriangle(
        dstCtx, srcCanvas,
        sx0, sy0, sx1, sy0, sx0, sy1,
        d00.x, d00.y, d10.x, d10.y, d01.x, d01.y,
      );
      drawTexturedTriangle(
        dstCtx, srcCanvas,
        sx1, sy0, sx1, sy1, sx0, sy1,
        d10.x, d10.y, d11.x, d11.y, d01.x, d01.y,
      );
    }
  }
}

function drawTexturedTriangle(
  ctx: CanvasRenderingContext2D,
  img: HTMLCanvasElement | HTMLImageElement,
  sx0: number, sy0: number,
  sx1: number, sy1: number,
  sx2: number, sy2: number,
  dx0: number, dy0: number,
  dx1: number, dy1: number,
  dx2: number, dy2: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(dx0, dy0);
  ctx.lineTo(dx1, dy1);
  ctx.lineTo(dx2, dy2);
  ctx.closePath();
  ctx.clip();

  const denom = (sx1 - sx0) * (sy2 - sy0) - (sx2 - sx0) * (sy1 - sy0);
  if (Math.abs(denom) < 1e-10) {
    ctx.restore();
    return;
  }

  const a = ((dx1 - dx0) * (sy2 - sy0) - (dx2 - dx0) * (sy1 - sy0)) / denom;
  const b = ((dy1 - dy0) * (sy2 - sy0) - (dy2 - dy0) * (sy1 - sy0)) / denom;
  const c = ((dx2 - dx0) * (sx1 - sx0) - (dx1 - dx0) * (sx2 - sx0)) / denom;
  const d = ((dy2 - dy0) * (sx1 - sx0) - (dy1 - dy0) * (sx2 - sx0)) / denom;
  const e = dx0 - a * sx0 - c * sy0;
  const f = dy0 - b * sx0 - d * sy0;

  ctx.transform(a, b, c, d, e, f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}
