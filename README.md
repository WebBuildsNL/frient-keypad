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

## Access Code Management

You can store a list of valid access codes with date ranges. This is ideal for vacation rentals — give each guest a unique code that only works during their stay.

### How validation works

- **No codes configured** — all entered codes are rejected (red LED). Add at least one code to enable access.
- **Codes configured** — only codes matching a stored entry whose date range includes today are accepted (green LED). All other codes are rejected (red LED).

### Managing codes via the Settings page

1. Open the Homey app → More → Apps → Frient Keypad Code Reader → Settings.
2. You'll see a table of current codes with their status (Active, Upcoming, Expired).
3. Fill in the form at the bottom to add a new code:
   - **Name** — label to identify the code (e.g. "Guest 1")
   - **PIN Code** — the digits the user will enter on the keypad
   - **Valid from / until** — the date range the code is active
   - **Reference ID** (optional) — an external identifier for your own reference (e.g. a booking ID like `BOOK-12345`)
4. Click **Add Code**. The code takes effect immediately.
5. Click **Delete** on any row to remove a code.

### Managing codes via the API

The app exposes REST endpoints for programmatic code management. Authenticate with a Homey API Bearer token (get one from [Homey Developer Tools](https://tools.developer.homey.app)).

**Finding your Homey address:**
- **Local IP** — Open the Homey mobile app → More → Settings → General. You can also try `homey.local` (mDNS) or check your router's DHCP client list.
- **Cloud URL** — Use `https://<cloud-id>.connect.athom.com` instead of the local IP. Find your Cloud ID in the Homey Developer Tools.

**List all codes:**
```bash
curl http://<homey>/api/app/com.frient.keypad.coderead/codes \
  -H "Authorization: Bearer <token>"
```

**Add a code:**
```bash
curl -X POST http://<homey>/api/app/com.frient.keypad.coderead/codes \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Guest 1",
    "code": "1234",
    "from": "2026-03-01",
    "till": "2026-03-15",
    "reference_id": "BOOK-12345"
  }'
```

**Delete a code (by index):**
```bash
curl -X DELETE "http://<homey>/api/app/com.frient.keypad.coderead/codes?index=0" \
  -H "Authorization: Bearer <token>"
```

All endpoints return the updated codes array. Each code object includes a `reference_id` field (defaults to `null` when not provided) that you can use to link codes to external systems like booking platforms.

## Flow Cards

### Triggers (When...)
- **A code was entered** — Fires whenever someone enters a code + presses arm/disarm. Tokens: `code` (string), `action` (string), `zone_id` (number), `code_valid` (boolean), `code_name` (string)
- **Emergency button pressed** — Fires when the SOS button is pressed

### Conditions (And...)
- **The entered code is/is not valid** — Check if the last entered code exists in the stored access codes and is within its valid date range
- **Last entered code is/is not ...** — Check if the last entered code matches a specific value
- **Action is/is not ...** — Check which button was pressed (disarm, arm day, arm night, arm all)

### Actions (Then...)
- **Accept the entered code** — Confirms the code on the keypad (green LED)
- **Reject the entered code** — Rejects the code on the keypad (red LED)
- **Set keypad mode to ...** — Send a mode change to the keypad (disarm, arm day, arm night, arm all)

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
- The `code` token in the flow is the **raw string** entered on the keypad.

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
