import dns from "dns/promises";
import net from "net";
import { HttpError } from "./httpError";

// Everything that is not a routable public address: loopback, private LANs,
// link-local (where cloud metadata services live — 169.254.169.254),
// carrier-grade NAT, multicast and reserved ranges.
const blocked = new net.BlockList();
for (const [prefix, bits] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(prefix, bits, "ipv4");
}
for (const [prefix, bits] of [
  ["::", 127], // :: and ::1
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(prefix, bits, "ipv6");
}

export const isPublicAddress = (ip: string): boolean => {
  if (net.isIPv4(ip)) return !blocked.check(ip, "ipv4");
  if (net.isIPv6(ip)) {
    // IPv4-mapped (::ffff:10.0.0.1) must be judged as the IPv4 it wraps.
    const mapped = ip.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPublicAddress(mapped[1]);
    return !blocked.check(ip, "ipv6");
  }
  return false;
};

/**
 * Guards server-side requests to user-supplied URLs (outbound webhooks):
 * without it a user could point a webhook at http://localhost, a private
 * service or the cloud metadata endpoint and make the server call it for
 * them. Resolves the hostname and requires every address to be public.
 *
 * Callers must also send the request with `redirect: "manual"` — otherwise a
 * public URL could simply redirect to an internal one.
 */
export const assertPublicUrl = async (rawUrl: string): Promise<URL> => {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new HttpError(400, "URL inválida");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new HttpError(400, "A URL precisa usar http ou https");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");

  let addresses: string[];
  if (net.isIP(host)) {
    addresses = [host];
  } else {
    try {
      addresses = (await dns.lookup(host, { all: true })).map((a) => a.address);
    } catch {
      throw new HttpError(400, "Não foi possível resolver o endereço da URL");
    }
  }
  if (addresses.length === 0 || !addresses.every(isPublicAddress)) {
    throw new HttpError(400, "A URL aponta para um endereço interno ou reservado");
  }
  return url;
};
