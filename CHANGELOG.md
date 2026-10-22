# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.1] - 2026-10-22

### Security

- Rebuilt on Node.js 24.22.1, the October 2026 security release (remote code
  execution in the Brotli decoder, CVE-2026-111497; TLS hostname and DNS
  fixes).

## [1.0.0] - 2026-10-14

### Added

- Heatzy pilot wire modules through the Heatzy cloud (Pilote v1 to v4, Pilote
  Pro, Glow, Onyx, Inea, Bloom): one device per module of the account, with
  its pilot wire mode (Comfort, Comfort -1°C, Comfort -2°C, Eco, Frost
  protection, Off), child lock, weekly programme, and the room temperature and
  humidity on the models that measure them.
- Dashboard widget _Heatzy radiators_: the mode of every radiator, with
  Comfort, Eco, Frost protection and Off buttons (Off asks for a confirmation).
- Scene triggers: radiator mode changed outside Gladys, module offline, module
  back online.
- Scene actions: set the mode of one radiator or all of them, start and end
  the vacation mode.
- "Test the connection" lists the modules of the account; refresh interval
  from 1 to 10 minutes; texts and documentation in English, French, German and
  Spanish.

[Unreleased]: https://github.com/guim31/gladys-heatzy/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/guim31/gladys-heatzy/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/guim31/gladys-heatzy/releases/tag/v1.0.0
