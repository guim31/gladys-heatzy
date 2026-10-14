// -----------------------------------------------------------------------------
// The hub end to end, against the SDK's fake Gladys and the simulated cloud:
// discovery, states, device creation, commands from the dashboard and the
// scenes, scene events, offline modules, account errors.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PILOT_WIRE } from '../src/heatzy/model.js';
import { TRIGGERS } from '../src/hub.js';
import { ACCOUNT, createAll, createWorld, deviceId, deviceOf, featureId } from './helpers/world.js';

const controls = (world) => world.cloud.requests.filter((r) => r.path.startsWith('/app/control/'));

test('discovers every module of the account, with its states', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  assert.equal(world.fake.discoveredDevices.length, 8);
  const glow = deviceOf(world, 'glow');
  assert.equal(glow.name, 'Chambre parents');
  assert.equal(glow.should_poll, false);
  assert.deepEqual(
    glow.features.map((feature) => `${feature.category}/${feature.type}`),
    ['heater/pilot-wire-mode', 'child-lock/binary', 'switch/binary', 'temperature-sensor/decimal'],
  );
  assert.deepEqual(
    deviceOf(world, 'pilote-v1').features.map((feature) => feature.type),
    ['pilot-wire-mode'],
  );
  assert.equal(world.fake.lastState(featureId(world, 'glow', 'mode')), PILOT_WIRE.ECO);
  assert.equal(world.fake.lastState(featureId(world, 'glow', 'temperature')), 19.6);
  assert.equal(world.fake.lastState(featureId(world, 'pilote-pro', 'humidity')), 57);
  assert.deepEqual(world.fake.connectionStatus.connected, true);
  assert.equal(world.fake.transports.length, 8);
});

test('a reading with nothing new publishes nothing', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const before = world.fake.states.length;
  await world.hub.poll();
  assert.equal(world.fake.states.length, before);
});

test('the states are sent again when the user adds the devices', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const before = world.fake.states.length;
  await createAll(world);
  assert.ok(world.fake.states.length > before);
  assert.ok(world.fake.widgetRefreshes.length > 0);
});

test('the dashboard selector sets the mode, published at once', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await createAll(world);
  const device = deviceOf(world, 'pilote-v2');
  const feature = device.features.find((f) => f.type === 'pilot-wire-mode');
  const ack = await world.fake.setValue(device, feature, PILOT_WIRE.FROST_PROTECTION);
  assert.equal(ack.success, true, ack.error);
  assert.deepEqual(controls(world).at(-1).body, { attrs: { mode: 'fro' } });
  assert.equal(world.fake.lastState(feature.external_id), PILOT_WIRE.FROST_PROTECTION);
  assert.equal(world.cloud.attr('pilote-v2').mode, 'fro');
});

test('comfort -1 on a module without it is refused with a clear message', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const device = deviceOf(world, 'pilote-v2');
  const feature = device.features.find((f) => f.type === 'pilot-wire-mode');
  const ack = await world.fake.setValue(device, feature, PILOT_WIRE.COMFORT_1);
  assert.equal(ack.success, false);
  assert.match(ack.error, /Pilote v4/);
  assert.equal(controls(world).length, 0);
});

test('child lock and weekly programme switches', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const device = deviceOf(world, 'glow');
  const lock = device.features.find((f) => f.category === 'child-lock');
  const programme = device.features.find((f) => f.category === 'switch');
  assert.equal((await world.fake.setValue(device, lock, 1)).success, true);
  assert.equal((await world.fake.setValue(device, programme, 1)).success, true);
  assert.deepEqual(
    controls(world).map((r) => r.body),
    [{ attrs: { LOCK_C: 1 } }, { attrs: { timer_switch: 1 } }],
  );
  assert.equal(world.fake.lastState(lock.external_id), 1);
});

test('the scene action sets every radiator, skipping the modes a module lacks', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const ack = await world.fake.sceneAction('set_mode', { device: null, mode: 'comfort_1' });
  assert.equal(ack.success, true, ack.error);
  // Pilote v4, Pro, Glow, Onyx, Bloom have comfort -1; v1, v2, v3 do not.
  assert.deepEqual(ack.data.outputs, { count: 5 });
  const all = await world.fake.sceneAction('set_mode', { mode: 'frost_protection' });
  assert.deepEqual(all.data.outputs, { count: 8 });
  assert.deepEqual(controls(world).at(-8).body, { raw: [1, 1, 2] });
});

test('vacation mode from a scene, and its end', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const one = await world.fake.sceneAction('start_vacation', {
    device: deviceId(world, 'pilote-v4'),
    days: 10,
  });
  assert.deepEqual(one.data.outputs, { count: 1 });
  assert.equal(world.cloud.attr('pilote-v4').derog_mode, 1);
  assert.equal(world.cloud.attr('pilote-v4').derog_time, 10);
  const v1 = await world.fake.sceneAction('start_vacation', {
    device: deviceId(world, 'pilote-v1'),
    days: 10,
  });
  assert.equal(v1.success, false);
  assert.match(v1.error, /Pilote v1/);
  const bad = await world.fake.sceneAction('start_vacation', { days: 0 });
  assert.equal(bad.success, false);
  const stop = await world.fake.sceneAction('stop_vacation', {});
  assert.deepEqual(stop.data.outputs, { count: 7 });
  assert.equal(world.cloud.attr('pilote-v4').derog_mode, 0);
});

test('a mode changed outside Gladys fires the trigger, not one Gladys set', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  world.cloud.attr('pilote-v2').mode = 'eco'; // from the Heatzy app
  await world.hub.poll();
  const events = world.fake.sceneEvents.filter((e) => e.key === TRIGGERS.MODE_CHANGED);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0].data, {
    device: deviceId(world, 'pilote-v2'),
    radiator: 'Salon',
    mode: 'eco',
    previous_mode: 'comfort',
    programming: false,
  });

  await world.fake.sceneAction('set_mode', { device: deviceId(world, 'glow'), mode: 'comfort' });
  await world.hub.poll();
  // A module that did not follow the command is not announced as a change either.
  world.clock.advance(60_000);
  await world.hub.poll();
  assert.equal(world.fake.sceneEvents.filter((e) => e.key === TRIGGERS.MODE_CHANGED).length, 1);
});

test('a module going offline and back fires its triggers and keeps its values', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  world.cloud.setOnline('onyx', false);
  await world.hub.poll();
  assert.deepEqual(world.fake.sceneEvents.at(-1), {
    key: TRIGGERS.OFFLINE,
    data: { device: deviceId(world, 'onyx'), radiator: 'Salle de bain' },
  });
  assert.deepEqual(world.fake.transports.slice(-1), [
    { device_external_id: deviceId(world, 'onyx'), transport: 'unreachable' },
  ]);
  assert.equal(world.fake.lastState(featureId(world, 'onyx', 'mode')), PILOT_WIRE.ECO);
  const device = deviceOf(world, 'onyx');
  const ack = await world.fake.setValue(device, device.features[0], PILOT_WIRE.COMFORT);
  assert.equal(ack.success, false);
  assert.match(ack.error, /offline/);
  world.cloud.setOnline('onyx', true);
  await world.hub.poll();
  assert.equal(world.fake.sceneEvents.at(-1).key, TRIGGERS.ONLINE);
});

test('a refused password: a clear status, and no login loop', async (t) => {
  const world = await createWorld({ config: { ...ACCOUNT, password: 'wrong' } });
  t.after(() => world.app.stop());
  assert.equal(world.fake.connectionStatus.connected, false);
  assert.match(JSON.stringify(world.fake.connectionStatus), /refuse/);
  assert.equal(world.fake.discoveredDevices.length, 0);
  assert.equal(world.hub.pollTimer, null);
  // The right password in the configuration: connected.
  await world.fake.configUpdated({ ...ACCOUNT });
  assert.equal(world.fake.connectionStatus.connected, true);
  assert.equal(world.fake.discoveredDevices.length, 8);
});

test('without an account, the status asks for one and nothing is read', async (t) => {
  const world = await createWorld({ config: {} });
  t.after(() => world.app.stop());
  assert.equal(world.fake.connectionStatus.connected, false);
  assert.match(JSON.stringify(world.fake.connectionStatus), /Heatzy/);
  assert.equal(world.cloud.requests.length, 0);
});

test('a cloud outage is reported once, then the connection comes back', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  world.cloud.failures.push('network');
  await world.hub.poll();
  assert.equal(world.fake.connectionStatus.connected, false);
  await world.hub.poll();
  assert.equal(world.fake.connectionStatus.connected, true);
});

test('"Test the connection" lists the modules', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const ack = await world.fake.action('test_connection', {});
  assert.equal(ack.success, true);
  assert.match(ack.data.message.fr, /8 module\(s\)/);
  assert.match(ack.data.message.en, /Chambre parents \(Glow\)/);
  assert.match(ack.data.message.en, /Salle de bain \(Onyx\)/);
});

test('a module removed from the account leaves the discovery list', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  world.cloud.devices.delete(world.cloud.did('bloom'));
  await world.hub.poll();
  assert.equal(world.fake.discoveredDevices.length, 7);
});
