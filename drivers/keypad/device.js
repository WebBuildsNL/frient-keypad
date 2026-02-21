'use strict';

const { ZigBeeDevice } = require('homey-zigbeedriver');
const { CLUSTER } = require('zigbee-clusters');

const IasAceBoundCluster = require('../../lib/IasAceBoundCluster');

class KeypadDevice extends ZigBeeDevice {

  async onNodeInit({ zclNode }) {
    this._zclNode = zclNode;
    this._lastCode = '';
    this._lastAction = this.getStoreValue('currentAction') || 'disarm';

    const endpoint = zclNode.endpoints[44];
    if (!endpoint) {
      this.error('Endpoint 44 not found on this device!');
      this.homey.app.writeLog('ERROR: Endpoint 44 not found on this device');
      await this.setUnavailable('Endpoint 44 not found — try re-pairing the device');
      return;
    }

    // Bind IAS ACE cluster (0x0501) to receive arm commands with PIN codes.
    // arm() responds immediately for LED feedback; flows handle automations.
    this._iasAceBoundCluster = new IasAceBoundCluster({
      endpoint,
      writeLog: (msg) => this.homey.app.writeLog(msg),
      validateCode: (code) => this.homey.app.validateCode(code),
      onArm: async ({ action, code, zoneId, valid, codeName, codeStatus }) => {
        this._lastCode = code;
        this._lastAction = action;
        this._lastCodeValid = valid;
        this._lastCodeStatus = codeStatus;
        await this.setStoreValue('currentAction', action);
        await this._triggerCodeEntered({ code, action, zoneId, code_valid: valid, code_name: codeName, code_status: codeStatus });
      },

      onEmergency: async () => {
        await this._triggerEmergency();
      },

      onFire: () => {},
      onPanic: () => {},
    });

    this._iasAceBoundCluster._currentAction = this._lastAction;
    endpoint.bind(CLUSTER.IAS_ACE.NAME, this._iasAceBoundCluster);

    // IAS Zone (cluster 0x0500) — enrollment + tamper alarm
    if (endpoint.clusters.iasZone) {
      endpoint.clusters.iasZone.onZoneEnrollRequest = () => {
        endpoint.clusters.iasZone.zoneEnrollResponse({
          enrollResponseCode: 0,
          zoneId: 23,
        });
      };

      endpoint.clusters.iasZone.on('attr.zoneStatus', (zoneStatus) => {
        this.setCapabilityValue('alarm_tamper', this._parseTamper(zoneStatus)).catch(this.error);
      });

      endpoint.clusters.iasZone.onZoneStatusChangeNotification = (payload) => {
        this.setCapabilityValue('alarm_tamper', this._parseTamper(payload.zoneStatus)).catch(this.error);
      };

      if (this.isFirstInit()) {
        try {
          await endpoint.clusters.iasZone.zoneEnrollResponse({
            enrollResponseCode: 0,
            zoneId: 23,
          });
        } catch (_err) {
          // May timeout if keypad is asleep — this is normal
        }
      }
    }

    // Battery reporting (cluster 0x0001)
    if (endpoint.clusters.powerConfiguration) {
      endpoint.clusters.powerConfiguration.on('attr.batteryPercentageRemaining', (value) => {
        const batteryPct = Math.round(value / 2);
        this.setCapabilityValue('measure_battery', batteryPct).catch(this.error);
        this.setCapabilityValue('alarm_battery', batteryPct < 10).catch(this.error);
      });

      try {
        const attrs = await endpoint.clusters.powerConfiguration.readAttributes(['batteryPercentageRemaining']);
        if (attrs.batteryPercentageRemaining !== undefined) {
          const batteryPct = Math.round(attrs.batteryPercentageRemaining / 2);
          this.setCapabilityValue('measure_battery', batteryPct).catch(this.error);
          this.setCapabilityValue('alarm_battery', batteryPct < 10).catch(this.error);
        }
      } catch (_err) {
        // Battery read may fail if keypad is asleep
      }

      try {
        await this.configureAttributeReporting([{
          endpointId: 44,
          cluster: CLUSTER.POWER_CONFIGURATION,
          attributeName: 'batteryPercentageRemaining',
          minInterval: 3600,
          maxInterval: 43200,
          minChange: 2,
        }]);
      } catch (_err) {
        // Battery reporting config may fail on some firmware versions
      }
    }

    this._registerFlowCards();
  }

  _registerFlowCards() {
    this._codeEnteredTrigger = this.homey.flow.getDeviceTriggerCard('keypad_code_entered');
    this._emergencyTrigger = this.homey.flow.getDeviceTriggerCard('keypad_emergency');

    this.homey.flow.getConditionCard('last_code_is')
      .registerRunListener(async (args) => args.code === this._lastCode);

    this.homey.flow.getConditionCard('action_is')
      .registerRunListener(async (args) => args.action === this._lastAction);

    this.homey.flow.getConditionCard('code_is_valid')
      .registerRunListener(async () => this._lastCodeValid === true);

    this.homey.flow.getConditionCard('code_status_is')
      .registerRunListener(async (args) => args.status === this._lastCodeStatus);

    this.homey.flow.getActionCard('set_keypad_mode')
      .registerRunListener(async (args) => {
        this._iasAceBoundCluster._currentAction = args.mode;
        await this.setStoreValue('currentAction', args.mode);
      });

    this.homey.flow.getActionCard('accept_code')
      .registerRunListener(async () => {
        this._iasAceBoundCluster._currentAction = this._lastAction;
        await this.setStoreValue('currentAction', this._lastAction);
      });

    this.homey.flow.getActionCard('reject_code')
      .registerRunListener(async () => {});
  }

  async _triggerCodeEntered({ code, action, zoneId, code_valid, code_name, code_status }) {
    try {
      const label = code_name || 'Unknown';
      this.log(`Code "${label}" used — action: ${action}, status: ${code_status}`);
      await this._codeEnteredTrigger.trigger(this, { code, action, zone_id: zoneId, code_valid, code_name, code_status });
    } catch (err) {
      this.error('Failed to trigger keypad_code_entered:', err);
      this.homey.app.writeLog(`ERROR: Failed to trigger keypad_code_entered: ${err.message}`);
    }
  }

  async _triggerEmergency() {
    try {
      this.log('Emergency button pressed');
      await this._emergencyTrigger.trigger(this, {});
    } catch (err) {
      this.error('Failed to trigger keypad_emergency:', err);
      this.homey.app.writeLog(`ERROR: Failed to trigger keypad_emergency: ${err.message}`);
    }
  }

  _parseTamper(zoneStatus) {
    if (Buffer.isBuffer(zoneStatus)) return !!(zoneStatus.readUInt16LE(0) & (1 << 2));
    if (typeof zoneStatus === 'number') return !!(zoneStatus & (1 << 2));
    // Bitmap object from zigbee-clusters — check for named 'tamper' bit
    if (zoneStatus && typeof zoneStatus === 'object') return !!zoneStatus.tamper;
    return false;
  }

  onDeleted() {
    this.log('Frient Keypad device deleted');
  }

}

module.exports = KeypadDevice;
