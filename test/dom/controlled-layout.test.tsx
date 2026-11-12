import React from 'react';
import {act, render, waitFor} from '@testing-library/react';
import {expect, test, vi} from 'vitest';
import {DockLayout} from '../../src';
import type {LayoutBase, LayoutProps, TabData} from '../../src';
import {LayoutFixture} from '../fixtures/layout';

const tab = (id: string): TabData => ({id, title: id, content: <p>{id}</p>});
const emptyLayout = (): LayoutBase => ({dockbox: {mode: 'horizontal', children: []}});

test('consecutive controlled moves share pending changes before props commit', async () => {
  const layoutRef = React.createRef<DockLayout>();
  const onChange = vi.fn();
  function ControlledLayout() {
    const [layout, setLayout] = React.useState(emptyLayout);
    const onLayoutChange: LayoutProps['onLayoutChange'] = (next, id, direction) => {
      onChange(id, direction);
      setLayout(next);
    };
    return <DockLayout ref={layoutRef} layout={layout} loadTab={saved => tab(saved.id)}
      onLayoutChange={onLayoutChange} saveTab={saved => ({id: saved.id})} />;
  }
  render(<ControlledLayout />);
  await act(async () => {});
  onChange.mockClear();

  act(() => {
    const dock = layoutRef.current;
    dock.dockMove({tabs: [tab('first')], x: 0, y: 0, w: 400, h: 300}, null, 'float');
    const first = dock.find('first') as TabData;
    expect(first).toBeDefined();
    dock.dockMove(first.parent, null, 'maximize');
    dock.dockMove(tab('second'), dock.find('first'), 'after-tab');
    expect((dock.find('second') as TabData).parent.tabs.map(item => item.id)).toEqual(['first', 'second']);
    dock.dockMove(dock.find('first') as TabData, null, 'remove');
    dock.dockMove(dock.find('second') as TabData, null, 'remove');
  });
  await act(async () => {});

  expect(layoutRef.current.find('first')).toBeUndefined();
  expect(layoutRef.current.find('second')).toBeUndefined();
  expect(onChange.mock.calls.map(([, direction]) => direction).filter(direction => direction !== 'configure-panel'))
    .toEqual(['float', 'maximize', 'after-tab', 'remove', 'remove']);
});

test('the parent can reject a pending controlled change', async () => {
  const layoutRef = React.createRef<DockLayout>();
  render(<DockLayout ref={layoutRef} layout={emptyLayout()} loadTab={saved => tab(saved.id)}
    onLayoutChange={() => {}} saveTab={saved => ({id: saved.id})} />);
  await act(async () => {});

  act(() => {
    layoutRef.current.dockMove({tabs: [tab('rejected')], x: 0, y: 0, w: 400, h: 300}, null, 'float');
    expect(layoutRef.current.find('rejected')).toBeDefined();
  });

  await waitFor(() => expect(layoutRef.current.find('rejected')).toBeUndefined());
});

test('queued panel measurements do not notify the owner after unmount', async () => {
  let deliverQueuedMeasurement: () => void;
  class QueuedResizeObserver implements ResizeObserver {
    constructor(private callback: ResizeObserverCallback) {}
    observe(target: Element) {
      if (target.classList.contains('dock-bar') && !deliverQueuedMeasurement) {
        deliverQueuedMeasurement = () => this.callback([{
          target,
          contentRect: new DOMRect(0, 0, 300, 30),
          borderBoxSize: [],
          contentBoxSize: [],
          devicePixelContentBoxSize: [],
        }], this);
      }
    }
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', QueuedResizeObserver);
  const onLayoutChange = vi.fn();
  const view = render(<LayoutFixture onLayoutChange={onLayoutChange} />);
  await act(async () => {});
  onLayoutChange.mockClear();
  expect(deliverQueuedMeasurement).toBeDefined();
  view.unmount();
  // The platform callback was already queued when disconnect ran.
  await act(async () => deliverQueuedMeasurement());
  expect(onLayoutChange).not.toHaveBeenCalled();
});
