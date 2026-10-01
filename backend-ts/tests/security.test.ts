import { describe, expect, it, vi } from "vitest";
import { assertPublicUrl, isPublicAddress } from "../src/lib/ssrf";
import { createRateLimiter } from "../src/middlewares/rateLimit";
import { imageStringSchema } from "../src/lib/upload";

describe("SSRF guard", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254", // cloud metadata endpoint
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "fe80::1",
    "fd00::1",
    "::ffff:10.0.0.1",
  ])("blocks internal address %s", (ip) => {
    expect(isPublicAddress(ip)).toBe(false);
  });

  it.each(["8.8.8.8", "1.1.1.1", "172.32.0.1", "2606:4700:4700::1111"])(
    "allows public address %s",
    (ip) => {
      expect(isPublicAddress(ip)).toBe(true);
    },
  );

  it("rejects URLs that point at internal hosts or use other protocols", async () => {
    await expect(assertPublicUrl("http://127.0.0.1:8000/admin")).rejects.toThrow(/interno/);
    await expect(assertPublicUrl("http://[::1]/")).rejects.toThrow(/interno/);
    await expect(assertPublicUrl("ftp://example.com/x")).rejects.toThrow(/http/);
    await expect(assertPublicUrl("not a url")).rejects.toThrow(/inválida/);
  });

  it("accepts a public IP URL", async () => {
    const url = await assertPublicUrl("https://8.8.8.8/hook");
    expect(url.hostname).toBe("8.8.8.8");
  });
});

describe("rate limiter", () => {
  const call = (limiter: ReturnType<typeof createRateLimiter>, ip: string, path = "/login") => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), setHeader: vi.fn() };
    const next = vi.fn();
    limiter({ ip, path, body: {} } as any, res as any, next);
    return { blocked: !next.mock.calls.length, res };
  };

  it("allows up to max requests per window, then answers 429", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 });
    expect(call(limiter, "1.1.1.1").blocked).toBe(false);
    expect(call(limiter, "1.1.1.1").blocked).toBe(false);
    expect(call(limiter, "1.1.1.1").blocked).toBe(false);
    const fourth = call(limiter, "1.1.1.1");
    expect(fourth.blocked).toBe(true);
    expect(fourth.res.status).toHaveBeenCalledWith(429);
    expect(fourth.res.setHeader).toHaveBeenCalledWith("Retry-After", expect.any(Number));
  });

  it("counts each client separately", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    expect(call(limiter, "1.1.1.1").blocked).toBe(false);
    expect(call(limiter, "1.1.1.1").blocked).toBe(true);
    expect(call(limiter, "2.2.2.2").blocked).toBe(false);
  });

  it("starts over when the window has passed", () => {
    vi.useFakeTimers();
    const limiter = createRateLimiter({ windowMs: 1_000, max: 1 });
    expect(call(limiter, "1.1.1.1").blocked).toBe(false);
    expect(call(limiter, "1.1.1.1").blocked).toBe(true);
    vi.advanceTimersByTime(1_500);
    expect(call(limiter, "1.1.1.1").blocked).toBe(false);
    vi.useRealTimers();
  });
});

describe("image strings in JSON bodies", () => {
  it("accepts allowed data URIs, https URLs and the empty string", () => {
    expect(imageStringSchema.safeParse("data:image/png;base64,iVBORw0KGgo=").success).toBe(true);
    expect(imageStringSchema.safeParse("https://lh3.googleusercontent.com/a/photo").success).toBe(true);
    expect(imageStringSchema.safeParse("").success).toBe(true);
  });

  it("rejects SVG, non-image data and plain http", () => {
    expect(imageStringSchema.safeParse("data:image/svg+xml;base64,PHN2Zy8+").success).toBe(false);
    expect(imageStringSchema.safeParse("data:text/html;base64,PGI+").success).toBe(false);
    expect(imageStringSchema.safeParse("http://example.com/a.png").success).toBe(false);
  });
});
