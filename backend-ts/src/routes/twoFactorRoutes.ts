import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import {
  setupTwoFactor,
  verifyAndEnableTwoFactor,
  disableTwoFactor,
} from "../controllers/twoFactorController";

const router = Router();

router.post("/setup", authenticate, setupTwoFactor);
router.post("/verify", authenticate, verifyAndEnableTwoFactor);
router.post("/disable", authenticate, disableTwoFactor);

export default router;
