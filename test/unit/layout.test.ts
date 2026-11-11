import {describe, expect, test} from 'vitest';
import {find, Filter, fixLayoutData} from '../../src/Algorithm';
import {loadLayoutData, saveLayoutData} from '../../src/Serializer';
import type {LayoutData, PanelBase, PanelData} from '../../src/DockData';

function createLayout(): LayoutData {
  return fixLayoutData({
    dockbox: {
      id: 'root',
      mode: 'horizontal',
      children: [{
        id: 'panel',
        activeId: 'second',
        tabs: [
          {id: 'first', title: 'First', content: null},
          {id: 'second', title: 'Second', content: null},
        ],
      }],
    },
  });
}

describe('layout persistence', () => {
  test('round-trips tab order and active selection with an ID serializer', () => {
    const layout = createLayout();
    const saved = saveLayoutData(layout, tab => ({id: tab.id}));

    expect(() => JSON.stringify(saved)).not.toThrow();
    expect((saved.dockbox.children[0] as PanelBase).tabs).toEqual([{id: 'first'}, {id: 'second'}]);

    const restored = fixLayoutData(loadLayoutData(saved, createLayout()));
    const panel = find(restored, 'panel', Filter.AnyPanel) as PanelData;
    expect(panel.tabs.map(tab => tab.id)).toEqual(['first', 'second']);
    expect(panel.activeId).toBe('second');
    expect(panel.tabs[0].title).toBe('First');
  });

  test('resolves saved references through the supplied tab loader', () => {
    const saved = saveLayoutData(createLayout(), tab => ({id: tab.id}));
    const restored = loadLayoutData(saved, undefined, tab => ({
      id: tab.id,
      title: `Loaded ${tab.id}`,
      content: null,
    }));

    const panel = restored.dockbox.children[0] as PanelData;
    expect(panel.tabs.map(tab => tab.title)).toEqual(['Loaded first', 'Loaded second']);
    expect(panel.activeId).toBe('second');
  });
});
