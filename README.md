# Frient Keypad Code Reader

A Homey app that reads the actual PIN code entered on a **Frient/Develco KEPZB-110 Intelligent Keypad** and exposes it as a Flow token.

## Why this app?

The official frient Homey app only exposes arm/disarm state changes — it does **not** reveal which PIN code was entered. This app listens to the raw Zigbee IAS ACE `arm` command on endpoint 44 (cluster 0x0501), which includes the `armDisarmCode` field containing the actual digits typed by the user.

## How it works

The Frient keypad communicates over Zigbee using the **IAS ACE** (Intruder Alarm System - Ancillary Control Equipment) cluster. When a user types a code and presses an arm/disarm button, the keypad sends an `arm` command with this payload:

- `armMode` — 0: disarm, 1: arm day, 2: arm night, 3: arm all
- `armDisarmCode` — the PIN code string (e.g., `"1234"`)
- `zoneId` — zone identifier (default: 23)

This app implements a **BoundCluster** on that IAS ACE cluster to intercept these commands and extract the code.

## Flow Cards

### Triggers (When...)
- **A code was entered** — Fires whenever someone enters a code + presses arm/disarm. Tokens: `code` (string), `action` (string), `zone_id` (number)
- **Emergency button pressed** — Fires when the SOS button is pressed

### Conditions (And...)
- **Last entered code is/is not ...** — Check if the last entered code matches a value

### Actions (Then...)
- **Set keypad mode to ...** — Send a mode change to the keypad (disarm, arm day, arm night, arm all). Updates the keypad's LED state.

## Installation (Development)

1. Install the [Homey CLI](https://apps.developer.homey.app/the-basics/getting-started/homey-cli):
   ```
   npm install -g homey
   ```

2. Clone/download this app and install dependencies:
   ```
   cd keypad-app
   npm install
   ```

3. Run on your Homey Pro:
   ```
   homey app run
   ```

4. Or install permanently:
   ```
   homey app install
   ```

## Important Notes

- **You must remove the keypad from the official frient app first** (or it won't pair with this app since a Zigbee device can only be paired to one app at a time).
- After pairing, the keypad should start sending arm commands with PIN codes.
- The `code` token in the flow is the **raw string** entered on the keypad. You are responsible for validating it in your flows (e.g., compare it to a known code using the condition card or a logic card).

## Security Considerations

The PIN code is exposed as a plaintext flow token. Be mindful of:
- Don't log codes in production
- Use the code only for comparison (e.g., "if code is 1234 then unlock door")
- Consider using multiple codes for different users/actions

## Supported Devices

| Model | Manufacturer | Description |
|-------|-------------|-------------|
| KEPZB-110 | frient A/S | Intelligent Keypad |
| KEYZB-110 | Develco Products A/S | Keypad (same hardware) |

## Technical Details

- **Endpoint**: 44 (0x2C)
- **IAS ACE Cluster**: 0x0501 (output cluster on the keypad, we bind as server)
- **IAS Zone Cluster**: 0x0500 (for enrollment)
- **Power Configuration**: 0x0001 (battery reporting)
