import Chargebee from "chargebee";

import { env } from "@/core/config/env";

export const chargebee = new Chargebee({
  site: env.CHARGEBEE_SITE,
  apiKey: env.CHARGEBEE_API_KEY,
});
