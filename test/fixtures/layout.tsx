import React from 'react';
import {DockLayout} from '../../src';
import type {LayoutData, LayoutProps} from '../../src';

export function createLayout(): LayoutData {
  return {
    dockbox: {
      id: 'root',
      mode: 'horizontal',
      children: [{
        id: 'panel',
        activeId: 'first',
        tabs: [
          {id: 'first', title: 'First', content: <p>First content</p>, group: 'test', tabPosition: 'top', cached: false},
          {id: 'second', title: 'Second', content: <p>Second content</p>, group: 'test', tabPosition: 'top', cached: false},
        ],
      }],
    },
  };
}

interface FixtureProps {
  layoutRef?: React.Ref<DockLayout>;
  onLayoutChange?: LayoutProps['onLayoutChange'];
}

export function LayoutFixture({layoutRef, onLayoutChange}: FixtureProps) {
  return (
    <DockLayout
      ref={layoutRef}
      defaultLayout={createLayout()}
      groups={{test: {animated: false, floatable: true, movable: true, resizable: true}}}
      style={{position: 'relative', width: 800, height: 480}}
      saveTab={tab => ({id: tab.id})}
      onLayoutChange={onLayoutChange}
    />
  );
}
