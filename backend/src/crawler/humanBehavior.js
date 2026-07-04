import { randomDelayMs } from './stealth.js';

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function cubicBezier(t, p0, p1, p2, p3) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

export function buildMousePath(fromX, fromY, toX, toY, steps = 24) {
  const cp1x = fromX + (toX - fromX) * randomBetween(0.15, 0.45) + randomBetween(-40, 40);
  const cp1y = fromY + (toY - fromY) * randomBetween(0.05, 0.35) + randomBetween(-30, 30);
  const cp2x = fromX + (toX - fromX) * randomBetween(0.55, 0.9) + randomBetween(-35, 35);
  const cp2y = fromY + (toY - fromY) * randomBetween(0.65, 0.95) + randomBetween(-25, 25);

  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push({
      x: cubicBezier(t, fromX, cp1x, cp2x, toX),
      y: cubicBezier(t, fromY, cp1y, cp2y, toY),
    });
  }
  return points;
}

export async function humanMouseMove(page, toX, toY, from = null) {
  const viewport = page.viewportSize() || { width: 1920, height: 1080 };
  const startX = from?.x ?? randomBetween(viewport.width * 0.2, viewport.width * 0.8);
  const startY = from?.y ?? randomBetween(viewport.height * 0.2, viewport.height * 0.7);
  const path = buildMousePath(startX, startY, toX, toY, 18 + Math.floor(Math.random() * 14));

  for (const point of path) {
    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(randomDelayMs(4, 18));
  }

  return { x: toX, y: toY };
}

export async function humanScroll(page, { steps = 6, distance = 320 } = {}) {
  const viewport = page.viewportSize() || { width: 1920, height: 1080 };
  let cursor = {
    x: randomBetween(viewport.width * 0.35, viewport.width * 0.65),
    y: randomBetween(viewport.height * 0.35, viewport.height * 0.65),
  };

  for (let i = 0; i < steps; i++) {
    cursor = await humanMouseMove(
      page,
      randomBetween(viewport.width * 0.25, viewport.width * 0.75),
      randomBetween(viewport.height * 0.25, viewport.height * 0.75),
      cursor,
    );
    await page.mouse.wheel(0, distance + randomBetween(-80, 120));
    await page.waitForTimeout(randomDelayMs(180, 520));
  }
}

export async function simulateHumanActivity(page, { intensity = 'medium' } = {}) {
  const viewport = page.viewportSize() || { width: 1920, height: 1080 };
  const moves = intensity === 'light' ? 2 : intensity === 'heavy' ? 6 : 4;
  let cursor = {
    x: randomBetween(80, viewport.width - 80),
    y: randomBetween(80, viewport.height - 80),
  };

  for (let i = 0; i < moves; i++) {
    cursor = await humanMouseMove(
      page,
      randomBetween(100, viewport.width - 100),
      randomBetween(100, viewport.height - 100),
      cursor,
    );
    await page.waitForTimeout(randomDelayMs(120, 420));
  }

  if (Math.random() > 0.35) {
    await humanScroll(page, { steps: intensity === 'light' ? 2 : 4 });
  }
}