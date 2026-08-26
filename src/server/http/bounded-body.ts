export class BodyLimitError extends Error {
  readonly status = 413;

  constructor(readonly limitBytes: number) {
    super(`Request body exceeds the ${limitBytes} byte limit`);
    this.name = "BodyLimitError";
  }
}

export async function readBoundedBody(request: Request, limitBytes: number): Promise<Uint8Array> {
  if (!Number.isSafeInteger(limitBytes) || limitBytes < 1) throw new Error("Invalid body limit");
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    const length = Number(declared);
    if (!Number.isSafeInteger(length) || length < 0 || length > limitBytes) {
      throw new BodyLimitError(limitBytes);
    }
  }
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limitBytes) {
        await reader.cancel("body limit exceeded").catch(() => undefined);
        throw new BodyLimitError(limitBytes);
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof BodyLimitError) throw error;
    throw new Error("Request body stream failed", { cause: error });
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}
