export type PerspectiveCorners = {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
  bottomRight: { x: number; y: number };
};

export const DEFAULT_CORNERS: PerspectiveCorners = {
  topLeft: { x: 0, y: 0 },
  topRight: { x: 1, y: 0 },
  bottomLeft: { x: 0, y: 1 },
  bottomRight: { x: 1, y: 1 },
};

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
