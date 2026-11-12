import {defineBrowserCommand} from '@vitest/browser-playwright';
import type {Page} from 'playwright';

interface Point {
  x: number;
  y: number;
}

interface CoordinateSpace {
  client: Point;
  browser: Point;
  scale: Point;
}

const activePages = new WeakMap<Page, CoordinateSpace>();

function browserPoint(space: CoordinateSpace, point: Point): Point {
  return {
    x: space.browser.x + (point.x - space.client.x) * space.scale.x,
    y: space.browser.y + (point.y - space.client.y) * space.scale.y,
  };
}

export const beginPointerDrag = defineBrowserCommand(async ({page, iframe}, selector: string): Promise<Point> => {
  const source = iframe.locator(selector);
  const box = await source.boundingBox();
  if (!box) throw new Error(`Drag source has no box: ${selector}`);
  const local = await source.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return {x: rect.x, y: rect.y, width: rect.width, height: rect.height};
  });
  // Vitest may scale its tester iframe. Keep the test API in application CSS
  // coordinates while Playwright's mouse receives outer-page coordinates.
  const space: CoordinateSpace = {
    client: {x: local.x, y: local.y},
    browser: {x: box.x, y: box.y},
    scale: {x: box.width / local.width, y: box.height / local.height},
  };
  const start = {x: Math.round(local.x + local.width / 2), y: Math.round(local.y + local.height / 2)};
  const position = browserPoint(space, start);
  await page.mouse.move(position.x, position.y);
  await page.mouse.down();
  activePages.set(page, space);
  return start;
});

export const movePointer = defineBrowserCommand(async ({page}, point: Point) => {
  const space = activePages.get(page);
  if (!space) throw new Error('Begin a pointer drag before moving it');
  const position = browserPoint(space, point);
  await page.mouse.move(position.x, position.y, {steps: 5});
  await page.mouse.move(position.x, position.y);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
});

export const finishPointerDrag = defineBrowserCommand(async ({page}, cancel = false) => {
  if (!activePages.has(page)) return;
  if (cancel) await page.keyboard.press('Escape');
  await page.mouse.up();
  activePages.delete(page);
});

declare module 'vitest/browser' {
  interface BrowserCommands {
    beginPointerDrag(selector: string): Promise<Point>;
    movePointer(point: Point): Promise<void>;
    finishPointerDrag(cancel?: boolean): Promise<void>;
  }
}
