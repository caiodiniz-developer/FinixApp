import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../lib/prisma";
import { planFor } from "../config/plans";
import { authenticate } from "../middlewares/auth";
import { categoriesUpdateSchema, categorySchema, categoryUpdateSchema } from "../schemas";

const router = Router();

// ============================================================================
// CATEGORIES
// ============================================================================
router.put("/api/categories", authenticate, async (req, res) => {
  try {
    const user = req.user;
    const plan = planFor(user);
    if (!plan.canEditCategories)
      return res.status(403).json({
        error: "Atualização de categorias disponível apenas no plano Pro",
      });
    const data = categoriesUpdateSchema.parse(req.body);
    const uniqueCategories = Array.from(
      new Set(data.categories.map((cat) => cat.trim()).filter(Boolean)),
    );
    if (uniqueCategories.length === 0)
      return res
        .status(400)
        .json({ error: "Adicione pelo menos uma categoria" });
    await prisma.category.deleteMany({ where: { userId: user.id } });
    await prisma.category.createMany({
      data: uniqueCategories.map((name) => ({ userId: user.id, name })),
    });
    const categories = await prisma.category.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
    });
    res.json(categories);
  } catch (err: any) {
    console.error("Categories update error:", err);
    if (err.name === "ZodError")
      return res.status(400).json({ error: "Dados de categoria inválidos" });
    res
      .status(500)
      .json({ error: err.message || "Erro ao atualizar categorias" });
  }
});

router.post("/api/categories", authenticate, async (req, res) => {
  try {
    const user = req.user;
    const plan = planFor(user);
    if (!plan.canCreateCategories)
      return res.status(403).json({
        error: "Criação de categorias disponível apenas no plano Pro",
      });
    const data = categorySchema.parse(req.body);
    const category = await prisma.category.create({
      data: { id: uuidv4(), userId: user.id, ...data },
    });
    res.json(category);
  } catch (err: any) {
    console.error("Create category error:", err);
    if (err.name === "ZodError")
      return res.status(400).json({ error: "Dados de categoria inválidos" });
    res.status(500).json({ error: err.message || "Erro ao criar categoria" });
  }
});

router.put("/api/categories/:id", authenticate, async (req, res) => {
  try {
    const user = req.user;
    const plan = planFor(user);
    if (!plan.canEditCategories)
      return res
        .status(403)
        .json({ error: "Edição de categorias disponível apenas no plano Pro" });
    const data = categoryUpdateSchema.parse(req.body);
    const existing = await prisma.category.findFirst({
      where: { id: String(req.params.id), userId: user.id },
    });
    if (!existing)
      return res.status(404).json({ error: "Categoria não encontrada" });

    const newName = data.name?.trim();
    const renamed = !!newName && newName !== existing.name;
    if (renamed) {
      const clash = await prisma.category.findFirst({
        where: { userId: user.id, name: newName, id: { not: existing.id } },
        select: { id: true },
      });
      if (clash)
        return res.status(400).json({ error: "Já existe uma categoria com esse nome" });
    }

    // Transactions, budgets and recurring rules point at a category by its
    // NAME. Renaming only the category row would orphan all of them (history
    // filed under a category that no longer exists, a budget that stops
    // counting), so the rename is carried over to every row in one transaction.
    const [category] = await prisma.$transaction([
      prisma.category.update({
        where: { id: existing.id },
        data: { ...data, ...(newName ? { name: newName } : {}) },
      }),
      ...(renamed
        ? [
            prisma.transaction.updateMany({
              where: { userId: user.id, category: existing.name },
              data: { category: newName },
            }),
            prisma.recurringTransaction.updateMany({
              where: { userId: user.id, category: existing.name },
              data: { category: newName },
            }),
            prisma.budget.updateMany({
              where: { userId: user.id, category: existing.name },
              data: { category: newName },
            }),
          ]
        : []),
    ]);
    res.json(category);
  } catch (err: any) {
    console.error("Update category error:", err);
    if (err.name === "ZodError")
      return res.status(400).json({ error: "Dados de categoria inválidos" });
    res
      .status(500)
      .json({ error: err.message || "Erro ao atualizar categoria" });
  }
});

router.delete("/api/categories/:id", authenticate, async (req, res) => {
  try {
    const user = req.user;
    const plan = planFor(user);
    if (!plan.canEditCategories)
      return res.status(403).json({
        error: "Exclusão de categorias disponível apenas no plano Pro",
      });
    const categoryId = String(req.params.id);
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category || category.userId !== user.id)
      return res.status(404).json({ error: "Categoria não encontrada" });
    const linked = await prisma.transaction.count({
      where: { userId: user.id, category: category.name },
    });
    if (linked > 0)
      return res.status(400).json({
        error: "Não é possível excluir categoria vinculada a transações",
      });
    await prisma.category.delete({ where: { id: categoryId } });
    res.json({ ok: true });
  } catch (err: any) {
    console.error("Delete category error:", err);
    res.status(500).json({ error: err.message || "Erro ao excluir categoria" });
  }
});

router.get("/api/categories", authenticate, async (req, res) => {
  try {
    const user = req.user;
    const categories = await prisma.category.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
    });
    res.json(categories);
  } catch (err: any) {
    console.error("Categories error:", err);
    res.status(500).json({ error: "Erro ao buscar categorias" });
  }
});

export default router;
