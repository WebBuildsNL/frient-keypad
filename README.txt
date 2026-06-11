Frient Keypad Code Reader

Unlock the full potential of your Frient/Develco KEPZB-110 Intelligent Keypad in Homey Flows.

The official Frient app only tells you whether the keypad was armed or disarmed — it never reveals which PIN code was entered. This app fills that gap. It reads the actual code typed on the keypad and exposes it to Homey's Flow automation, so you can react to who entered a code, not just that one was entered.

KEY FEATURES

- Read the actual PIN code entered on the keypad as a Flow token.
- Trigger Flows on every code entry, with tokens for the code, the action (arm/disarm), the zone, whether the code is valid, and the code's name.
- Manage a list of valid access codes, each with its own date range — perfect for vacation rentals and temporary guest access.
- Automatic green/red LED feedback on the keypad based on whether the entered code is valid.
- Detect the emergency (SOS) button.
- Set the keypad mode (disarm, arm day, arm night, arm all) from a Flow.
- Battery level and tamper alarm reporting.
- Optional REST API for managing access codes from external systems (e.g. booking platforms).

ACCESS CODE MANAGEMENT

Store valid codes with a name and a valid-from/until date range on the app's settings page. Only codes that match a stored entry and fall within their active date range are accepted (green LED); everything else is rejected (red LED). Ideal for giving each guest a unique code that only works during their stay.

GETTING STARTED

1. Remove the keypad from the official Frient app first — a Zigbee device can only be paired with one app at a time.
2. Add the device in Homey and follow the pairing instructions.
3. Add your access codes on the app settings page, and build Flows using the keypad's trigger, condition, and action cards.

SUPPORTED DEVICES

- KEPZB-110 (frient A/S) — Intelligent Keypad
- KEYZB-110 (Develco Products A/S) — same hardware

SECURITY NOTE

PIN codes are exposed as plaintext Flow tokens. Use them for comparison in your Flows and avoid logging them.

This is an independent, community-built app and is not affiliated with or endorsed by Frient or Develco.
