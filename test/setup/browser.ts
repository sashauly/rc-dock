import {afterEach} from 'vitest';
import {act, cleanup} from '@testing-library/react';
import {commands} from 'vitest/browser';
import '../../style/index-light.scss';

afterEach(async () => {
  await commands.finishPointerDrag(true);
  await act(async () => {});
  cleanup();
});
