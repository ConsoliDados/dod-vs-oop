import { describe, expect, test } from "bun:test";
import { bootstrap, formatBootstrapError } from "../src/bootstrap";

describe("bootstrap", () => {
  test("Ok: wires app + port + dispose for a valid env", async () => {
    const result = bootstrap({ NODE_ENV: "test", PORT: "4100", LOG_LEVEL: "error" });
    expect(result.isOk()).toBe(true);
    const { app, port, dispose } = result.unwrap();
    expect(port).toBe(4100);

    const res = await app.handle(new Request("http://localhost/health"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", service: "ddd-dod", env: "test" });

    // graceful teardown runs without throwing
    await expect(dispose()).resolves.toBeUndefined();
  });

  test("Err(Config) for an invalid env — never throws", () => {
    const result = bootstrap({ PORT: "not-a-port" });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toHaveProperty("Config");
    expect(formatBootstrapError(result.unwrapErr())).toContain("PORT");
  });
});
