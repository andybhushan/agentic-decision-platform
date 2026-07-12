// Official Microsoft product icons (Azure Architecture Icons + Fabric icon set), curated from
// the DT Offering asset library (MS-Icons). Used wherever the console depicts a specific
// Microsoft product, per the dual-brand convention: real product marks, never approximations.

import azureOpenAI from "./ms/azure-openai.svg";
import aiFoundry from "./ms/ai-foundry.svg";
import aiSearch from "./ms/ai-search.svg";
import cosmosDb from "./ms/cosmos-db.svg";
import functions from "./ms/functions.svg";
import eventHubs from "./ms/event-hubs.svg";
import containerApps from "./ms/container-apps.svg";
import staticWebApps from "./ms/static-web-apps.svg";
import fabric from "./ms/fabric.svg";

export const MS_ICONS = {
  azureOpenAI,
  aiFoundry,
  aiSearch,
  cosmosDb,
  functions,
  eventHubs,
  containerApps,
  staticWebApps,
  fabric,
} as const;

export type MsIconKey = keyof typeof MS_ICONS;
