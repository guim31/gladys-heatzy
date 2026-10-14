// -----------------------------------------------------------------------------
// One Gladys device per Heatzy module.
//
// Identity: the Gizwits device id (`did`), stable for the life of the module
// on the account. The name typed in the Heatzy app is the device name.
//
// Features (category/type couples of the core table, see
// test/gladys-rules.test.js):
//   - mode: heater/pilot-wire-mode, writable — the core's own pilot-wire
//     selector (0 off, 1 frost protection, 2 eco, 3 comfort -1, 4 comfort -2,
//     5 comfort). Gladys exposes this couple to no voice assistant and to no
//     thermostat card: a mode is only changed by an explicit choice;
//   - child lock: child-lock/binary, writable, on the modules that have one;
//   - weekly programme: switch/binary, writable — 1 the module follows the
//     programme set in the Heatzy app, 0 it keeps the chosen mode;
//   - room temperature (Glow, Onyx, Inea, Bloom, Pilote Pro) and humidity
//     (Pilote Pro): read only. The comfort and eco setpoints of these models
//     are not published: a writable setpoint would be taken for a thermostat
//     by HomeKit and the voice assistants, which a pilot wire is not.
//
// The devices are published with should_poll: false: the integration reads
// the cloud on its own timer (src/hub.js), at the interval of the configuration.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';
import { PILOT_WIRE } from './heatzy/model.js';

export const DEVICE_TYPE = 'module';

// Suffixes of the feature external ids: permanent once published.
export const FEATURE_KEYS = Object.freeze({
  MODE: 'mode',
  LOCK: 'lock',
  PROGRAMMING: 'programming',
  TEMPERATURE: 'temperature',
  HUMIDITY: 'humidity',
});

// Feature names, in the language chosen in the configuration (Gladys does not
// tell a device integration the user's language). Frozen at creation in Gladys.
export const NAMES = {
  en: {
    [FEATURE_KEYS.MODE]: 'Pilot wire mode',
    [FEATURE_KEYS.LOCK]: 'Child lock',
    [FEATURE_KEYS.PROGRAMMING]: 'Weekly programme',
    [FEATURE_KEYS.TEMPERATURE]: 'Room temperature',
    [FEATURE_KEYS.HUMIDITY]: 'Humidity',
  },
  fr: {
    [FEATURE_KEYS.MODE]: 'Mode fil pilote',
    [FEATURE_KEYS.LOCK]: 'Verrouillage',
    [FEATURE_KEYS.PROGRAMMING]: 'Programmation',
    [FEATURE_KEYS.TEMPERATURE]: 'Température ambiante',
    [FEATURE_KEYS.HUMIDITY]: 'Humidité',
  },
  de: {
    [FEATURE_KEYS.MODE]: 'Steuerdraht-Modus',
    [FEATURE_KEYS.LOCK]: 'Kindersicherung',
    [FEATURE_KEYS.PROGRAMMING]: 'Wochenprogramm',
    [FEATURE_KEYS.TEMPERATURE]: 'Raumtemperatur',
    [FEATURE_KEYS.HUMIDITY]: 'Luftfeuchtigkeit',
  },
  es: {
    [FEATURE_KEYS.MODE]: 'Modo hilo piloto',
    [FEATURE_KEYS.LOCK]: 'Bloqueo infantil',
    [FEATURE_KEYS.PROGRAMMING]: 'Programación semanal',
    [FEATURE_KEYS.TEMPERATURE]: 'Temperatura ambiente',
    [FEATURE_KEYS.HUMIDITY]: 'Humedad',
  },
};

const binary = (category, type) => ({
  category,
  type,
  read_only: false,
  has_feedback: true,
  keep_history: true,
  min: 0,
  max: 1,
});

const FEATURES = [
  {
    key: FEATURE_KEYS.MODE,
    applies: () => true,
    definition: {
      category: DEVICE_FEATURE_CATEGORIES.HEATER,
      type: DEVICE_FEATURE_TYPES.HEATER.PILOT_WIRE_MODE,
      read_only: false,
      has_feedback: true,
      keep_history: true,
      min: PILOT_WIRE.OFF,
      max: PILOT_WIRE.COMFORT,
    },
    value: (module) => module.mode,
  },
  {
    key: FEATURE_KEYS.LOCK,
    applies: (capabilities) => Boolean(capabilities.lock),
    definition: binary(
      DEVICE_FEATURE_CATEGORIES.CHILD_LOCK,
      DEVICE_FEATURE_TYPES.CHILD_LOCK.BINARY,
    ),
    value: (module) => module.lock,
  },
  {
    key: FEATURE_KEYS.PROGRAMMING,
    applies: (capabilities) => Boolean(capabilities.programming),
    definition: binary(DEVICE_FEATURE_CATEGORIES.SWITCH, DEVICE_FEATURE_TYPES.SWITCH.BINARY),
    value: (module) => module.programming,
  },
  {
    key: FEATURE_KEYS.TEMPERATURE,
    applies: (capabilities) => Boolean(capabilities.temperature),
    definition: {
      category: DEVICE_FEATURE_CATEGORIES.TEMPERATURE_SENSOR,
      type: DEVICE_FEATURE_TYPES.SENSOR.DECIMAL,
      unit: DEVICE_FEATURE_UNITS.CELSIUS,
      read_only: true,
      has_feedback: false,
      keep_history: true,
      min: -10,
      max: 50,
    },
    value: (module) => module.temperature,
  },
  {
    key: FEATURE_KEYS.HUMIDITY,
    applies: (capabilities) => Boolean(capabilities.humidity),
    definition: {
      category: DEVICE_FEATURE_CATEGORIES.HUMIDITY_SENSOR,
      type: DEVICE_FEATURE_TYPES.SENSOR.DECIMAL,
      unit: DEVICE_FEATURE_UNITS.PERCENT,
      read_only: true,
      has_feedback: false,
      keep_history: true,
      min: 0,
      max: 100,
    },
    value: (module) => module.humidity,
  },
];

/** External ids of a module's device and features. */
export const deviceIds = (gladys, did) => gladys.externalIds(DEVICE_TYPE, did);

/** The did of a device external id, null when it is not one of ours. */
export function didOf(gladys, externalId) {
  const prefix = deviceIds(gladys, 'x').device.slice(0, -1);
  if (typeof externalId !== 'string' || !externalId.startsWith(prefix)) {
    return null;
  }
  const did = externalId.slice(prefix.length);
  return did && !did.includes(':') ? did : null;
}

/** The name shown for a module: its name in the Heatzy app, else its model. */
export const moduleName = (module) => module.name ?? `Heatzy ${module.model}`;

/**
 * The discovery payload of a module.
 * @param {object} gladys SDK client
 * @param {object} module parsed module (src/heatzy/model.js parseModule)
 * @param {string} language feature names language
 */
export function buildDevice(gladys, module, language = 'fr') {
  const ids = deviceIds(gladys, module.did);
  const names = NAMES[language] ?? NAMES.fr;
  return {
    name: moduleName(module),
    external_id: ids.device,
    should_poll: false,
    params: [{ name: 'MODEL', value: module.model }],
    features: FEATURES.filter(({ applies }) => applies(module.capabilities)).map(
      ({ key, definition }) => ({
        ...definition,
        name: names[key],
        external_id: ids.feature(key),
      }),
    ),
  };
}

/**
 * The states of a module's features (null values skipped).
 * @returns {Array<{ device_feature_external_id: string, state: number }>}
 */
export function moduleStates(gladys, module) {
  const ids = deviceIds(gladys, module.did);
  return FEATURES.filter(({ applies }) => applies(module.capabilities))
    .map(({ key, value }) => ({
      device_feature_external_id: ids.feature(key),
      state: value(module),
    }))
    .filter(({ state }) => typeof state === 'number' && Number.isFinite(state));
}

/** The feature key of a feature external id of a module. */
export function featureKeyOf(gladys, did, featureExternalId) {
  const ids = deviceIds(gladys, did);
  return Object.values(FEATURE_KEYS).find((key) => ids.feature(key) === featureExternalId) ?? null;
}
