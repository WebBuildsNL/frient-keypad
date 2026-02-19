'use strict';

const { BoundCluster, Cluster } = require('zigbee-clusters');
const { ZCLDataTypes, ZCLStruct } = require('zigbee-clusters/lib/zclTypes');

/**
 * Register IAS ACE commands that are missing from the zigbee-clusters library.
 *
 * The zigbee-clusters library ships with an empty COMMANDS for IAS ACE (cluster 1281).
 * commandsById is built once during addCluster(), so we must populate it directly
 * with properly wrapped ZCLStruct args.
 */
const IASACECluster = Cluster.getCluster(1281);

const armCommand = {
  id: 0x00,
  name: 'arm',
  args: ZCLStruct('iasACE.arm', {
    armMode: ZCLDataTypes.enum8({
      disarm: 0,
      armDayZones: 1,
      armNightZones: 2,
      armAllZones: 3,
    }),
    armDisarmCode: ZCLDataTypes.string,
    zoneId: ZCLDataTypes.uint8,
  }),
  response: {
    id: 0x00,
    name: 'arm.response',
    isResponse: true,
    args: ZCLStruct('iasACE.arm.response', {
      armNotification: ZCLDataTypes.enum8({
        allZonesDisarmed: 0,
        onlyDayZonesArmed: 1,
        onlyNightZonesArmed: 2,
        allZonesArmed: 3,
        invalidCode: 4,
        notReadyToArm: 5,
        alreadyDisarmed: 6,
      }),
    }),
  },
};

const emergencyCommand = { id: 0x02, name: 'emergency' };
const fireCommand = { id: 0x03, name: 'fire' };
const panicCommand = { id: 0x04, name: 'panic' };

const getPanelStatusCommand = {
  id: 0x07,
  name: 'getPanelStatus',
  response: {
    id: 0x05,
    name: 'getPanelStatus.response',
    isResponse: true,
    args: ZCLStruct('iasACE.getPanelStatus.response', {
      panelStatus: ZCLDataTypes.enum8({
        panelDisarmed: 0,
        armedStay: 1,
        armedNight: 2,
        armedAway: 3,
        exitDelay: 4,
        entryDelay: 5,
        notReadyToArm: 6,
        inAlarm: 7,
        armingStay: 8,
        armingNight: 9,
        armingAway: 10,
      }),
      secondsRemaining: ZCLDataTypes.uint8,
      audibleNotification: ZCLDataTypes.enum8({
        mute: 0,
        defaultSound: 1,
      }),
      alarmStatus: ZCLDataTypes.enum8({
        noAlarm: 0,
        burglar: 1,
        fire: 2,
        emergency: 3,
        policePanic: 4,
        firePanic: 5,
        emergencyPanic: 6,
      }),
    }),
  },
};

// Inject into commandsById so BoundCluster.handleFrame can find them
IASACECluster.commandsById = IASACECluster.commandsById || {};
IASACECluster.commandsById[0x00] = [armCommand, armCommand.response];
IASACECluster.commandsById[0x02] = [emergencyCommand];
IASACECluster.commandsById[0x03] = [fireCommand];
IASACECluster.commandsById[0x04] = [panicCommand];
IASACECluster.commandsById[0x05] = [getPanelStatusCommand.response];
IASACECluster.commandsById[0x07] = [getPanelStatusCommand];

const ARM_MODE_MAP = {
  disarm: 'disarm',
  armDayZones: 'arm_day_zones',
  armNightZones: 'arm_night_zones',
  armAllZones: 'arm_all_zones',
};

const ACTION_TO_ARM_NOTIFICATION = {
  disarm: 'allZonesDisarmed',
  arm_day_zones: 'onlyDayZonesArmed',
  arm_night_zones: 'onlyNightZonesArmed',
  arm_all_zones: 'allZonesArmed',
};

const ACTION_TO_PANEL_STATUS = {
  disarm: 'panelDisarmed',
  arm_day_zones: 'armedStay',
  arm_night_zones: 'armedNight',
  arm_all_zones: 'armedAway',
};

class IasAceBoundCluster extends BoundCluster {

  constructor({ endpoint, onArm, onEmergency, onFire, onPanic }) {
    super();
    this._endpoint = endpoint;
    this._onArm = onArm;
    this._onEmergency = onEmergency;
    this._onFire = onFire;
    this._onPanic = onPanic;
    this._currentAction = 'disarm';
  }

  /**
   * Override handleFrame to fix a bug in zigbee-clusters where the Endpoint
   * sends cluster-specific responses with clusterSpecific=false in frameControl.
   * We intercept the response tuple, build a correct ZCL frame, and send it
   * ourselves via the endpoint.
   */
  async handleFrame(frame, meta, rawFrame) {
    if (!frame.frameControl?.clusterSpecific) return;

    const result = await super.handleFrame(frame, meta, rawFrame);

    // Fix zigbee-clusters bug: Endpoint sends cluster-specific responses with
    // clusterSpecific=false in frameControl. We send the response manually
    // with the correct bits and return undefined to suppress the broken one.
    if (result) {
      const [cmdId, responseData] = result;
      const payload = responseData.toBuffer();

      const fc = 0x01  // clusterSpecific
        | (frame.frameControl.directionToClient ? 0 : 0x08)  // flip direction
        | 0x10; // disableDefaultResponse

      const buf = Buffer.alloc(3 + payload.length);
      buf[0] = fc;
      buf[1] = rawFrame[1]; // trxSequenceNumber
      buf[2] = cmdId;
      payload.copy(buf, 3);

      await this._endpoint.sendFrame(1281, buf);
      return;
    }
  }

  arm(payload) {
    const action = ARM_MODE_MAP[payload.armMode] || `unknown_${payload.armMode}`;
    const code = payload.armDisarmCode || '';

    this._currentAction = action;

    // Fire callback asynchronously for flow triggers / automations
    if (this._onArm) {
      this._onArm({
        armMode: payload.armMode,
        action,
        code,
        zoneId: payload.zoneId || 0,
      });
    }

    // Respond immediately so the keypad gets LED feedback before its radio sleeps
    const notification = ACTION_TO_ARM_NOTIFICATION[action] || 'allZonesDisarmed';
    return { armNotification: notification };
  }

  getPanelStatus() {
    return {
      panelStatus: ACTION_TO_PANEL_STATUS[this._currentAction] || 'panelDisarmed',
      secondsRemaining: 0,
      audibleNotification: 'mute',
      alarmStatus: 'noAlarm',
    };
  }

  emergency() {
    if (this._onEmergency) this._onEmergency();
  }

  fire() {
    if (this._onFire) this._onFire();
  }

  panic() {
    if (this._onPanic) this._onPanic();
  }

}

module.exports = IasAceBoundCluster;
