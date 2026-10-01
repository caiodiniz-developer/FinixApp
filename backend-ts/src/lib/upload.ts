import multer from "multer";
import { z } from "zod";
import { HttpError } from "./httpError";

const MB = 1024 * 1024;
export const MAX_IMAGE_BYTES = 5 * MB;
export const MAX_IMPORT_BYTES = 5 * MB;

// SVG is deliberately absent: it can carry scripts, and these files are
// later served back inline as data: URIs.
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

const uploader = (maxBytes: number, accepts: (file: Express.Multer.File) => boolean, hint: string) =>
  multer({
    // Files are kept in memory on their way to the database, so the size cap
    // is what stops one request from exhausting the server's RAM.
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (accepts(file)) cb(null, true);
      else cb(new HttpError(400, `Tipo de arquivo não permitido. ${hint}`));
    },
  });

/** Logos, receipts: PNG/JPEG/WebP/GIF up to 5 MB. */
export const imageUpload = uploader(
  MAX_IMAGE_BYTES,
  (file) => IMAGE_TYPES.has(file.mimetype),
  "Envie uma imagem PNG, JPG, WebP ou GIF.",
);

/** Statement imports: .csv / .ofx / .qfx up to 5 MB (browsers report wildly
 * different MIME types for these, so the extension is what's checked). */
export const importUpload = uploader(
  MAX_IMPORT_BYTES,
  (file) => /\.(csv|ofx|qfx)$/i.test(file.originalname),
  "Envie um arquivo .csv, .ofx ou .qfx.",
);

/**
 * Images that arrive inside JSON bodies (profile photo, company logo): either
 * a data: URI of an allowed image type within the size cap, or an https URL
 * (Google sign-in stores the profile picture as a URL).
 */
const DATA_URI = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const MAX_DATA_URI_CHARS = Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 64;

export const imageStringSchema = z
  .string()
  .max(MAX_DATA_URI_CHARS, "Imagem muito grande (máx. 5 MB)")
  // "" = "no image" (forms send it when the field is cleared).
  .refine((v) => v === "" || DATA_URI.test(v) || /^https:\/\/\S+$/.test(v), {
    message: "Imagem inválida. Envie PNG, JPG, WebP ou GIF.",
  });
