/**
 * An error a route (or a service it calls) throws on purpose, carrying the
 * HTTP status and a message that is safe to show to the user. Anything else
 * that reaches the global error handler is treated as an unexpected failure.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "HttpError";
  }
}
