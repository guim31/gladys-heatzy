# Heatzy fixtures

Real devices from the test fixtures of
[hass-heatzy](https://github.com/Cyr-ius/hass-heatzy)
(`tests/fixtures/Devices.json`, MIT, © 2019 Cédric Levasseur), one file per
module: `binding` is the entry of `GET /app/bindings`, `latest` the answer of
`GET /app/devdata/<did>/latest` (`attr`).

Anonymized: the device ids (`did`), the MAC addresses, the passcodes and the
MQTT hosts are invented; the names are French room names. The attributes are
untouched.

| File            | Module        | Product key                        |
| --------------- | ------------- | ---------------------------------- |
| pilote-v1.json  | Pilote v1     | `9420ae048da545c88fc6274d204dd25f` |
| pilote-v2.json  | Pilote 2      | `51d16c22a5f74280bc3cfe9ebcdc6402` |
| pilote-v3.json  | Pilote SoC    | `b9a67b6ce24b437d9794103fd317e627` |
| pilote-v4.json  | Pilote SoC C3 | `46409c7f29d4411c85a3a46e5ee3703e` |
| pilote-pro.json | Pilote Pro    | `a77a929fcf0d4631bc4f669080376891` |
| glow.json       | Glow Simple   | `2fd622e45283470f9e27e8e6167d7533` |
| onyx.json       | Onyx          | `bb10d064f8de409db633b750faa22a52` |
| bloom.json      | Bloom         | `480253852d574f11b2d7fbf4460d7a41` |

`real/`: answers of the real Gizwits cloud, captured on 14/10/2026 from the
locked container with an invented account (no real account was used).
