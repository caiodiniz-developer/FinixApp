import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import { authRateLimit, perEmailRateLimit } from "../middlewares/rateLimit";
import {
  signupController,
  loginController,
  getMeController,
} from "../controllers/authController";
import {
  refreshTokenController,
  logoutController,
} from "../controllers/oauthController";
import { completeTwoFactorLoginController } from "../controllers/twoFactorController";

const router = Router();

// Only the credential endpoints are rate limited. /me and /refresh-token are
// called by every open tab on a timer — throttling them would log out
// legitimate users.
router.post("/signup", authRateLimit, signupController);
router.post("/register", authRateLimit, signupController);
router.post("/login", authRateLimit, perEmailRateLimit, loginController);
router.post("/2fa/login", authRateLimit, completeTwoFactorLoginController);
router.post("/refresh-token", refreshTokenController);
router.post("/logout", logoutController);
router.get("/me", authenticate, getMeController);

export default router;
