import React from 'react';
import {act, render} from '@testing-library/react';
import {afterEach, expect, test, vi} from 'vitest';
import {commands} from 'vitest/browser';
import {useDragDropManager} from 'react-dnd';
import {DockLayout, DragDropDiv} from '../../src';
import type {DragState, LayoutData, PanelData} from '../../src';

afterEach(() => vi.restoreAllMocks());

type DragManager = ReturnType<typeof useDragDropManager>;

function ManagerProbe({onReady}: {onReady: (manager: DragManager) => void}): null {
  const manager = useDragDropManager();
  React.useEffect(() => onReady(manager), [manager, onReady]);
  return null;
}

function trackOffsetSubscriptions(manager: DragManager, subscriptions: Set<() => void>) {
  const monitor = manager.getMonitor();
  const subscribe = monitor.subscribeToOffsetChange.bind(monitor);
  // Observe the external event-source boundary while retaining its real behavior.
  vi.spyOn(monitor, 'subscribeToOffsetChange').mockImplementation(listener => {
    const unsubscribe = subscribe(listener);
    const tracked = () => {
      subscriptions.delete(tracked);
      unsubscribe();
    };
    subscriptions.add(tracked);
    return tracked;
  });
}

function createLayout(content: React.ReactElement = <p>Dock content</p>, floating = true): LayoutData {
  return {dockbox: {id: 'root', mode: 'horizontal', children: [
    {id: 'left', size: 400, tabs: [{id: 'left-tab', title: 'Left', content, group: 'test', tabPosition: 'top'}]},
    {id: 'right', size: 400, tabs: [{id: 'right-tab', title: 'Right', content: <p>Right content</p>, group: 'test', tabPosition: 'top'}]},
  ]}, floatbox: {mode: 'float', children: floating ? [
    {id: 'floating', x: 100, y: 100, w: 300, h: 200,
      tabs: [{id: 'floating-tab', title: 'Floating', content: <p>Float content</p>, group: 'test', tabPosition: 'top'}]},
  ] : []}};
}

function Fixture({scale = 1, content, layoutRef, maximizeTo, floating = true}: {
  scale?: number;
  content?: React.ReactElement;
  layoutRef?: React.Ref<DockLayout>;
  maximizeTo?: HTMLElement;
  floating?: boolean;
}) {
  return <div style={{transform: `scale(${scale})`, transformOrigin: 'top left'}}>
    <DockLayout ref={layoutRef} defaultLayout={createLayout(content, floating)} maximizeTo={maximizeTo}
      groups={{test: {animated: false, floatable: true, movable: true, resizable: true, maximizable: true}}}
      style={{position: 'relative', width: 800, height: 480}} saveTab={tab => ({id: tab.id})} />
  </div>;
}

function panel(id: string): HTMLElement {
  return document.querySelector(`[data-dockid="${id}"]`);
}

test('floating movement is visible before mouse release', async () => {
  render(<Fixture />);
  await act(async () => {});
  const before = panel('floating').getBoundingClientRect();
  const start = await commands.beginPointerDrag('[data-dockid="floating"] .dock-bar');
  await commands.movePointer({x: start.x + 40, y: start.y + 30});
  await expect.poll(() => panel('floating').getBoundingClientRect().left).toBeCloseTo(before.left + 40, 0);
  await expect.poll(() => panel('floating').getBoundingClientRect().top).toBeCloseTo(before.top + 30, 0);
  await commands.finishPointerDrag();
});

test('floating resizing tracks scaled coordinates before release', async () => {
  render(<Fixture scale={0.5} />);
  await act(async () => {});
  const before = panel('floating').getBoundingClientRect();
  const start = await commands.beginPointerDrag('[data-dockid="floating"] .dock-panel-drag-size-r');
  await commands.movePointer({x: start.x + 30, y: start.y});
  await expect.poll(() => panel('floating').getBoundingClientRect().width).toBeCloseTo(before.width + 30, 0);
  expect(panel('floating').style.width).toBe('360px');
  await commands.finishPointerDrag();
});

test('a divider resizes adjacent panels before release', async () => {
  render(<Fixture floating={false} />);
  await act(async () => {});
  const before = panel('left').getBoundingClientRect().width;
  const start = await commands.beginPointerDrag('.dock-layout > .dock-box > .dock-divider');
  await commands.movePointer({x: start.x + 45, y: start.y});
  await expect.poll(() => panel('left').getBoundingClientRect().width).toBeCloseTo(before + 45, 0);
  await commands.finishPointerDrag();
});

test('a canceled drag retains the last coordinates without a zero-delta callback', async () => {
  let manager: DragManager;
  const onMove = vi.fn<(state: DragState) => void>();
  const onEnd = vi.fn<(state: DragState) => void>();
  const content = <>
    <ManagerProbe onReady={current => { manager = current; }} />
    <DragDropDiv data-testid="move-probe" onDragStartT={() => {}} onDragMoveT={onMove} onDragEndT={onEnd}
      style={{width: 150, height: 80, background: '#ddd'}}>Drag probe</DragDropDiv>
  </>;
  render(<Fixture content={content} floating={false} />);
  await act(async () => {});
  const start = await commands.beginPointerDrag('[data-testid="move-probe"]');
  await commands.movePointer({x: start.x + 35, y: start.y + 15});
  await expect.poll(() => onMove.mock.calls.at(-1)?.[0].dx).toBeCloseTo(35, 0);
  const last = onMove.mock.calls.at(-1)[0];
  expect(last.dx).toBeCloseTo(35, 0);
  expect(last.dy).toBeCloseTo(15, 0);
  // The backend can clear its pointer offset before the native dragend arrives.
  act(() => manager.getActions().hover([], {clientOffset: null}));
  await commands.finishPointerDrag(true);
  expect(onEnd).toHaveBeenCalledTimes(1);
  expect(onEnd.mock.calls[0][0].clientX).toBe(0);
  const ended = onMove.mock.calls.at(-1)[0];
  expect([ended.dx, ended.dy]).toEqual([last.dx, last.dy]);
});

test.each(['drag end', 'source unmount'] as const)('releases movement subscriptions on %s', async cleanupPoint => {
  const subscriptions = new Set<() => void>();
  const content = <>
    <ManagerProbe onReady={manager => trackOffsetSubscriptions(manager, subscriptions)} />
    <DragDropDiv data-testid="subscription-probe" onDragStartT={() => {}} onDragMoveT={() => {}}
      style={{width: 150, height: 80, background: '#ddd'}}>Subscription probe</DragDropDiv>
  </>;
  const view = render(<Fixture content={content} floating={false} />);
  await act(async () => {});
  const start = await commands.beginPointerDrag('[data-testid="subscription-probe"]');
  await commands.movePointer({x: start.x + 30, y: start.y + 15});
  await expect.poll(() => subscriptions.size).toBe(1);

  if (cleanupPoint === 'drag end') await commands.finishPointerDrag();
  else view.unmount();

  await expect.poll(() => subscriptions.size).toBe(0);
});

test('sources without a move callback do not subscribe to pointer offsets', async () => {
  const subscriptions = new Set<() => void>();
  const content = <>
    <ManagerProbe onReady={manager => trackOffsetSubscriptions(manager, subscriptions)} />
    <DragDropDiv data-testid="no-move-probe" onDragStartT={() => {}}
      style={{width: 150, height: 80, background: '#ddd'}}>No movement callback</DragDropDiv>
  </>;
  render(<Fixture content={content} floating={false} />);
  await act(async () => {});
  const start = await commands.beginPointerDrag('[data-testid="no-move-probe"]');
  await commands.movePointer({x: start.x + 30, y: start.y + 15});
  expect(subscriptions.size).toBe(0);
  await commands.finishPointerDrag();
});

test('maximized content fills a positioned external portal target', async () => {
  const target = document.createElement('div');
  Object.assign(target.style, {position: 'relative', width: '600px', height: '350px', marginLeft: '25px'});
  const existingContent = document.createElement('div');
  existingContent.style.height = '30px';
  existingContent.textContent = 'Existing portal content';
  target.appendChild(existingContent);
  document.body.appendChild(target);
  try {
    const layoutRef = React.createRef<DockLayout>();
    const view = render(<Fixture layoutRef={layoutRef} maximizeTo={target} />);
    await act(async () => {});
    act(() => layoutRef.current.dockMove(layoutRef.current.find('left') as PanelData, null, 'maximize'));
    await expect.poll(() => !!target.querySelector('.dock-mbox-show')).toBe(true);
    const expected = target.getBoundingClientRect();
    await expect.poll(() => {
      const actual = target.querySelector('.dock-mbox-show').getBoundingClientRect();
      return [actual.left, actual.top, actual.width, actual.height];
    }).toEqual([expected.left, expected.top, expected.width, expected.height]);
    view.unmount();
  } finally {
    target.remove();
  }
});
