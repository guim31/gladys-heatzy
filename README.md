# Heatzy for Gladys Assistant

A [Gladys Assistant](https://gladysassistant.com) external integration for the
[Heatzy](https://heatzy.com) pilot wire modules (_fil pilote_): set the mode of
each electric radiator from Gladys, its dashboards and its scenes.

> **Developed without the hardware: feedback welcome.** The integration was
> built and tested against a simulated Heatzy cloud fed with the real devices
> of the [hass-heatzy](https://github.com/Cyr-ius/hass-heatzy) test fixtures,
> not with a real Heatzy account. Please report what works and what does not on
> the [Gladys forum](https://community.gladysassistant.com) or in the
> [issues](https://github.com/guim31/gladys-heatzy/issues).

## Features

- **One device per module** of the Heatzy account, named as in the Heatzy app:
  - **pilot wire mode** with the core's own selector (`heater/pilot-wire-mode`):
    Comfort, Comfort -1°C, Comfort -2°C, Eco, Frost protection, Off;
  - **child lock** and **weekly programme** switches (on the modules that have
    them);
  - **room temperature** (Glow, Onyx, Inea, Bloom, Pilote Pro) and **humidity**
    (Pilote Pro), read only.
- **Dashboard widget** _Heatzy radiators_: the mode of every radiator (or of
  one) with Comfort, Eco, Frost protection and Off buttons, Off behind a
  confirmation.
- **Scene triggers**: radiator mode changed outside Gladys (Heatzy app,
  programme, module button), module offline, module back online.
- **Scene actions**: set the mode of one radiator or all of them, start the
  vacation mode for 1 to 255 days, end it.
- Device badge **Cloud** / **Unreachable** following the connection of each
  module; English, French, German and Spanish everywhere.

Supported modules: Pilote v1, v2, v3 (and Elec Pro), v4, Pilote Pro, Glow,
Onyx, Inea, Bloom. A module unknown to the integration is handled with the
common protocol of the recent modules.

### Safety choices

A pilot wire is not a thermostat, and an unheated house in winter is a real
risk. So: the mode is published as `heater/pilot-wire-mode`, which Gladys
exposes to no voice assistant and to no thermostat card; the comfort/eco
setpoints are not published (HomeKit and the assistants would take them for a
thermostat); Off is an explicit choice (device selector, scene action, widget
button with confirmation); frost protection is always available.

## Requirements

- Gladys Assistant **5.1.0** or later.
- A Heatzy account (e-mail and password of the Heatzy app) and an Internet
  connection: the modules are only reachable through the Gizwits cloud Heatzy
  uses (`euapi.gizwits.com`).

## Installation

1. In Gladys: **Integrations → Install from GitHub**, with the address
   `https://github.com/guim31/gladys-heatzy` (or from the catalog once listed).
2. In **Configuration**, enter the e-mail address and the password of the
   Heatzy account, save, then **Test the connection**.
3. Add the modules from the **Discovery** tab.

The user documentation is in [`docs/`](docs/en.md) (English, French, German,
Spanish), also shown by Gladys.

## How it works

- Login (`POST /app/login`) with the public Application Id of the Heatzy app,
  then the module list (`/app/bindings`, paginated) and the latest attributes
  of each module (`/app/devdata/<did>/latest`), on a timer of the container:
  every 1 to 10 minutes (2 by default). The devices are published with
  `should_poll: false`.
- Commands: `POST /app/control/<did>` with `{ attrs: { mode } }`, or the raw
  frame `[1, 1, n]` of the Pilote v1. A mode also ends a vacation in progress
  and turns the weekly programme off, so that it sticks. The new state is
  published at once (except on the Pilote Pro, which reports the mode it
  applies), then confirmed by a reading five seconds later.
- The token is kept in memory only and renewed when refused. Nothing is
  written to `/data`.
- A refused password stops the readings (so as not to lock the account) until
  the configuration changes; a "too many requests" answer pauses them ten
  minutes. The Gizwits WebSocket (real time) is not used: polling stays simple
  and gentle on the cloud.

## Limitations

- Cloud only, no local control (Heatzy offers no local API).
- Changes made outside Gladys show at the next reading.
- The weekly programme itself, the setpoints, the boost and the presence
  detection of the Pilote Pro stay in the Heatzy app.
- Developed without the hardware: the mode codes and attributes come from
  hass-heatzy and its real fixtures, not from a test on a real module.

## Development

```bash
npm ci
npm run format:check
npm run lint
npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

The tests use the fake Gladys of the SDK (`@gladysassistant/integration-sdk/testing`)
and a simulated Gizwits cloud (`test/helpers/fakeGizwits.js`) loaded with the
devices of `test/fixtures/heatzy/`. See [`CLAUDE.md`](CLAUDE.md) for the
project rules.

## Credits

- [hass-heatzy](https://github.com/Cyr-ius/hass-heatzy) by Cyr-ius (Cédric
  Levasseur), MIT: the product keys, the mode codes of each module generation,
  the attribute names, and the device fixtures of its tests (anonymized in
  `test/fixtures/heatzy/`).
- [heatzypy](https://github.com/Cyr-ius/heatzypy) by the same author (GPL-3.0)
  documents the Gizwits endpoints; no code was copied from it.
- The architecture and the conformity tests follow
  [gladys-wled](https://github.com/guim31/gladys-wled) and
  [gladys-pihole](https://github.com/guim31/gladys-pihole).

## Disclaimer

This project is not affiliated with, endorsed or sponsored by Heatzy or
Gizwits. "Heatzy" is a trademark of its owner.

## License

Apache-2.0
