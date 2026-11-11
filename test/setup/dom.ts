import {afterEach, beforeEach, vi} from 'vitest';
import {act, cleanup} from '@testing-library/react';

// jsdom has no layout engine. Geometry belongs in the browser project.
class TestResizeObserver implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', TestResizeObserver);
});

afterEach(async () => {
  // Flush the library's queued header measurements while it is still mounted.
  await act(async () => {});
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
