import React from 'react';
import {expect, test} from 'vitest';
import {page, userEvent} from 'vitest/browser';
import {act, render} from '@testing-library/react';
import {DockLayout} from '../../src';
import type {PanelData} from '../../src';
import {LayoutFixture} from '../fixtures/layout';

test('native dragging reorders tabs in a rendered dock layout', async () => {
  const layoutRef = React.createRef<DockLayout>();
  const view = render(<LayoutFixture layoutRef={layoutRef} />);
  await act(async () => {});

  const layout = view.container.querySelector<HTMLElement>('.dock-layout');
  expect(layout.getBoundingClientRect().width).toBe(800);
  expect(layout.getBoundingClientRect().height).toBe(480);

  await userEvent.dragAndDrop(
    page.getByText('Second', {exact: true}),
    page.getByText('First', {exact: true}),
    {targetPosition: {x: 2, y: 5}},
  );

  await expect.poll(() => {
    const panel = layoutRef.current.find('panel') as PanelData;
    return panel.tabs.map(tab => tab.id);
  }).toEqual(['second', 'first']);
  await expect.element(page.getByText('Second content', {exact: true})).toBeVisible();
});
