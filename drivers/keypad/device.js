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
      return;
    }

    // Bind IAS ACE cluster (0x0501) to receive arm commands with PIN codes
    this._iasAceBoundCluster = new IasAceBoundCluster({
      onArm: async ({ action, code, zoneId }) => {
        this._lastCode = code;
        this._lastAction = action;
        await this.setStoreValue('currentAction', action);
        await this._triggerCodeEntered({ code, action, zoneId });
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
        } catch (err) {
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
      } catch (err) {
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
      } catch (err) {
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

    this.homey.flow.getActionCard('set_keypad_mode')
      .registerRunListener(async (args) => {
        this._iasAceBoundCluster._currentAction = args.mode;
        await this.setStoreValue('currentAction', args.mode);
      });
  }

  async _triggerCodeEntered({ code, action, zoneId }) {
    try {
      await this._codeEnteredTrigger.trigger(this, { code, action, zone_id: zoneId });
    } catch (err) {
      this.error('Failed to trigger keypad_code_entered:', err);
    }
  }

  async _triggerEmergency() {
    try {
      await this._emergencyTrigger.trigger(this, {});
    } catch (err) {
      this.error('Failed to trigger keypad_emergency:', err);
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
