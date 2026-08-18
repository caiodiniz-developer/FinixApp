import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET || "finix-dev-secret";

export interface AuthRequest extends Request {
  user?: any;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const bearerToken = req.headers.authorization?.replace("Bearer ", "");
    const cookieToken = req.cookies?.access_token;
    const token = bearerToken || cookieToken;
    if (!token) {
      return res.status(401).json({ error: "Token não fornecido" });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    // req.user here is only ever used for authorization checks (blocked,
    // role, plan...) — never re-serialized with its photo. Omitting it is
    // what keeps this middleware (it runs on every authenticated request)
    // from dragging a multi-MB base64 image across the network each time.
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      omit: { photo: true, companyLogo: true },
    });

    if (!user || user.blocked) {
      return res
        .status(401)
        .json({ error: "Usuário não encontrado ou bloqueado" });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: "Token inválido" });
  }
};

export const requireVerified = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  if (!req.user?.isVerified) {
    return res
      .status(403)
      .json({
        error:
          "E-mail não verificado. Verifique seu e-mail antes de continuar.",
      });
  }
  next();
};
