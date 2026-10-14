// -----------------------------------------------------------------------------
// The container reads the cloud on its own timer (should_poll: false, and the
// 5.2.0 core never polls a device created without should_poll): proven here
// without ever calling onPoll. A refused password stops the readings; a "too
// many requests" slows them down.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNT, createWorld } from './helpers/world.js';

const listReads = (world) => world.cloud.requests.filter((r) => r.path === '/app/bindings').length;

async function flush() {
  for (let i = 0; i < 20; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

test('the modules are read again at the configured interval, without onPoll', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const world = await createWorld({ config: { ...ACCOUNT, poll_interval: '300' }, timers: true });
  t.after(() => world.app.stop());
  assert.equal(listReads(world), 1);
  world.cloud.attr('pilote-v2').mode = 'stop';
  t.mock.timers.tick(299_000);
  await flush();
  assert.equal(listReads(world), 1);
  t.mock.timers.tick(1_000);
  await flush();
  assert.equal(listReads(world), 2);
  assert.equal(world.fake.lastState(`${world.fake.discoveredDevices[1].external_id}:mode`), 0);
  t.mock.timers.tick(300_000);
  await flush();
  assert.equal(listReads(world), 3);
});

test('a refused password stops the readings until the configuration changes', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const world = await createWorld({ config: { ...ACCOUNT, password: 'nope' }, timers: true });
  t.after(() => world.app.stop());
  t.mock.timers.tick(3_600_000);
  await flush();
  assert.equal(world.cloud.logins, 1);
});

test('a "too many requests" answer waits ten minutes', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const world = await createWorld({ config: { ...ACCOUNT, poll_interval: '60' }, timers: true });
  t.after(() => world.app.stop());
  world.cloud.failures.push({ status: 429, body: null });
  t.mock.timers.tick(60_000);
  await flush();
  assert.equal(world.fake.connectionStatus.connected, false);
  const reads = world.cloud.requests.length;
  t.mock.timers.tick(540_000);
  await flush();
  assert.equal(world.cloud.requests.length, reads);
  t.mock.timers.tick(60_000);
  await flush();
  assert.equal(world.fake.connectionStatus.connected, true);
});

test('a command is confirmed by a reading a few seconds later', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const world = await createWorld({ timers: true });
  t.after(() => world.app.stop());
  await world.fake.sceneAction('set_mode', { mode: 'eco' });
  const reads = listReads(world);
  t.mock.timers.tick(5_000);
  await flush();
  // One reading for the eight commands.
  assert.equal(listReads(world), reads + 1);
});
