import {afterEach} from 'vitest';
import {act, cleanup} from '@testing-library/react';
import '../../style/index-light.scss';

afterEach(async () => {
  await act(async () => {});
  cleanup();
});
