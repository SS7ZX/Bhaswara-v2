import type { Server } from "node:http";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    findMany: vi.fn(),
  },
  refreshToken: {
    create: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
  lessonCompletion: { create: vi.fn() },
  pronunciationAttempt: {
    create: vi.fn(),
    aggregate: vi.fn(),
    update: vi.fn(),
  },
  $queryRaw: vi.fn(),
  $connect: vi.fn(),
  $disconnect: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock("./lib/prisma.js", () => ({ prisma: prismaMock }));

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";
process.env.JWT_SECRET ??= "test-only-secret-with-at-least-32-characters";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const { app } = await import("./index.js");
  server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not start API test server.");
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterAll(async () => {
  if (!server) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

describe("API baseline", () => {
  it("reports liveness without exposing environment details", async () => {
    const response = await fetch(`${baseUrl}/health`);
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ status: "ok", service: "bhaswara-api" });
    expect(payload).not.toHaveProperty("environment");
    expect(response.headers.get("x-powered-by")).toBeNull();
  });

  it("keeps learner progress endpoints behind bearer authentication", async () => {
    const [leaderboard, xp] = await Promise.all([
      fetch(`${baseUrl}/leaderboard`),
      fetch(`${baseUrl}/xp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "someone", amount: 500 }),
      }),
    ]);

    expect(leaderboard.status).toBe(401);
    expect(xp.status).toBe(401);
  });

  it("rejects malformed JSON with a client error", async () => {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_REQUEST" },
    });
  });

  it("does not grant XP from the former client-controlled payload", async () => {
    const response = await fetch(`${baseUrl}/xp`, {
      method: "POST",
      headers: {
        authorization: "Bearer not-a-real-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ username: "someone", amount: 500 }),
    });

    expect(response.status).toBe(401);
  });

  it("creates learner accounts with hashed passwords and refresh sessions", async () => {
    const storedUser = {
      id: "2fbc47c3-793a-4a02-ad3e-80dbab4c1294",
      username: "learner1",
      email: "learner@example.com",
      passwordHash: "",
      role: "LEARNER",
      tokenVersion: 0,
      streak: 0,
      lastActiveAt: null,
      xp: 0,
      lessonsCompleted: 0,
    };
    prismaMock.user.create.mockImplementation(async ({ data }) => ({
      ...storedUser,
      ...data,
    }));
    prismaMock.refreshToken.create.mockResolvedValue({});

    const response = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: "Learner1",
        email: "LEARNER@example.com",
        password: "a-secure-test-password",
      }),
    });
    const payload = (await response.json()) as {
      user: Record<string, unknown>;
      session: { accessToken: string; refreshToken: string; role: string };
    };
    const storedPasswordHash = prismaMock.user.create.mock.calls[0][0].data.passwordHash;

    expect(response.status).toBe(201);
    expect(payload.user).not.toHaveProperty("passwordHash");
    expect(payload.user.role).toBe("learner");
    expect(payload.session.accessToken).toBeTruthy();
    expect(payload.session.refreshToken).toBeTruthy();
    expect(payload.session.role).toBe("learner");
    expect(storedPasswordHash).not.toBe("a-secure-test-password");
    expect(prismaMock.user.create.mock.calls[0][0].data.email).toBe("learner@example.com");
    expect(prismaMock.refreshToken.create.mock.calls[0][0].data.tokenHash).not.toBe(
      payload.session.refreshToken,
    );
  });

  it("does not allow public registration to assign privileged roles", async () => {
    const response = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: "admin1",
        email: "admin@example.com",
        password: "another-secure-test-password",
        role: "ADMIN",
      }),
    });

    expect(response.status).toBe(400);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("rotates refresh tokens and stores only their hashes", async () => {
    const oldRefreshToken = "old-refresh-token-that-is-long-enough-for-validation";
    const user = {
      id: "2fbc47c3-793a-4a02-ad3e-80dbab4c1294",
      username: "learner1",
      role: "LEARNER",
      tokenVersion: 0,
      streak: 2,
      lastActiveAt: new Date(),
      xp: 20,
      lessonsCompleted: 2,
    };
    prismaMock.refreshToken.findUnique.mockResolvedValue({
      id: "1b03733d-5b63-4c54-9e40-8135c8e5a984",
      userId: user.id,
      familyId: "c1ff8390-e1f2-4c86-a927-d5c11b8fd191",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      revokedAt: null,
      user,
    });
    const transaction = {
      refreshToken: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn().mockResolvedValue({}),
      },
    };
    prismaMock.$transaction.mockImplementation(async (operation) => operation(transaction));

    const response = await fetch(`${baseUrl}/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: oldRefreshToken }),
    });
    const payload = (await response.json()) as {
      session: { accessToken: string; refreshToken: string };
    };

    expect(response.status).toBe(200);
    expect(payload.session.accessToken).toBeTruthy();
    expect(payload.session.refreshToken).not.toBe(oldRefreshToken);
    expect(transaction.refreshToken.updateMany).toHaveBeenCalledOnce();
    expect(transaction.refreshToken.create.mock.calls[0][0].data.tokenHash).not.toBe(
      payload.session.refreshToken,
    );
  });

  it("awards fixed XP only for a server-verified correct lesson answer", async () => {
    const account = {
      id: "2fbc47c3-793a-4a02-ad3e-80dbab4c1294",
      username: "learner1",
      role: "LEARNER",
      tokenVersion: 0,
      streak: 0,
      lastActiveAt: null,
    };
    prismaMock.user.create.mockResolvedValue({
      ...account,
      email: "learner@example.com",
      passwordHash: "hashed-password",
      xp: 0,
      lessonsCompleted: 0,
    });
    prismaMock.refreshToken.create.mockResolvedValue({});
    const registerResponse = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: "learner1",
        email: "learner@example.com",
        password: "another-secure-test-password",
      }),
    });
    const registerPayload = (await registerResponse.json()) as {
      session: { accessToken: string };
    };
    prismaMock.user.findUnique.mockResolvedValue(account);

    const updatedUser = {
      username: "learner1",
      xp: 10,
      streak: 1,
      lessonsCompleted: 1,
    };
    const transaction = {
      lessonCompletion: { create: vi.fn().mockResolvedValue({}) },
      user: { update: vi.fn().mockResolvedValue(updatedUser) },
    };
    prismaMock.$transaction.mockImplementation(async (operation) => operation(transaction));

    const response = await fetch(`${baseUrl}/xp`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${registerPayload.session.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ lessonId: "sd-02", answer: "silakan" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      isCorrect: true,
      xpAwarded: 10,
      user: updatedUser,
    });
    expect(transaction.lessonCompletion.create).toHaveBeenCalledOnce();
    expect(transaction.user.update.mock.calls[0][0].data.xp.increment).toBe(10);
  });
});
