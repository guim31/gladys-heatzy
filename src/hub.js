// -----------------------------------------------------------------------------
// The Heatzy hub: the modules of the account, read from the Gizwits cloud on a
// timer of the container (the interval of the configuration), their states
// published to Gladys when they change, their scene events fired on
// transitions, and the commands of the devices, the widget and the scene
// actions.
//
// Gladys never polls these devices (should_poll: false): the interval goes
// beyond the one-minute list of the core scheduler, and the scene events must
// fire even for a module whose device was not added. A reading costs one
// request for the module list and one per module, one after the other.
// -----------------------------------------------------------------------------

import { DEVICE_TRANSPORTS, createLogger } from '@gladysassistant/integration-sdk';
import {
  buildDevice,
  deviceIds,
  didOf,
  featureKeyOf,
  FEATURE_KEYS,
  moduleName,
  moduleStates,
} from './devices.js';
import { ERROR_KINDS, HeatzyClient } from './heatzy/client.js';
import {
  MAX_VACATION_DAYS,
  MODE_KEYS,
  UnsupportedCommand,
  applyCommand,
  modeCommand,
  parseModule,
  switchCommand,
  vacationCommand,
} from './heatzy/model.js';
import { ACTION_TEXT, CONNECTION_TEXT, ERROR_TEXT, REPORT_TEXT, labelled, pick } from './texts.js';

const logger = createLogger({ name: 'heatzy-hub' });

export const WIDGET_KEY = 'radiators';

// Scene trigger keys (manifest `scene_triggers`): permanent once published.
export const TRIGGERS = Object.freeze({
  MODE_CHANGED: 'mode_changed',
  OFFLINE: 'module_offline',
  ONLINE: 'module_online',
});

export const HUB_TIMINGS = {
  // A mode seen this long after a Gladys command is Gladys' own (no trigger).
  ownChangeMs: 3 * 60_000,
  // Read a module again this long after a command, to confirm it.
  confirmMs: 5_000,
  // After a "too many requests", wait this long before the next reading.
  rateLimitBackoffMs: 10 * 60_000,
  // Re-send unchanged values this often (Gladys flags values older than 48 h).
  heartbeatMs: 12 * 60 * 60_000,
};

const signature = (config) => JSON.stringify([config.email, config.password]);

export class HeatzyHub {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK's fake Gladys)
   * @param {Function} [options.request] HTTP seam (src/heatzy/http.js)
   * @param {boolean} [options.timers] periodic timers (off in tests)
   * @param {object} [options.timings] HUB_TIMINGS overrides
   * @param {() => number} [options.now]
   */
  constructor({ gladys, request, timers = true, timings, now }) {
    this.gladys = gladys;
    this.request = request;
    this.timersEnabled = timers;
    this.timings = { ...HUB_TIMINGS, ...timings };
    this.now = now ?? (() => Date.now());
    this.config = null;
    this.client = null;
    this.signature = null;
    /** @type {Map<string, object>} modules by did (parseModule + ownChangeUntil) */
    this.modules = new Map();
    /** Cloud state: null before the first reading, else the last error (or none). */
    this.cloud = { read: false, error: null };
    this.devicesKey = null;
    this.transports = new Map();
    this.connection = null;
    this.polling = null;
    this.pollTimer = null;
    this.confirmTimers = new Map();
    this.stopped = false;
    /** Problems already logged, by key: repeats go to debug. */
    this.warned = new Set();
  }

  // --- Logs ------------------------------------------------------------------
  // Info keeps the lifecycle only (cloud connected, lost, back, modules going
  // offline, user commands). A problem that repeats every cycle is logged once,
  // then at debug until it clears. LOG_LEVEL=debug shows everything.

  problem(key, message, level = 'warn') {
    if (this.warned.has(key)) {
      logger.debug(message);
      return;
    }
    this.warned.add(key);
    logger[level](message);
  }

  resolved(key, message) {
    if (this.warned.delete(key) && message) {
      logger.info(message);
    }
  }

  // --- Lifecycle -------------------------------------------------------------

  async start(config) {
    await this.reconfigure(config);
  }

  /** Gladys reconnected (it restarted): send everything again. */
  async resync(config) {
    this.devicesKey = null;
    this.transports.clear();
    this.connection = null;
    this.gladys.forgetPublishedStates();
    await this.reconfigure(config);
  }

  async reconfigure(config) {
    const changedAccount = signature(config) !== this.signature;
    this.config = config;
    if (changedAccount) {
      this.signature = signature(config);
      this.client =
        config.email && config.password
          ? new HeatzyClient({
              email: config.email,
              password: config.password,
              request: this.request,
              now: this.now,
            })
          : null;
      this.modules.clear();
      this.cloud = { read: false, error: null };
      this.devicesKey = null;
      this.warned.clear();
    }
    if (!this.client) {
      clearTimeout(this.pollTimer);
      await this.publishDevices();
      await this.publishConnectionStatus();
      return;
    }
    await this.pollNow();
  }

  async stop() {
    this.stopped = true;
    clearTimeout(this.pollTimer);
    for (const timer of this.confirmTimers.values()) {
      clearTimeout(timer);
    }
    await this.polling?.catch(() => {});
  }

  /** Read now, then schedule the next reading. */
  async pollNow() {
    await this.poll();
    this.schedulePoll();
  }

  schedulePoll() {
    clearTimeout(this.pollTimer);
    if (!this.timersEnabled || this.stopped || !this.client) {
      return;
    }
    const kind = this.cloud.error?.kind;
    if (kind === ERROR_KINDS.AUTH) {
      // Logging in again and again with a refused password could lock the
      // account: wait for a new configuration (or "Test the connection").
      return;
    }
    const delay =
      kind === ERROR_KINDS.RATE_LIMITED
        ? Math.max(this.timings.rateLimitBackoffMs, this.config.pollIntervalMs)
        : this.config.pollIntervalMs;
    this.pollTimer = setTimeout(() => {
      this.pollNow().catch((err) =>
        this.problem('poll', `Reading failed: ${err.message}`, 'error'),
      );
    }, delay);
  }

  // --- Reading the cloud ---------------------------------------------------------

  /** Read the module list and every module. Concurrent calls share the reading. */
  poll() {
    this.polling ??= this.read().finally(() => {
      this.polling = null;
    });
    return this.polling;
  }

  async read() {
    const client = this.client;
    if (!client) {
      return;
    }
    let bindings;
    try {
      bindings = await client.getBindings();
    } catch (err) {
      if (!err.kind) {
        throw err;
      }
      if (client === this.client) {
        await this.applyCloudFailure(err);
      }
      return;
    }
    const readings = [];
    for (const binding of bindings) {
      if (binding.is_online === false) {
        readings.push({ binding, attrs: null });
        continue;
      }
      try {
        readings.push({ binding, attrs: await client.getAttributes(binding.did) });
        this.resolved(`read:${binding.did}`);
      } catch (err) {
        if (!err.kind) {
          throw err;
        }
        this.problem(`read:${binding.did}`, `Module ${binding.did}: ${err.message}`);
        readings.push({ binding, attrs: null, error: err });
      }
    }
    if (client !== this.client || this.stopped) {
      return; // the account changed while reading
    }
    await this.applyReadings(readings);
  }

  async applyCloudFailure(err) {
    const previous = this.cloud.error?.kind;
    this.cloud = { read: true, error: { kind: err.kind, message: err.message } };
    if (previous !== err.kind) {
      logger.warn(`Heatzy cloud: ${err.message}`);
    } else {
      logger.debug(`Heatzy cloud: ${err.message} (again)`);
    }
    await this.publishConnectionStatus();
    if (previous !== err.kind) {
      this.gladys.requestWidgetRefresh(WIDGET_KEY);
    }
  }

  async applyReadings(readings) {
    const wasError = this.cloud.error;
    const firstReading = !this.cloud.read;
    this.cloud = { read: true, error: null };
    if (wasError) {
      logger.info('Heatzy cloud: connection restored');
    } else if (firstReading) {
      logger.info(`Connected to Heatzy: ${readings.length} module(s)`);
    }
    let widgetChanged = Boolean(wasError) || firstReading;
    const seen = new Set();
    for (const { binding, attrs } of readings) {
      seen.add(binding.did);
      const previous = this.modules.get(binding.did);
      let next = parseModule(binding, attrs);
      if (!next.read && previous?.read) {
        // Offline or unreadable: keep the last known values.
        next = {
          ...previous,
          name: next.name,
          online: next.online,
        };
      }
      next.ownChangeUntil = previous?.ownChangeUntil ?? 0;
      widgetChanged ||= await this.transitions(previous, next);
      this.modules.set(binding.did, next);
    }
    for (const did of [...this.modules.keys()]) {
      if (!seen.has(did)) {
        this.modules.delete(did); // removed from the account
        widgetChanged = true;
      }
    }
    await this.publishDevices();
    for (const module of this.modules.values()) {
      await this.publishStates(module);
    }
    await this.publishTransports();
    await this.publishConnectionStatus();
    if (widgetChanged) {
      this.gladys.requestWidgetRefresh(WIDGET_KEY);
    }
  }

  /** Scene events of a module between two readings; resolves whether the widget changed. */
  async transitions(previous, next) {
    if (!previous) {
      return true;
    }
    let changed = previous.name !== next.name;
    if (previous.online && !next.online) {
      logger.info(`${moduleName(next)} is offline`);
      await this.fire(TRIGGERS.OFFLINE, next, {});
      changed = true;
    } else if (!previous.online && next.online) {
      logger.info(`${moduleName(next)} is back online`);
      await this.fire(TRIGGERS.ONLINE, next, {});
      changed = true;
    }
    if (next.read && previous.mode !== null && next.mode !== null && previous.mode !== next.mode) {
      changed = true;
      // A change Gladys asked for is not announced: a scene reacting to it
      // could loop through the integration. The core's own device trigger
      // still sees it.
      if (this.now() >= next.ownChangeUntil) {
        await this.fire(TRIGGERS.MODE_CHANGED, next, {
          mode: MODE_KEYS[next.mode],
          previous_mode: MODE_KEYS[previous.mode],
          programming: next.programming === 1,
        });
      }
    }
    changed ||=
      previous.derogation !== next.derogation ||
      previous.derogationTime !== next.derogationTime ||
      previous.temperature !== next.temperature ||
      previous.programming !== next.programming;
    return changed;
  }

  async fire(key, module, data) {
    try {
      await this.gladys.publishSceneEvent(key, {
        device: deviceIds(this.gladys, module.did).device,
        radiator: moduleName(module),
        ...data,
      });
      this.resolved('scene-event');
    } catch (err) {
      this.problem('scene-event', `Scene event ${key} refused: ${err.message}`);
    }
  }

  // --- Publishing to Gladys ----------------------------------------------------------

  async publishDevices() {
    const devices = [...this.modules.values()].map((module) =>
      buildDevice(this.gladys, module, this.config.language),
    );
    const key = JSON.stringify(devices);
    if (key === this.devicesKey) {
      return;
    }
    try {
      // Even an empty list: the Discovery tab then shows no stale module.
      await this.gladys.publishDiscoveredDevices(devices);
      this.devicesKey = key;
      this.resolved('devices');
    } catch (err) {
      this.problem('devices', `Discovered devices refused: ${err.message}`);
    }
  }

  async publishStates(module) {
    const states = moduleStates(this.gladys, module);
    if (states.length === 0) {
      return;
    }
    try {
      await this.gladys.publishChangedStates(states, { heartbeat: this.timings.heartbeatMs });
      this.resolved('states');
    } catch (err) {
      this.problem('states', `States of ${moduleName(module)} refused: ${err.message}`);
    }
  }

  async publishTransports() {
    const entries = [];
    for (const module of this.modules.values()) {
      const externalId = deviceIds(this.gladys, module.did).device;
      const transport = module.online ? DEVICE_TRANSPORTS.CLOUD : DEVICE_TRANSPORTS.UNREACHABLE;
      if (this.transports.get(externalId) !== transport) {
        entries.push({ external_id: externalId, transport });
      }
    }
    if (entries.length === 0) {
      return;
    }
    try {
      await this.gladys.publishTransports(entries);
      for (const entry of entries) {
        this.transports.set(entry.external_id, entry.transport);
      }
      this.resolved('transports');
    } catch (err) {
      this.problem('transports', `Transports refused: ${err.message}`);
    }
  }

  /** The status under the integration name. */
  connectionStatus() {
    if (!this.client) {
      return { connected: false, message: CONNECTION_TEXT.noAccount };
    }
    if (this.cloud.error) {
      return { connected: false, message: ERROR_TEXT[this.cloud.error.kind] };
    }
    if (this.cloud.read && this.modules.size === 0) {
      return { connected: true, message: CONNECTION_TEXT.noModule };
    }
    return { connected: true };
  }

  async publishConnectionStatus() {
    const status = this.connectionStatus();
    const key = JSON.stringify(status);
    if (key === this.connection) {
      return;
    }
    try {
      await this.gladys.setConnectionStatus(status.connected, status.message);
      this.connection = key;
      this.resolved('connection-status');
    } catch (err) {
      this.problem('connection-status', `Connection status refused: ${err.message}`);
    }
  }

  /** The user added a device: its states sent before were dropped by Gladys. */
  async onDeviceCreated(device) {
    const did = didOf(this.gladys, device.external_id);
    const module = did === null ? null : this.modules.get(did);
    if (!module) {
      return;
    }
    this.gladys.forgetPublishedStates(device.external_id);
    await this.publishStates(module);
    this.gladys.requestWidgetRefresh(WIDGET_KEY);
  }

  // --- Commands --------------------------------------------------------------------------

  /**
   * The modules a command targets: one device, or every module of the account.
   * @param {string|null|undefined} deviceExternalId
   */
  targets(deviceExternalId) {
    const language = this.config?.language;
    if (this.modules.size === 0) {
      throw new Error(pick(ACTION_TEXT.noModule, language));
    }
    if (!deviceExternalId) {
      return [...this.modules.values()];
    }
    const did = didOf(this.gladys, deviceExternalId);
    const module = did === null ? null : this.modules.get(did);
    if (!module) {
      throw new Error(pick(ACTION_TEXT.unknownModule, language));
    }
    return [module];
  }

  /**
   * Send a command built by `build(module)` to the targeted modules.
   * Resolves with the number of modules that accepted it; throws when none did.
   */
  async command(deviceExternalId, build, describe) {
    const language = this.config.language;
    const targets = this.targets(deviceExternalId);
    const single = targets.length === 1;
    let done = 0;
    let lastError = null;
    for (const module of targets) {
      let payload;
      try {
        payload = build(module);
      } catch (err) {
        if (!(err instanceof UnsupportedCommand)) {
          throw err;
        }
        // Commanding every radiator skips the modules that cannot do it.
        lastError = err;
        continue;
      }
      try {
        await this.client.control(module.did, payload);
      } catch (err) {
        if (!err.kind) {
          throw err;
        }
        logger.warn(`${moduleName(module)}: command failed: ${err.message}`);
        lastError = err;
        continue;
      }
      done += 1;
      logger.info(`${moduleName(module)}: ${describe}`);
      const next = applyCommand(module, payload);
      next.ownChangeUntil = this.now() + this.timings.ownChangeMs;
      this.modules.set(module.did, next);
      await this.publishStates(next);
      this.scheduleConfirm(module.did);
    }
    this.gladys.requestWidgetRefresh(WIDGET_KEY);
    if (done === 0) {
      throw new Error(this.errorText(lastError, single ? targets[0] : null, language));
    }
    return done;
  }

  errorText(err, module, language) {
    let text;
    if (err instanceof UnsupportedCommand) {
      text = pick(
        err.reason === 'mode'
          ? ACTION_TEXT.unsupportedMode
          : err.reason === 'vacation'
            ? ACTION_TEXT.unsupportedVacation
            : ACTION_TEXT.unsupported,
        language,
      );
    } else if (err?.kind) {
      text = pick(ERROR_TEXT[err.kind], language);
    } else {
      text = pick(ACTION_TEXT.failed, language);
    }
    return (module ? labelled(moduleName(module), text, language) : text).slice(0, 200);
  }

  /** Read again shortly after a command, to publish what the module really did. */
  scheduleConfirm(did) {
    clearTimeout(this.confirmTimers.get(did));
    if (!this.timersEnabled || this.stopped) {
      return;
    }
    const timer = setTimeout(() => {
      this.confirmTimers.delete(did);
      this.poll().catch((err) =>
        this.problem('confirm', `Reading failed: ${err.message}`, 'error'),
      );
    }, this.timings.confirmMs);
    timer.unref?.();
    this.confirmTimers.set(did, timer);
  }

  /** Pilot-wire mode on one module or all of them. */
  setMode(deviceExternalId, mode) {
    if (MODE_KEYS[mode] === undefined) {
      throw new Error(pick(ACTION_TEXT.unknownMode, this.config.language));
    }
    return this.command(
      deviceExternalId,
      (module) => modeCommand(module, mode),
      `mode ${MODE_KEYS[mode]}`,
    );
  }

  /** Vacation for `days` days (frost protection, then back to the programme). */
  startVacation(deviceExternalId, days) {
    if (!Number.isInteger(days) || days < 1 || days > MAX_VACATION_DAYS) {
      throw new Error(pick(ACTION_TEXT.badDays, this.config.language));
    }
    return this.command(
      deviceExternalId,
      (module) => vacationCommand(module, days),
      `vacation for ${days} day(s)`,
    );
  }

  /** End the vacation (or any boost) in progress. */
  stopVacation(deviceExternalId) {
    return this.command(deviceExternalId, (module) => vacationCommand(module, 0), 'vacation ended');
  }

  /** A feature of a device was set in Gladys (dashboard, widget button, scene). */
  async setValue(device, feature, value) {
    const did = didOf(this.gladys, device.external_id);
    const key = did === null ? null : featureKeyOf(this.gladys, did, feature.external_id);
    const number = Number(value);
    if (key === FEATURE_KEYS.MODE) {
      await this.setMode(device.external_id, number);
      return;
    }
    if (key === FEATURE_KEYS.LOCK || key === FEATURE_KEYS.PROGRAMMING) {
      const which = key === FEATURE_KEYS.LOCK ? 'lock' : 'programming';
      await this.command(
        device.external_id,
        (module) => switchCommand(module, which, number === 1),
        `${which} ${number === 1 ? 'on' : 'off'}`,
      );
      return;
    }
    throw new Error(`Feature ${feature.external_id} cannot be controlled`);
  }

  // --- Reports -------------------------------------------------------------------------------

  /** "Test the connection": read the cloud now (even after a refused password). */
  async testConnection() {
    await this.pollNow();
    const message = {};
    for (const [language, text] of Object.entries(REPORT_TEXT)) {
      const status = this.connectionStatus();
      if (!status.connected || this.modules.size === 0) {
        message[language] = pick(status.message, language);
        continue;
      }
      const lines = [text.found(this.modules.size)];
      for (const module of this.modules.values()) {
        lines.push(
          `- ${moduleName(module)} (${module.productName ?? module.capabilities.model})${module.online ? '' : `, ${text.offline}`}`,
        );
      }
      message[language] = lines.join('\n');
    }
    return message;
  }
}
