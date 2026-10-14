// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, the simulated Gizwits cloud
// and a manual clock, with the integration wired on top through
// registerHandlers. No timer runs unless `timers: true` (with node:test mock
// timers): the tests read the cloud with `world.hub.poll()`.
// -----------------------------------------------------------------------------

import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { EMAIL, FakeGizwits, PASSWORD } from './fakeGizwits.js';

// The integration logs every change; keep the test output readable.
process.env.LOG_LEVEL ??= 'silent';

export const ACCOUNT = { email: EMAIL, password: PASSWORD, language: 'en' };

/** A manual clock, shared by the hub and the simulated cloud. */
export function createClock(start = Date.UTC(2026, 9, 14, 10, 0, 0)) {
  const clock = {
    time: start,
    now: () => clock.time,
    advance(ms) {
      clock.time += ms;
    },
  };
  return clock;
}

export async function createWorld({
  clock = createClock(),
  cloud,
  modules,
  config = ACCOUNT,
  devices = [],
  connect = true,
  timings = {},
  timers = false,
} = {}) {
  const gizwits = cloud ?? new FakeGizwits({ modules, now: clock.now });
  const gladys = createFakeGladys({ config, devices });
  const app = registerHandlers(gladys, {
    request: gizwits.request,
    timers,
    timings,
    now: clock.now,
  });
  if (connect) {
    await gladys.connect();
    await app.ready;
  }
  return { gladys, fake: gladys.fake, cloud: gizwits, app, hub: app.hub, clock };
}

/** External id of the device of a fixture module. */
export const deviceId = (world, name) =>
  world.gladys.externalIds('module', world.cloud.did(name)).device;
export const featureId = (world, name, key) =>
  world.gladys.externalIds('module', world.cloud.did(name)).feature(key);

/** The discovered device of a fixture module. */
export const deviceOf = (world, name) =>
  world.fake.discoveredDevices.find((device) => device.external_id === deviceId(world, name));

/** Add every discovered device in Gladys, as the user would. */
export async function createAll(world) {
  for (const device of world.fake.discoveredDevices) {
    await world.fake.deviceCreated(device);
  }
}

export { FakeGizwits };
