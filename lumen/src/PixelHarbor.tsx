import { useEffect, useRef } from 'react';

export type PixelHarborMode = 'landing' | 'progress' | 'results';

type PixelHarborProps = {
  mode: PixelHarborMode;
  stage?: number;
};

type Point = { x: number; y: number };
type Surface = { width: number; height: number; tall: boolean };

const WIDTH = 480;
const HEIGHT = 270;
const WATERLINE = 154;
const RIGHT_SCENE_SLICE = 120;
const BUOYS = [
  { x: 64, waterY: 244, lampY: 222, scale: 1 },
  { x: 134, waterY: 231, lampY: 211, scale: .92 },
  { x: 220, waterY: 215, lampY: 198, scale: .84 },
  { x: 294, waterY: 198, lampY: 185, scale: .72 },
  { x: 347, waterY: 182, lampY: 171, scale: .64 },
];

const DIGITS: Record<number, string[]> = {
  1: ['010', '110', '010', '010', '111'],
  2: ['110', '001', '010', '100', '111'],
  3: ['110', '001', '010', '001', '110'],
  4: ['101', '101', '111', '001', '001'],
  5: ['111', '100', '110', '001', '110'],
};

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

const random = seededRandom(22081995);
const waterGlints = Array.from({ length: 38 }, () => ({
  x: Math.floor(random() * 365),
  y: WATERLINE + 4 + Math.floor(random() * (HEIGHT - WATERLINE - 7)),
  width: 1 + Math.floor(random() * 4),
  phase: Math.floor(random() * 80),
  warm: random() > .83,
}));

const CLIFF_WATER_EDGE: Point[] = [
  { x: 370, y: 154 },
  { x: 364, y: 170 },
  { x: 354, y: 189 },
  { x: 341, y: 210 },
  { x: 327, y: 230 },
  { x: 311, y: 250 },
  { x: 297, y: 269 },
];

function getSurface(): Surface {
  const aspect = Math.max(.3, window.innerWidth / Math.max(1, window.innerHeight));
  if (aspect >= WIDTH / HEIGHT) {
    return {
      width: Math.min(720, Math.round(HEIGHT * aspect)),
      height: HEIGHT,
      tall: false,
    };
  }

  const width = window.innerWidth <= 620 ? 320 : WIDTH;
  return {
    width,
    height: Math.min(820, Math.round(width / aspect)),
    tall: true,
  };
}

function drawDigit(ctx: CanvasRenderingContext2D, value: number, centerX: number, topY: number, scale: number) {
  const glyph = DIGITS[value];
  const pixel = scale > .78 ? 1 : 1;
  const width = 3 * pixel;
  ctx.fillStyle = '#f4fbff';
  glyph.forEach((row, rowIndex) => {
    [...row].forEach((bit, columnIndex) => {
      if (bit === '1') {
        ctx.fillRect(Math.round(centerX - width / 2) + columnIndex * pixel, Math.round(topY) + rowIndex * pixel, pixel, pixel);
      }
    });
  });
}

function portMotion(index: number, tick: number, reducedMotion: boolean) {
  if (reducedMotion) return { x: 0, y: 0 };
  return {
    x: Math.round(Math.sin((tick + index * 17) / (12 + index * 1.5)) * 1.15),
    y: Math.round(Math.sin((tick + index * 23) / (10 + index)) * .85),
  };
}

function pointOnRoute(progress: number): Point {
  const points = BUOYS.map((buoy) => ({ x: buoy.x, y: buoy.waterY - 5 }));
  const scaled = Math.max(0, Math.min(.9999, progress)) * (points.length - 1);
  const index = Math.floor(scaled);
  const local = scaled - index;
  const start = points[index];
  const end = points[Math.min(points.length - 1, index + 1)];
  return {
    x: Math.round(start.x + (end.x - start.x) * local),
    y: Math.round(start.y + (end.y - start.y) * local),
  };
}

function waterRightEdge(y: number) {
  if (y <= CLIFF_WATER_EDGE[0].y) return CLIFF_WATER_EDGE[0].x;
  for (let index = 0; index < CLIFF_WATER_EDGE.length - 1; index += 1) {
    const start = CLIFF_WATER_EDGE[index];
    const end = CLIFF_WATER_EDGE[index + 1];
    if (y > end.y) continue;
    const progress = (y - start.y) / (end.y - start.y);
    return Math.round(start.x + (end.x - start.x) * progress);
  }
  return CLIFF_WATER_EDGE[CLIFF_WATER_EDGE.length - 1].x;
}

function pointOnCliffEdge(progress: number): Point {
  const scaled = Math.max(0, Math.min(.9999, progress)) * (CLIFF_WATER_EDGE.length - 1);
  const index = Math.floor(scaled);
  const local = scaled - index;
  const start = CLIFF_WATER_EDGE[index];
  const end = CLIFF_WATER_EDGE[Math.min(CLIFF_WATER_EDGE.length - 1, index + 1)];
  return {
    x: Math.round(start.x + (end.x - start.x) * local),
    y: Math.round(start.y + (end.y - start.y) * local),
  };
}

function drawCliffWash(ctx: CanvasRenderingContext2D, tick: number, reducedMotion: boolean) {
  const currentTick = reducedMotion ? 0 : tick;

  // Foam flickers against the exact diagonal coastline instead of stopping in a straight strip.
  for (let sample = 0; sample <= 30; sample += 1) {
    const edge = pointOnCliffEdge(sample / 30);
    const pulse = Math.sin(currentTick * .24 + sample * .82);
    if (pulse < .08) continue;
    const width = pulse > .7 ? 4 : pulse > .38 ? 3 : 2;
    ctx.fillStyle = pulse > .68 ? 'rgba(232, 250, 255, .78)' : 'rgba(155, 225, 255, .52)';
    ctx.fillRect(edge.x - width - 1, edge.y + (sample % 3 === 0 ? 1 : 0), width, 1);
  }

  // Short wavelets strike the rocks, then travel back into the harbor and fade.
  for (let wave = 0; wave < 12; wave += 1) {
    const edge = pointOnCliffEdge((wave + .5) / 12);
    const cycle = ((currentTick + wave * 13) % 58) / 58;
    const retreat = Math.round(cycle * 12);
    const width = Math.max(1, Math.round((4 - cycle * 2) * (1 - wave * .018)));
    const y = edge.y + Math.round(Math.sin(currentTick * .14 + wave) * (cycle > .45 ? 1 : 0));
    const alpha = .58 * (1 - cycle);
    ctx.fillStyle = `rgba(177, 235, 255, ${alpha.toFixed(3)})`;
    ctx.fillRect(edge.x - retreat - width - 2, y, width, 1);
  }
}

function drawWrappedWaterRow(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  y: number,
  right: number,
  shift: number,
) {
  if (shift === 0) return;
  const amount = Math.min(Math.abs(shift), right - 1);
  if (shift > 0) {
    ctx.drawImage(image, 0, y, right - amount, 1, amount, y, right - amount, 1);
    ctx.drawImage(image, right - amount, y, amount, 1, 0, y, amount, 1);
  } else {
    ctx.drawImage(image, amount, y, right - amount, 1, 0, y, right - amount, 1);
    ctx.drawImage(image, 0, y, amount, 1, right - amount, y, amount, 1);
  }
}

function drawWater(ctx: CanvasRenderingContext2D, image: HTMLImageElement, tick: number, reducedMotion: boolean) {
  if (!reducedMotion) {
    for (let y = WATERLINE; y < HEIGHT; y += 1) {
      const depth = (y - WATERLINE) / (HEIGHT - WATERLINE);
      const amplitude = depth * 2.25;
      const shift = Math.round(
        Math.sin(tick * .19 + y * .17) * amplitude
        + Math.sin(tick * .09 + y * .061) * depth * .85,
      );
      drawWrappedWaterRow(ctx, image, y, waterRightEdge(y), shift);
    }
  }

  waterGlints.forEach((glint) => {
    const depth = (glint.y - WATERLINE) / (HEIGHT - WATERLINE);
    const right = waterRightEdge(glint.y);
    const drift = reducedMotion ? 0 : Math.round(
      Math.sin((tick + glint.phase) * .11) * (1 + depth * 3)
      + Math.sin((tick + glint.phase) * .043) * 2,
    );
    const x = Math.max(0, Math.min(right - glint.width, glint.x + drift));
    const flicker = reducedMotion || (tick + glint.phase) % 10 < 6;
    if (!flicker) return;
    ctx.fillStyle = glint.warm ? 'rgba(255, 224, 121, .42)' : 'rgba(141, 221, 255, .24)';
    ctx.fillRect(x, glint.y, glint.width, 1);
  });

  drawCliffWash(ctx, tick, reducedMotion);
}

function drawRoute(ctx: CanvasRenderingContext2D, mode: PixelHarborMode, stage: number, tick: number) {
  // The harbor route is earned one stage at a time. Landing and results never
  // show a route, and stage one has no previous port to connect from yet.
  if (mode !== 'progress') return;
  const activeStage = Math.max(1, Math.min(5, stage || 1));
  const revealedProgress = (activeStage - 1) / (BUOYS.length - 1);
  if (revealedProgress <= 0) return;

  const totalDashes = 64;
  const visibleDashes = Math.floor(totalDashes * revealedProgress);
  for (let index = 0; index <= visibleDashes; index += 1) {
    const progress = index / totalDashes;
    const point = pointOnRoute(progress);
    const closeToPort = BUOYS.some((buoy) => Math.hypot(point.x - buoy.x, point.y - (buoy.waterY - 5)) < 8);
    if (closeToPort) continue;

    const sparkle = (index + Math.floor(tick / 2)) % 9 === 0;

    // A faint one-pixel halo keeps the dashes luminous against both dark and
    // sunlit water while retaining the crisp pixel-art route in the reference.
    ctx.fillStyle = sparkle ? 'rgba(255, 250, 112, .34)' : 'rgba(232, 246, 76, .2)';
    ctx.fillRect(point.x - 1, point.y - 1, sparkle ? 4 : 3, 3);
    ctx.fillStyle = sparkle ? '#fff982' : '#e8f64c';
    ctx.fillRect(point.x, point.y, sparkle ? 3 : 2, 1);
  }
}

function projectScenePoint(point: Point, surface: Surface): Point & { scale: number } {
  if (surface.tall) {
    const scale = surface.width / WIDTH;
    const sceneHeight = Math.round(surface.width * HEIGHT / WIDTH);
    const sceneTop = surface.height - sceneHeight;
    return { x: point.x * scale, y: sceneTop + point.y * scale, scale };
  }

  const leftSourceWidth = WIDTH - RIGHT_SCENE_SLICE;
  const leftDestinationWidth = surface.width - RIGHT_SCENE_SLICE;
  const x = point.x <= leftSourceWidth
    ? point.x * leftDestinationWidth / leftSourceWidth
    : leftDestinationWidth + (point.x - leftSourceWidth);
  return { x, y: point.y, scale: 1 };
}

function clipBeamAroundForeground(ctx: CanvasRenderingContext2D, surface: Surface) {
  const foreground = [
    { x: 296, y: HEIGHT },
    { x: 312, y: 238 },
    { x: 334, y: 207 },
    { x: 356, y: 184 },
    { x: 385, y: 161 },
    { x: 397, y: 156 },
    { x: 399, y: 77 },
    { x: 405, y: 67 },
    { x: 405, y: 43 },
    { x: 414, y: 28 },
    { x: 425, y: 43 },
    { x: 433, y: 67 },
    { x: 435, y: 157 },
    { x: WIDTH, y: 157 },
    { x: WIDTH, y: HEIGHT },
  ].map((point) => projectScenePoint(point, surface));

  ctx.beginPath();
  ctx.rect(0, 0, surface.width, surface.height);
  ctx.moveTo(foreground[0].x, foreground[0].y);
  foreground.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.closePath();
  ctx.clip('evenodd');
}

function drawBeam(ctx: CanvasRenderingContext2D, surface: Surface, tick: number, reducedMotion: boolean) {
  const anchor = projectScenePoint({ x: 416, y: 55 }, surface);
  const cycle = reducedMotion ? 0 : (tick % 216) / 216;
  const angle = cycle * Math.PI * 2 - Math.PI;
  const directionX = Math.cos(angle);
  const directionY = Math.sin(angle);
  const normalX = -directionY;
  const normalY = directionX;
  const length = Math.hypot(surface.width, surface.height) * .84;
  const nearHalfWidth = Math.max(1.5, 2 * anchor.scale);
  // The approved beam is a broad pool of light rather than a narrow ray.
  // Keeping this as an angular measurement preserves its proportions through
  // the complete rotation and across every responsive canvas size.
  const farHalfWidth = length * Math.tan(.145);
  const farX = anchor.x + directionX * length;
  const farY = anchor.y + directionY * length;

  ctx.save();
  clipBeamAroundForeground(ctx, surface);
  ctx.globalCompositeOperation = 'source-over';

  // One uninterrupted field of warm light prevents the stacked horizontal
  // bands that made the earlier treatment read as a streak.
  const beamGradient = ctx.createLinearGradient(anchor.x, anchor.y, farX, farY);
  beamGradient.addColorStop(0, 'rgba(255, 247, 171, .66)');
  beamGradient.addColorStop(.2, 'rgba(255, 231, 100, .52)');
  beamGradient.addColorStop(.68, 'rgba(255, 218, 62, .38)');
  beamGradient.addColorStop(1, 'rgba(255, 207, 38, .28)');
  ctx.fillStyle = beamGradient;
  ctx.beginPath();
  ctx.moveTo(Math.round(anchor.x + normalX * nearHalfWidth), Math.round(anchor.y + normalY * nearHalfWidth));
  ctx.lineTo(Math.round(farX + normalX * farHalfWidth), Math.round(farY + normalY * farHalfWidth));
  ctx.lineTo(Math.round(farX - normalX * farHalfWidth), Math.round(farY - normalY * farHalfWidth));
  ctx.lineTo(Math.round(anchor.x - normalX * nearHalfWidth), Math.round(anchor.y - normalY * nearHalfWidth));
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  drawPixelGlow(ctx, anchor.x, anchor.y, 4 * anchor.scale, 'rgba(255, 225, 69, .2)');
  const lensX = anchor.x + Math.round(directionX * 2 * anchor.scale);
  const lensY = anchor.y + Math.round(directionY * 2 * anchor.scale);
  ctx.fillStyle = '#fffbd0';
  ctx.fillRect(
    Math.round(lensX - anchor.scale),
    Math.round(lensY - anchor.scale),
    Math.max(2, Math.round(3 * anchor.scale)),
    Math.max(2, Math.round(3 * anchor.scale)),
  );
  ctx.fillStyle = 'rgba(255, 230, 92, .38)';
  ctx.fillRect(
    Math.round(anchor.x - 3 * anchor.scale),
    Math.round(anchor.y - 3 * anchor.scale),
    Math.max(3, Math.round(7 * anchor.scale)),
    Math.max(3, Math.round(7 * anchor.scale)),
  );
}

function drawBird(ctx: CanvasRenderingContext2D, x: number, y: number, flap: boolean, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y + (flap ? 1 : 0), 2, 1);
  ctx.fillRect(x + 2, y + 1, 2, 1);
  ctx.fillRect(x + 4, y + (flap ? 1 : 0), 2, 1);
  if (!flap) {
    ctx.fillRect(x + 1, y - 1, 1, 1);
    ctx.fillRect(x + 4, y - 1, 1, 1);
  }
}

function drawBirds(ctx: CanvasRenderingContext2D, tick: number, reducedMotion: boolean) {
  const currentTick = reducedMotion ? 0 : tick;
  const flight = (offset: number, speed: number, width: number) => (offset + currentTick * speed) % width;
  drawBird(ctx, Math.round(246 + flight(0, .7, 124)), 32, currentTick % 8 < 4, '#f7fbff');
  drawBird(ctx, Math.round(278 + flight(48, .45, 110)), 47, currentTick % 10 < 5, '#d9f3ff');
  drawBird(ctx, Math.round(315 + flight(79, .32, 88)), 24, currentTick % 12 < 6, '#f7fbff');
}

function drawPixelRipple(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  color: string,
  continuous = false,
) {
  ctx.fillStyle = color;
  const samples = Math.max(18, Math.round(radiusX * 4));
  for (let sample = 0; sample < samples; sample += 1) {
    if (!continuous && sample % 3 === 1) continue;
    const angle = (sample / samples) * Math.PI * 2;
    ctx.fillRect(
      Math.round(centerX + Math.cos(angle) * radiusX),
      Math.round(centerY + Math.sin(angle) * radiusY),
      1,
      1,
    );
  }
}

function drawPortRipples(
  ctx: CanvasRenderingContext2D,
  index: number,
  x: number,
  waterY: number,
  scale: number,
  tick: number,
  active: boolean,
  reducedMotion: boolean,
) {
  const currentTick = reducedMotion ? index * 9 : tick;

  if (active) {
    const breathe = reducedMotion ? 0 : Math.sin((tick + index * 9) / 9) * 1.1;
    [
      { x: 8, y: 2.1, alpha: .9 },
      { x: 14, y: 3.7, alpha: .68 },
      { x: 20, y: 5.3, alpha: .46 },
    ].forEach((ring) => {
      drawPixelRipple(
        ctx,
        x,
        waterY + 1,
        Math.max(4, (ring.x + breathe) * scale),
        Math.max(1.5, (ring.y + breathe * .22) * scale),
        `rgba(246, 255, 72, ${ring.alpha})`,
        true,
      );
    });
    return;
  }

  [0, .5].forEach((offset) => {
    const cycle = ((currentTick + index * 11) % 54) / 54;
    const progress = (cycle + offset) % 1;
    const radiusX = (5 + progress * 13) * scale;
    const radiusY = (1.3 + progress * 3.2) * scale;
    const alpha = (active ? .82 : .46) * (1 - progress);
    drawPixelRipple(ctx, x, waterY + 1, radiusX, radiusY, `rgba(177, 239, 255, ${alpha.toFixed(3)})`);
  });
}

function centeredRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  ctx.fillRect(Math.round(x - width / 2), Math.round(y), Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
}

function drawPixelGlow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
  const roundedRadius = Math.max(1, Math.round(radius));
  ctx.fillStyle = color;
  for (let offsetY = -roundedRadius; offsetY <= roundedRadius; offsetY += 1) {
    for (let offsetX = -roundedRadius; offsetX <= roundedRadius; offsetX += 1) {
      if (offsetX * offsetX + offsetY * offsetY > roundedRadius * roundedRadius) continue;
      ctx.fillRect(Math.round(x + offsetX), Math.round(y + offsetY), 1, 1);
    }
  }
}

function drawCheck(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.fillStyle = '#dfff39';
  ctx.fillRect(x - size, y - size, size * 2 + 1, size * 2 + 1);
  ctx.fillStyle = '#173618';
  ctx.fillRect(x - 2, y, 2, 1);
  ctx.fillRect(x, y + 1, 2, 1);
  ctx.fillRect(x + 2, y - 1, 1, 2);
}

function drawPort(
  ctx: CanvasRenderingContext2D,
  portImage: HTMLImageElement,
  index: number,
  mode: PixelHarborMode,
  stage: number,
  tick: number,
  reducedMotion: boolean,
) {
  const buoy = BUOYS[index];
  const motion = portMotion(index, tick, reducedMotion);
  const x = buoy.x + motion.x;
  const waterY = buoy.waterY + motion.y;
  const lampY = buoy.lampY + motion.y;
  const number = index + 1;
  const activeStage = Math.max(1, Math.min(5, stage || 1));
  const active = mode === 'progress' && number === activeStage;
  const complete = mode === 'progress' && number < activeStage;

  drawPortRipples(ctx, index, x, waterY, buoy.scale, tick, active, reducedMotion);

  const reflectionPhase = reducedMotion ? 0 : Math.round(Math.sin((tick + index * 7) / 7));
  ctx.fillStyle = 'rgba(115, 198, 220, .28)';
  centeredRect(ctx, x + reflectionPhase, waterY + 4, 7 * buoy.scale, 1);
  centeredRect(ctx, x - reflectionPhase, waterY + 7, 4 * buoy.scale, 1);
  ctx.fillStyle = 'rgba(245, 224, 135, .28)';
  centeredRect(ctx, x, waterY + 10, 2 * buoy.scale, 2);

  if (active) {
    drawPixelGlow(ctx, x, lampY, 8 * buoy.scale, 'rgba(232, 255, 57, .13)');
    drawPixelGlow(ctx, x, lampY, 5 * buoy.scale, 'rgba(238, 255, 71, .23)');
    drawPixelGlow(ctx, x, lampY, 3 * buoy.scale, 'rgba(249, 255, 121, .38)');
  }

  const spriteHeight = Math.max(24, Math.round(39 * buoy.scale));
  const spriteWidth = Math.max(15, Math.round(spriteHeight * portImage.naturalWidth / portImage.naturalHeight));
  const spriteTop = Math.round(lampY - spriteHeight * .18);
  ctx.drawImage(portImage, Math.round(x - spriteWidth / 2), spriteTop, spriteWidth, spriteHeight);

  const numberTop = spriteTop + Math.round(spriteHeight * .5);
  drawDigit(ctx, number, x, numberTop, buoy.scale);

  if (active) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = '#f3ff48';
    centeredRect(ctx, x, lampY - 2, buoy.scale > .75 ? 5 : 4, buoy.scale > .75 ? 5 : 4);
    ctx.fillStyle = '#ffffd0';
    centeredRect(ctx, x, lampY - 1, buoy.scale > .75 ? 3 : 2, buoy.scale > .75 ? 3 : 2);
    ctx.restore();
  } else if (complete) {
    drawCheck(ctx, Math.round(x), Math.round(lampY), buoy.scale > .75 ? 3 : 2);
  }
}

function drawPorts(
  ctx: CanvasRenderingContext2D,
  portImage: HTMLImageElement,
  mode: PixelHarborMode,
  stage: number,
  tick: number,
  reducedMotion: boolean,
) {
  BUOYS.forEach((_, index) => drawPort(ctx, portImage, index, mode, stage, tick, reducedMotion));
}

function composeScene(
  ctx: CanvasRenderingContext2D,
  scene: HTMLCanvasElement,
  surface: Surface,
) {
  ctx.imageSmoothingEnabled = false;
  if (!surface.tall) {
    const leftDestinationWidth = surface.width - RIGHT_SCENE_SLICE;
    ctx.drawImage(scene, 0, 0, WIDTH - RIGHT_SCENE_SLICE, HEIGHT, 0, 0, leftDestinationWidth, HEIGHT);
    ctx.drawImage(
      scene,
      WIDTH - RIGHT_SCENE_SLICE,
      0,
      RIGHT_SCENE_SLICE,
      HEIGHT,
      leftDestinationWidth,
      0,
      RIGHT_SCENE_SLICE,
      HEIGHT,
    );
    return;
  }

  const sceneWidth = surface.width;
  const sceneHeight = Math.round(sceneWidth * HEIGHT / WIDTH);
  const sceneTop = surface.height - sceneHeight;
  ctx.fillStyle = '#014ab9';
  ctx.fillRect(0, 0, surface.width, surface.height);
  ctx.drawImage(scene, 0, 0, WIDTH, HEIGHT, 0, sceneTop, sceneWidth, sceneHeight);
}

export default function PixelHarbor({ mode, stage = 0 }: PixelHarborProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d', { alpha: false });
    if (!canvas || !context) return;

    const sceneCanvas = document.createElement('canvas');
    sceneCanvas.width = WIDTH;
    sceneCanvas.height = HEIGHT;
    const sceneContext = sceneCanvas.getContext('2d', { alpha: false });
    if (!sceneContext) return;

    const background = new Image();
    const port = new Image();
    let animationFrame = 0;
    let lastFrame = 0;
    let tick = 0;
    let loaded = 0;
    let disposed = false;
    let surface = getSurface();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const resize = () => {
      surface = getSurface();
      canvas.width = surface.width;
      canvas.height = surface.height;
      context.imageSmoothingEnabled = false;
      if (loaded === 2) render(performance.now(), true);
    };

    const drawFrame = () => {
      sceneContext.imageSmoothingEnabled = false;
      sceneContext.clearRect(0, 0, WIDTH, HEIGHT);
      sceneContext.drawImage(background, 0, 0, WIDTH, HEIGHT);
      drawWater(sceneContext, background, tick, reducedMotion);
      drawRoute(sceneContext, mode, stage, tick);
      drawBirds(sceneContext, tick, reducedMotion);
      drawPorts(sceneContext, port, mode, stage, tick, reducedMotion);

      context.clearRect(0, 0, surface.width, surface.height);
      composeScene(context, sceneCanvas, surface);
      drawBeam(context, surface, tick, reducedMotion);
    };

    const render = (time: number, force = false) => {
      if (disposed || loaded < 2) return;
      if (force || !lastFrame || time - lastFrame >= 83 || reducedMotion) {
        lastFrame = time;
        if (!reducedMotion && !force) tick += 1;
        drawFrame();
      }
      if (!reducedMotion) animationFrame = window.requestAnimationFrame((nextTime) => render(nextTime));
    };

    const imageLoaded = () => {
      loaded += 1;
      if (loaded === 2) {
        resize();
        render(0);
      }
    };

    background.onload = imageLoaded;
    port.onload = imageLoaded;
    background.src = '/harbor-water.png';
    port.src = '/harbor-port.png';
    window.addEventListener('resize', resize);

    return () => {
      disposed = true;
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(animationFrame);
    };
  }, [mode, stage]);

  return (
    <div className={`pixel-harbor pixel-harbor--${mode}`} aria-hidden="true">
      <div className="pixel-harbor__frame">
        <canvas ref={canvasRef} className="pixel-harbor__canvas" width={WIDTH} height={HEIGHT} />
        {mode === 'results' && <div className="pixel-harbor__results-veil" />}
      </div>
    </div>
  );
}
