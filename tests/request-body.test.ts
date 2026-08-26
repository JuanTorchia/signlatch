import assert from "node:assert/strict";
import test from "node:test";

import { BodyLimitError, readBoundedBody } from "../src/server/http/bounded-body";

function requestWithChunks(chunks: string[], contentLength?: string): Request {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Request("https://signlatch.test/api", {
    method: "POST",
    body: stream,
    duplex: "half",
    headers: contentLength ? { "content-length": contentLength } : undefined,
  } as RequestInit & { duplex: "half" });
}

test("reads a complete body at the exact byte limit", async () => {
  const bytes = await readBoundedBody(requestWithChunks(["1234", "5678"]), 8);
  assert.equal(new TextDecoder().decode(bytes), "12345678");
});

test("rejects a chunked body that exceeds the limit despite no content length", async () => {
  await assert.rejects(readBoundedBody(requestWithChunks(["1234", "56789"]), 8), BodyLimitError);
});

test("rejects a lying content length before consuming the stream", async () => {
  await assert.rejects(readBoundedBody(requestWithChunks(["small"], "999"), 8), BodyLimitError);
});

test("rejects an aborted request body", async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.error(new Error("aborted"));
    },
  });
  const request = new Request("https://signlatch.test/api", {
    method: "POST",
    body: stream,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  await assert.rejects(readBoundedBody(request, 8), /body stream failed/);
});
