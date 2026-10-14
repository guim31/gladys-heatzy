// -----------------------------------------------------------------------------
// Scene action handlers (manifest `scene_actions`, Gladys 5.1+).
//
// "Control a device" already sets the mode of one radiator; these reach every
// module at once ("everything to frost protection when the house is empty"),
// and start or end the vacation mode, which no device feature can express.
// The fields arrive resolved, defaults applied; an empty module means all.
// -----------------------------------------------------------------------------

import { MODE_BY_KEY } from './heatzy/model.js';

export const SCENE_ACTIONS = {
  async set_mode(hub, { fields = {} }) {
    const mode = MODE_BY_KEY[fields.mode];
    const count = await hub.setMode(fields.device || null, mode);
    return { count };
  },

  async start_vacation(hub, { fields = {} }) {
    const days = Number(fields.days);
    const count = await hub.startVacation(fields.device || null, days);
    return { count };
  },

  async stop_vacation(hub, { fields = {} }) {
    const count = await hub.stopVacation(fields.device || null);
    return { count };
  },
};
