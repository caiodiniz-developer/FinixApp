import { Router } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middlewares/auth";
import { profileUpdateSchema } from "../schemas";
import { userPublic } from "../lib/userPublic";

const router = Router();

// ============================================================================
// AUTH
// ============================================================================
// Separate from userPublic() on purpose — see comment there. Fetched once by
// whichever component actually renders an avatar, not on every auth check.
// `authenticate` now omits photo/companyLogo (see comment there), so this is
// its own dedicated query — `select` (not the default fetch-everything)
// keeps it to exactly the two columns actually needed here.
router.get("/api/auth/photo", authenticate, async (req, res) => {
  const authUser = req.user;
  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { photo: true, companyLogo: true },
  });
  res.json({ photo: user?.photo || null, companyLogo: user?.companyLogo || null });
});

// ============================================================================
// PROFILE
// ============================================================================
router.put("/api/profile", authenticate, async (req, res) => {
  const user = req.user;
  const data = profileUpdateSchema.parse(req.body);
  const updates: any = {};
  if (data.name) updates.name = data.name.trim();
  if (data.photo) updates.photo = data.photo;
  if (data.newPassword) {
    if (
      !data.currentPassword ||
      !(await bcrypt.compare(data.currentPassword, user.passwordHash))
    )
      return res.status(400).json({ error: "Senha atual incorreta" });
    updates.passwordHash = await bcrypt.hash(data.newPassword, 10);
  }
  if (Object.keys(updates).length === 0)
    return res.status(400).json({ error: "Nada para atualizar" });
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: updates,
  });
  res.json(userPublic(updatedUser));
});

export default router;
