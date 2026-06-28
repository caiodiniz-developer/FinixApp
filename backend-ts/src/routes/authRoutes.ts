import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import { authRateLimit } from "../middlewares/rateLimit";
import {
  signupController,
  loginController,
  getMeController,
  verifyEmailController,
  resendCodeController,
} from "../controllers/authController";
import {
  refreshTokenController,
  logoutController,
} from "../controllers/oauthController";

const router = Router();

router.use(authRateLimit);

router.post("/signup", signupController);
router.post("/register", signupController);
router.post("/login", loginController);
router.post("/verify", verifyEmailController);
router.post("/resend-code", resendCodeController);
router.post("/refresh-token", refreshTokenController);
router.post("/logout", logoutController);
router.get("/me", authenticate, getMeController);

export default router;
