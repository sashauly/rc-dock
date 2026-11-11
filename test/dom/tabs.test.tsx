import React from 'react';
import {expect, test, vi} from 'vitest';
import {act, fireEvent, render} from '@testing-library/react';
import {LayoutFixture} from '../fixtures/layout';

test('selecting a tab shows its content and reports the active tab', async () => {
  const onLayoutChange = vi.fn();
  const view = render(<LayoutFixture onLayoutChange={onLayoutChange} />);
  await act(async () => {});

  expect(view.getByText('First content')).toBeDefined();
  expect(view.queryByText('Second content')).toBeNull();
  fireEvent.click(view.getByText('Second'));

  expect(await view.findByText('Second content')).toBeDefined();
  expect(view.queryByText('First content')).toBeNull();
  expect(onLayoutChange).toHaveBeenCalledWith(expect.anything(), 'second', 'active', undefined);
});
