import cors from "cors";

import { env } from "../config/env";

/**
 * CORS middleware configured to allow requests from the frontend origin.
 * Enables credentials (cookies, authorization headers) for cross-origin requests.
 */
export const corsMiddleware = cors({
  origin: env.FRONTEND_URL,
  credentials: true,
});
