import { Router } from "express";
import { effectivePlanId } from "../config/plans";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middlewares/auth";
import { onboardingSchema } from "../schemas";
import { userPublic } from "../lib/userPublic";
import { imageUpload } from "../lib/upload";

const router = Router();

// ============================================================================
// ONBOARDING
// ============================================================================
const DEFAULT_CATEGORIES = [
  "Alimentação",
  "Transporte",
  "Saúde",
  "Salário",
  "Investimento",
  "Pagamento",
  "Lazer",
  "Educação",
  "Moradia",
  "Serviços",
];

router.post("/api/onboarding", authenticate, async (req, res) => {
  try {
    const user = req.user;
    if (user.hasCompletedOnboarding)
      return res.status(400).json({ error: "Onboarding já completado" });
    const data = onboardingSchema.parse(req.body);
    const updateData: any = {
      hasCompletedOnboarding: true,
      usageType: data.usageType,
    };
    if (data.usageType !== "pessoal") {
      updateData.companyName = data.companyName || null;
      updateData.companyLogo = data.companyLogo || null;
      updateData.businessPurpose = data.businessPurpose || null;
      updateData.primaryColor = data.primaryColor || null;
    } else {
      updateData.companyName = null;
      updateData.companyLogo = null;
      updateData.businessPurpose = null;
      updateData.primaryColor = null;
    }
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });
    await prisma.category.deleteMany({ where: { userId: user.id } });
    const categoriesToCreate =
      data.categories?.length > 0 ? data.categories : DEFAULT_CATEGORIES;
    if (categoriesToCreate.length > 0) {
      await prisma.category.createMany({
        data: categoriesToCreate.map((name) => ({ userId: user.id, name })),
      });
    }
    res.json({ user: userPublic(updatedUser) });
  } catch (err: any) {
    console.error("Onboarding error:", err);
    if (err.name === "ZodError")
      return res
        .status(400)
        .json({ error: "Dados inválidos", details: err.errors });
    res.status(500).json({ error: err.message || "Erro no onboarding" });
  }
});

router.post(
  "/api/upload-logo",
  authenticate,
  imageUpload.single("logo"),
  async (req, res) => {
    try {
      const user = req.user;
      if (effectivePlanId(user) !== "PRO")
        return res
          .status(403)
          .json({ error: "Upload de logo disponível apenas para plano PRO" });
      if (!req.file)
        return res.status(400).json({ error: "Nenhum arquivo enviado" });
      const logoUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
      res.json({ logoUrl });
    } catch (err: any) {
      console.error("Upload error:", err);
      res.status(500).json({ error: "Erro no upload" });
    }
  },
);

export default router;
