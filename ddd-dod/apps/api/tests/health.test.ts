import { describe, expect, test } from "bun:test";
import { loadConfig } from "@ddd-dod/platform";
import { createApp } from "../src/app";

describe("GET /health", () => {
  test("returns ok with the environment", async () => {
    const config = loadConfig({ NODE_ENV: "test", PORT: "3333", LOG_LEVEL: "error" }).unwrap();
    const app = createApp({ config });
    const res = await app.handle(new Request("http://localhost/health"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", service: "ddd-dod", env: "test" });
  });
});
