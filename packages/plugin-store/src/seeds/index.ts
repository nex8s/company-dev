import type { SeedTemplate } from "../types.js";
import { facelessYoutube } from "./faceless-youtube.js";
import { smma } from "./smma.js";
import { youtubeLongForm } from "./youtube-long-form.js";
import { b2bOutboundMachine } from "./b2b-outbound-machine.js";
import { devAgency } from "./dev-agency.js";
import { devopsMonitoringOps } from "./devops-monitoring-ops.js";

export const seedTemplates: SeedTemplate[] = [
  facelessYoutube,
  smma,
  youtubeLongForm,
  b2bOutboundMachine,
  devAgency,
  devopsMonitoringOps,
];

export {
  facelessYoutube,
  smma,
  youtubeLongForm,
  b2bOutboundMachine,
  devAgency,
  devopsMonitoringOps,
};
