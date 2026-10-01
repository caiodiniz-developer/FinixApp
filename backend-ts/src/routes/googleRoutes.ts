import { Router } from "express";
import {
  googleRedirectController,
  googleCallbackController,
} from "../controllers/oauthController";
import { authRateLimit } from "../middlewares/rateLimit";
import {
  gmailConnectController,
  gmailCallbackController,
} from "../controllers/gmailConnectController";

const router = Router();
router.use(authRateLimit);
router.get("/", googleRedirectController);
router.get("/callback", googleCallbackController);

// One-time setup: authorize the API to send e-mail as the Finix Gmail account.
router.get("/gmail/connect", gmailConnectController);
router.get("/gmail/callback", gmailCallbackController);

export default router;
