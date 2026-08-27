import assert from "node:assert/strict";
import test from "node:test";

import { publicOrigin } from "../src/server/auth/public-origin";

test("uses the configured public HTTPS origin instead of an internal request URL", () => {
  assert.equal(publicOrigin({ SIGNLATCH_PUBLIC_ORIGIN: "https://signlatch.juanchi.dev" }).origin,
    "https://signlatch.juanchi.dev");
});

test("rejects an origin with an unsafe scheme or URL components", () => {
  for (const value of [
    "http://signlatch.juanchi.dev",
    "https://user:pass@signlatch.juanchi.dev",
    "https://signlatch.juanchi.dev/path",
    "https://signlatch.juanchi.dev?next=evil",
    "https://signlatch.juanchi.dev#fragment",
  ]) assert.throws(() => publicOrigin({ SIGNLATCH_PUBLIC_ORIGIN: value }));
});

test("requires an explicit public origin", () => {
  assert.throws(() => publicOrigin({}), /SIGNLATCH_PUBLIC_ORIGIN/);
});
