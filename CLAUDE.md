# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Homey App (SDK 3) that integrates the Frient/Develco KEPZB-110 Intelligent Keypad via Zigbee. It intercepts PIN codes entered on the keypad and exposes them through Homey's Flow automation system. The official Frient app does not expose keypad codes — this app fills that gap.

## Commands

- `npm run lint` — ESLint
- `npm start` — Run on Homey Pro in dev mode (`homey app run`)
- `npm run install-app` — Install permanently on Homey Pro (`homey app install`)

## Architecture

**Entry flow:** `app.js` → `drivers/keypad/driver.js` → `drivers/keypad/device.js`

- **app.js** — `Homey.App` entry point. Initializes the `codes` setting and provides `validateCode(code)` which checks entered codes against stored access codes + date ranges.
- **api.js** — REST API endpoints (`GET/POST/DELETE /codes`) for external code management.
- **drivers/keypad/driver.js** — Extends `ZigBeeDriver`, handles pairing.
- **drivers/keypad/device.js** — Core logic. Extends `ZigBeeDevice`. Binds the custom IAS ACE cluster on endpoint 44, registers all Flow card listeners (triggers, conditions, actions), manages device state (`_lastCode`, `_lastAction`, `_lastCodeValid`), and handles battery/tamper reporting.
- **lib/IasAceBoundCluster.js** — Custom `BoundCluster` subclass intercepting raw Zigbee IAS ACE commands (`arm`, `emergency`, `fire`, `panic`, `getPanelStatus`). Overrides `handleFrame()` to work around a zigbee-clusters bug in cluster-specific response framing. Uses `validateCode` callback to determine LED feedback (green=valid, red=invalid).
- **settings/index.html** — Settings page UI for managing access codes with date ranges.

**Flow cards** are defined in two places:
- `.homeycompose/flow/` — Modular source-of-truth JSON files for triggers, conditions, and actions.
- `app.json` — Generated/combined manifest that also contains Flow card definitions. Both must stay in sync.

**Flow card types:**
- Triggers: `keypad_code_entered` (tokens: code, action, zone_id, code_valid, code_name), `keypad_emergency`
- Conditions: `code_is_valid`, `last_code_is`, `action_is`
- Actions: `accept_code`, `reject_code`, `set_keypad_mode`

## Zigbee Details

- **Endpoint 44 (0x2C)** is the IAS ACE cluster endpoint on this keypad.
- The app binds a custom `IasAceBoundCluster` to cluster 0x0501 (IAS ACE) on this endpoint.
- PIN codes arrive in the `armDisarmCode` field of the `arm` command.
- `arm()` responds immediately with `armNotification` for LED feedback, then asynchronously fires Flow triggers.
- Battery (cluster 0x0001) reports values 0–200 which get mapped to 0–100%.
- Tamper detection uses IAS Zone (cluster 0x0500) status bit checking.

## Dependencies

- `homey-zigbeedriver` — Base classes `ZigBeeDriver` and `ZigBeeDevice`
- `zigbee-clusters` — Zigbee cluster definitions and ZCL types

## Key Constraints

- Requires Homey Pro >=12.0.0, platform: local.
- The device must be removed from the official Frient app before pairing with this app.
- PIN codes are passed as plaintext Flow tokens — security consideration for users.
