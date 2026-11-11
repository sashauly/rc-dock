const assert = require('node:assert/strict');
const Module = require('node:module');

// Capture the real drag source callbacks without mounting React DnD's HOCs.
const originalLoad = Module._load;
let sourceSpec;
let DragDropComponent;
Module._load = function(request, ...args) {
  const loaded = originalLoad.call(this, request, ...args);
  if (request !== 'react-dnd') return loaded;
  return {
    ...loaded,
    DragSource: (_type, spec) => Component => {
      if (Component.name === 'DndDragDropDiv') {
        sourceSpec = spec;
        DragDropComponent = Component;
      }
      return Component;
    },
    DropTarget: () => Component => Component
  };
};
try {
  require('../lib/dragdrop/DragDropDiv');
} finally {
  Module._load = originalLoad;
}

function createDrag(withMove = true) {
  const listeners = new Set();
  const moves = [];
  let item;
  let offset = {x: 10, y: 20};
  let dropResult;
  const dockContext = {
    getDockId: () => 'test',
    getDefaultDndSpec: () => undefined,
    getExternalData: () => undefined
  };
  const props = {
    dockContext,
    dragDropManager: {
      getMonitor: () => ({
        subscribeToOffsetChange(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        }
      })
    },
    onDragStartT() {},
    onDragMoveT: withMove ? state => moves.push([state.dx, state.dy]) : undefined
  };
  // Deliberately expose only the public source-monitor API.
  const monitor = {
    getClientOffset: () => offset,
    getItem: () => item,
    getDropResult: () => dropResult
  };
  const component = new DragDropComponent(props);
  component.context = dockContext;
  component._element = {
    parentElement: {
      offsetWidth: 500, offsetHeight: 200,
      getBoundingClientRect: () => ({width: 250, height: 100})
    }
  };
  item = sourceSpec.beginDrag(props, monitor, component);
  return {
    moves, listeners, component,
    move(nextOffset) {
      offset = nextOffset;
      for (const listener of listeners) listener();
    },
    replaceItem() { item = {}; },
    end(result) {
      dropResult = result;
      sourceSpec.endDrag(props, monitor, component);
    }
  };
}

async function main() {
  const originalDocument = global.document;
  global.document = {body: {classList: {add() {}, remove() {}}}};
  try {
    const live = createDrag();
    live.move({x: 40, y: 55});
    assert.deepEqual(live.moves, [[60, 70]], 'movement must be reported before drop, with scale applied');
    live.end({clientOffset: {x: 50, y: 60}});
    assert.deepEqual(live.moves, [[60, 70], [80, 80]], 'drop must commit its final coordinates');
    assert.equal(live.listeners.size, 0, 'ending a drag must unsubscribe');

    const canceled = createDrag();
    canceled.move({x: 40, y: 55});
    canceled.move(null);
    canceled.end();
    assert.deepEqual(canceled.moves, [[60, 70]], 'a missing drop offset must not reset the last size to zero');
    assert.equal(canceled.listeners.size, 0);

    const unmounted = createDrag();
    unmounted.component.componentWillUnmount();
    assert.equal(unmounted.listeners.size, 0, 'unmount must release the drag listener');
    unmounted.move({x: 100, y: 100});
    assert.deepEqual(unmounted.moves, []);

    const foreign = createDrag();
    foreign.replaceItem();
    foreign.move({x: 100, y: 100});
    assert.deepEqual(foreign.moves, [], 'a different source must not receive move callbacks');
    foreign.component.componentWillUnmount();

    const noMove = createDrag(false);
    assert.equal(noMove.listeners.size, 0, 'sources without move handlers need no subscription');
    noMove.end();
  } finally {
    global.document = originalDocument;
  }

  const {DockLayout} = require('../lib/DockLayout');
  const layout = {dockbox: {mode: 'horizontal', children: []}};
  const dock = new DockLayout({layout, loadTab: tab => tab, onLayoutChange() {}});
  const tab = id => ({id, title: id, content: null});
  dock.dockMove({tabs: [tab('first')], x: 0, y: 0, w: 400, h: 300}, null, 'float');
  assert.ok(dock.find('first'), 'a second command must see the pending controlled layout');
  dock.dockMove(dock.find('first').parent, null, 'maximize');
  dock.dockMove(tab('second'), dock.find('first'), 'after-tab');
  assert.deepEqual(dock.find('second').parent.tabs.map(item => item.id), ['first', 'second']);
  dock.dockMove(dock.find('first'), null, 'remove');
  dock.dockMove(dock.find('second'), null, 'remove');
  assert.equal(dock.find('second'), undefined);
  let forced = false;
  dock.forceUpdate = () => { forced = true; };
  dock.componentWillUnmount();
  await new Promise(resolve => queueMicrotask(resolve));
  assert.equal(forced, false, 'queued updates must not run after unmount');

  const rejected = new DockLayout({layout, loadTab: item => item, onLayoutChange() {}});
  rejected.dockMove({tabs: [tab('rejected')], x: 0, y: 0, w: 400, h: 300}, null, 'float');
  assert.ok(rejected.find('rejected'));
  rejected.render();
  assert.equal(rejected.find('rejected'), undefined, 'the parent must still be able to reject a controlled change');
  rejected.componentWillUnmount();

  const {DockPanel} = require('../lib/DockPanel');
  const panel = new DockPanel({panelData: {id: 'removed', tabs: []}});
  panel._unmounted = true;
  panel.updatePanelData();
  console.log('PASS: live scaled drag, drop/cancel, cleanup, source isolation, controlled moves/rejection, stale measurements');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
