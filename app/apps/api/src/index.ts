import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";

import bcrypt from "bcryptjs";
import cors from "cors";
import express, { type ErrorRequestHandler, type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import { z } from "zod";

import {
  buildLeaderboard,
  calculatePronunciationScore,
  getLessonSet,
  getLevelFromXp,
  lessonCatalog,
  normalizeText,
  supportedLanguages,
  type LessonItem,
} from "@bhaswara/shared";

import { config } from "./config.js";
import { prisma } from "./lib/prisma.js";

type UserRole = "LEARNER" | "TEACHER" | "ADMIN";
type AuthContext = {
  id: string;
  username: string;
  role: UserRole;
  tokenVersion: number;
  streak: number;
  lastActiveAt: Date | null;
};
type AuthenticatedRequest = Request & { user?: AuthContext; requestId?: string };
type AsyncHandler = (
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction,
) => Promise<void>;

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

const app = express();
const dummyPasswordHash = bcrypt.hashSync(randomBytes(32).toString("hex"), 12);
const languageSchema = z.enum(["sunda", "jawa", "bali", "bugis", "minang"]);
const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(32)
  .regex(/^[a-zA-Z0-9_]+$/)
  .transform((value) => value.toLowerCase());
const emailSchema = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const passwordSchema = z
  .string()
  .min(12)
  .max(72)
  .refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Password must not exceed 72 UTF-8 bytes.");

const registerPayloadSchema = z
  .object({
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
  })
  .strict();
const loginPayloadSchema = z
  .object({
    username: usernameSchema,
    password: z.string().min(1).max(72),
  })
  .strict();
const xpPayloadSchema = z
  .object({
    lessonId: z.string().trim().min(1).max(40),
    answer: z.string().trim().min(1).max(120),
  })
  .strict();
const scorePayloadSchema = z
  .object({
    lessonId: z.string().trim().min(1).max(40),
    heard: z.string().trim().min(1).max(120),
  })
  .strict();
const refreshPayloadSchema = z
  .object({ refreshToken: z.string().min(32).max(128) })
  .strict();

const asyncHandler =
  (handler: AsyncHandler) =>
  (request: Request, response: Response, next: NextFunction): void => {
    void handler(request as AuthenticatedRequest, response, next).catch(next);
  };

const getLesson = (lessonId: string): LessonItem | undefined =>
  supportedLanguages.flatMap((language) => lessonCatalog[language]).find((lesson) => lesson.id === lessonId);

const userSummary = (user: {
  username: string;
  xp: number;
  streak: number;
  lessonsCompleted: number;
}) => ({
  username: user.username,
  xp: user.xp,
  streak: user.streak,
  level: getLevelFromXp(user.xp),
  lessonsCompleted: user.lessonsCompleted,
});

const serializeAccessToken = (user: AuthContext) => {
  const expiresInSeconds = 30 * 60;
  return jwt.sign(
    { ver: user.tokenVersion },
    config.JWT_SECRET,
    {
      algorithm: "HS256",
      audience: "bhaswara-mobile",
      expiresIn: expiresInSeconds,
      issuer: "bhaswara-api",
      subject: user.id,
    },
  );
};

const createSession = async (user: AuthContext) => {
  const refreshToken = randomBytes(32).toString("base64url");
  const refreshExpiresInSeconds = 30 * 24 * 60 * 60;
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      familyId: randomUUID(),
      tokenHash: createHash("sha256").update(refreshToken).digest("hex"),
      expiresAt: new Date(Date.now() + refreshExpiresInSeconds * 1000),
    },
  });
  return {
    accessToken: serializeAccessToken(user),
    refreshToken,
    tokenType: "Bearer",
    expiresIn: 30 * 60,
    refreshExpiresIn: refreshExpiresInSeconds,
    username: user.username,
    role: user.role.toLowerCase(),
  };
};

const hashRefreshToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

const requireAuth = asyncHandler(async (request, _response, next) => {
  const authorization = request.header("authorization") ?? "";
  const [scheme, token, ...extra] = authorization.split(" ");

  if (scheme !== "Bearer" || !token || extra.length > 0) {
    throw new HttpError(401, "UNAUTHENTICATED", "Autentikasi diperlukan.");
  }

  let claims: jwt.JwtPayload;
  try {
    const verified = jwt.verify(token, config.JWT_SECRET, {
      algorithms: ["HS256"],
      audience: "bhaswara-mobile",
      issuer: "bhaswara-api",
    });
    if (typeof verified === "string") {
      throw new Error("Invalid token claims.");
    }
    claims = verified;
  } catch {
    throw new HttpError(401, "INVALID_TOKEN", "Token tidak valid atau kedaluwarsa.");
  }

  if (typeof claims.sub !== "string" || typeof claims.ver !== "number") {
    throw new HttpError(401, "INVALID_TOKEN", "Token tidak valid atau kedaluwarsa.");
  }

  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: {
      id: true,
      username: true,
      role: true,
      tokenVersion: true,
      streak: true,
      lastActiveAt: true,
    },
  });

  if (!user || user.tokenVersion !== claims.ver) {
    throw new HttpError(401, "INVALID_TOKEN", "Token tidak valid atau kedaluwarsa.");
  }

  request.user = user;
  next();
});

const requireRole =
  (...roles: UserRole[]) =>
  (request: AuthenticatedRequest, _response: Response, next: NextFunction): void => {
    if (!request.user || !roles.includes(request.user.role)) {
      next(new HttpError(403, "FORBIDDEN", "Akses tidak diizinkan."));
      return;
    }
    next();
  };

const isUniqueConstraintError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: unknown }).code === "P2002";

const currentStreak = (previousStreak: number, lastActiveAt: Date | null, now: Date): number => {
  if (!lastActiveAt) {
    return 1;
  }
  const previousDay = lastActiveAt.toISOString().slice(0, 10);
  const currentDay = now.toISOString().slice(0, 10);
  if (previousDay === currentDay) {
    return previousStreak;
  }

  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return previousDay === yesterday.toISOString().slice(0, 10) ? previousStreak + 1 : 1;
};

const awardLessonCompletion = async (
  user: AuthContext,
  lesson: LessonItem,
  xpAwarded: number,
): Promise<{ awarded: boolean; user: ReturnType<typeof userSummary> }> => {
  const now = new Date();
  try {
    const updatedUser = await prisma.$transaction(async (transaction) => {
      await transaction.lessonCompletion.create({
        data: {
          userId: user.id,
          lessonId: lesson.id,
          language: lesson.language,
          xpAwarded,
        },
      });

      return transaction.user.update({
        where: { id: user.id },
        data: {
          xp: { increment: xpAwarded },
          lessonsCompleted: { increment: 1 },
          streak: currentStreak(user.streak, user.lastActiveAt, now),
          lastActiveAt: now,
        },
        select: { username: true, xp: true, streak: true, lessonsCompleted: true },
      });
    });

    return { awarded: true, user: userSummary(updatedUser) };
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }
    const currentUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { username: true, xp: true, streak: true, lessonsCompleted: true },
    });
    return { awarded: false, user: userSummary(currentUser) };
  }
};

app.disable("x-powered-by");
app.use((request: AuthenticatedRequest, response, next) => {
  const requestId = randomUUID();
  request.requestId = requestId;
  response.setHeader("X-Request-Id", requestId);
  next();
});
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new HttpError(403, "ORIGIN_NOT_ALLOWED", "Origin tidak diizinkan."));
    },
  }),
);
app.use(express.json({ limit: "32kb", strict: true }));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: (request) => request.path === "/health",
  }),
);

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

app.get("/health", (_request, response) => {
  response.json({ status: "ok", service: "bhaswara-api", timestamp: new Date().toISOString() });
});

app.get(
  "/ready",
  asyncHandler(async (_request, response) => {
    await prisma.$queryRaw`SELECT 1`;
    response.json({ status: "ready", service: "bhaswara-api" });
  }),
);

app.post(
  "/auth/register",
  authRateLimit,
  asyncHandler(async (request, response) => {
    const payload = registerPayloadSchema.safeParse(request.body);
    if (!payload.success) {
      throw new HttpError(400, "INVALID_PAYLOAD", "Username, email, atau password tidak valid.");
    }

    const passwordHash = await bcrypt.hash(payload.data.password, 12);
    const user = await prisma.user
      .create({
        data: {
          username: payload.data.username,
          email: payload.data.email,
          passwordHash,
        },
        select: {
          id: true,
          username: true,
          role: true,
          tokenVersion: true,
          streak: true,
          lastActiveAt: true,
          xp: true,
          lessonsCompleted: true,
        },
      })
      .catch((error: unknown) => {
        if (isUniqueConstraintError(error)) {
          throw new HttpError(409, "ACCOUNT_EXISTS", "Username atau email sudah digunakan.");
        }
        throw error;
      });

    response.status(201).json({
      session: await createSession(user),
      user: { ...userSummary(user), role: user.role.toLowerCase() },
    });
  }),
);

app.post(
  "/auth/login",
  authRateLimit,
  asyncHandler(async (request, response) => {
    const payload = loginPayloadSchema.safeParse(request.body);
    if (!payload.success) {
      throw new HttpError(400, "INVALID_PAYLOAD", "Username atau password tidak valid.");
    }

    const user = await prisma.user.findUnique({
      where: { username: payload.data.username },
      select: {
        id: true,
        username: true,
        role: true,
        tokenVersion: true,
        streak: true,
        lastActiveAt: true,
        xp: true,
        lessonsCompleted: true,
        passwordHash: true,
      },
    });
    const passwordMatches = await bcrypt.compare(
      payload.data.password,
      user?.passwordHash ?? dummyPasswordHash,
    );

    if (!user || !passwordMatches) {
      throw new HttpError(401, "INVALID_CREDENTIALS", "Username atau password salah.");
    }

    const { passwordHash: _passwordHash, ...safeUser } = user;
    response.json({
      session: await createSession(safeUser),
      user: { ...userSummary(safeUser), role: safeUser.role.toLowerCase() },
    });
  }),
);

app.post(
  "/auth/refresh",
  authRateLimit,
  asyncHandler(async (request, response) => {
    const payload = refreshPayloadSchema.safeParse(request.body);
    if (!payload.success) {
      throw new HttpError(400, "INVALID_PAYLOAD", "Refresh token tidak valid.");
    }

    const tokenHash = hashRefreshToken(payload.data.refreshToken);
    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            role: true,
            tokenVersion: true,
            streak: true,
            lastActiveAt: true,
            xp: true,
            lessonsCompleted: true,
          },
        },
      },
    });

    if (!storedToken) {
      throw new HttpError(401, "INVALID_REFRESH_TOKEN", "Refresh token tidak valid.");
    }

    const now = new Date();
    if (
      storedToken.usedAt ||
      storedToken.revokedAt ||
      storedToken.expiresAt <= now
    ) {
      await prisma.refreshToken.updateMany({
        where: { familyId: storedToken.familyId, revokedAt: null },
        data: { revokedAt: now },
      });
      throw new HttpError(401, "INVALID_REFRESH_TOKEN", "Sesi berakhir. Silakan masuk kembali.");
    }

    const nextRefreshToken = randomBytes(32).toString("base64url");
    const refreshExpiresInSeconds = 30 * 24 * 60 * 60;
    try {
      await prisma.$transaction(async (transaction) => {
        const claimedToken = await transaction.refreshToken.updateMany({
          where: {
            id: storedToken.id,
            usedAt: null,
            revokedAt: null,
            expiresAt: { gt: now },
          },
          data: { usedAt: now, revokedAt: now },
        });
        if (claimedToken.count !== 1) {
          throw new HttpError(401, "INVALID_REFRESH_TOKEN", "Refresh token sudah digunakan.");
        }

        await transaction.refreshToken.create({
          data: {
            userId: storedToken.user.id,
            familyId: storedToken.familyId,
            tokenHash: hashRefreshToken(nextRefreshToken),
            expiresAt: new Date(Date.now() + refreshExpiresInSeconds * 1000),
          },
        });
      });
    } catch (error) {
      if (error instanceof HttpError && error.status === 401) {
        await prisma.refreshToken.updateMany({
          where: { familyId: storedToken.familyId, revokedAt: null },
          data: { revokedAt: now },
        });
      }
      throw error;
    }

    const authContext: AuthContext = {
      id: storedToken.user.id,
      username: storedToken.user.username,
      role: storedToken.user.role,
      tokenVersion: storedToken.user.tokenVersion,
      streak: storedToken.user.streak,
      lastActiveAt: storedToken.user.lastActiveAt,
    };
    response.json({
      session: {
        accessToken: serializeAccessToken(authContext),
        refreshToken: nextRefreshToken,
        tokenType: "Bearer",
        expiresIn: 30 * 60,
        refreshExpiresIn: refreshExpiresInSeconds,
        username: authContext.username,
        role: authContext.role.toLowerCase(),
      },
      user: userSummary(storedToken.user),
    });
  }),
);

app.get(
  "/auth/session",
  requireAuth,
  asyncHandler(async (request, response) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: request.user!.id },
      select: { username: true, xp: true, streak: true, lessonsCompleted: true },
    });
    response.json({
      user: {
        ...userSummary(user),
        role: request.user!.role.toLowerCase(),
      },
    });
  }),
);

app.post(
  "/auth/logout",
  requireAuth,
  asyncHandler(async (request, response) => {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: request.user!.id },
        data: { tokenVersion: { increment: 1 } },
      }),
      prisma.refreshToken.updateMany({
        where: { userId: request.user!.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    response.status(204).end();
  }),
);

app.get(
  "/user/me",
  requireAuth,
  asyncHandler(async (request, response) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: request.user!.id },
      select: { username: true, xp: true, streak: true, lessonsCompleted: true },
    });
    response.json(userSummary(user));
  }),
);

app.get(
  "/user/:username",
  requireAuth,
  asyncHandler(async (request, response) => {
    const username = usernameSchema.safeParse(request.params.username);
    if (!username.success || username.data !== request.user!.username) {
      throw new HttpError(404, "USER_NOT_FOUND", "Pengguna tidak ditemukan.");
    }

    const user = await prisma.user.findUnique({
      where: { username: username.data },
      select: { username: true, xp: true, streak: true, lessonsCompleted: true },
    });
    if (!user) {
      throw new HttpError(404, "USER_NOT_FOUND", "Pengguna tidak ditemukan.");
    }
    response.json(userSummary(user));
  }),
);

app.get(
  "/dashboard/summary",
  requireAuth,
  requireRole("TEACHER", "ADMIN"),
  asyncHandler(async (_request, response) => {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [learners, xpTotals, activeLearners, scoreTotals, topUsers] = await Promise.all([
      prisma.user.count({ where: { role: "LEARNER" } }),
      prisma.user.aggregate({ _sum: { xp: true } }),
      prisma.user.count({ where: { role: "LEARNER", lastActiveAt: { gte: since } } }),
      prisma.pronunciationAttempt.aggregate({ _avg: { score: true } }),
      prisma.user.findMany({
        where: { role: "LEARNER" },
        orderBy: [{ xp: "desc" }, { username: "asc" }],
        take: 1,
        select: { username: true, xp: true, streak: true, lessonsCompleted: true },
      }),
    ]);

    const topLearner = buildLeaderboard(topUsers)[0] ?? null;
    response.json({
      totalLearners: learners,
      totalXp: xpTotals._sum.xp ?? 0,
      avgPronunciation: Math.round(scoreTotals._avg.score ?? 0),
      weeklyActiveRate: learners === 0 ? 0 : Math.round((activeLearners / learners) * 100),
      topLearner: topLearner
        ? { ...topLearner, level: getLevelFromXp(topLearner.xp) }
        : null,
      languagesCovered: supportedLanguages.length,
    });
  }),
);

app.get("/languages", (_request, response) => {
  response.json(
    supportedLanguages.map((language) => ({
      code: language,
      label: language.toUpperCase(),
      lessonCount: getLessonSet(language, 50).length,
    })),
  );
});

app.get("/lessons/:language", (request, response) => {
  const language = languageSchema.safeParse(request.params.language);
  if (!language.success) {
    throw new HttpError(400, "UNSUPPORTED_LANGUAGE", "Bahasa tidak tersedia.");
  }
  response.json(getLessonSet(language.data, 12));
});

app.get("/culture", (_request, response) => {
  response.json([
    {
      title: "Baju Adat Sunda",
      fact: "Baju adat Sunda dikenal dengan warna lembut dan motif yang mencerminkan kesederhanaan serta kehormatan sosial.",
      region: "Jawa Barat",
    },
    {
      title: "Wayang Kulit",
      fact: "Wayang kulit merupakan media pendidikan dan cerita yang kaya dengan nilai moral, agama, dan kebijaksanaan.",
      region: "Jawa",
    },
    {
      title: "Kecak Bali",
      fact: "Kecak adalah pertunjukan tari dan musik yang memadukan gerak, ritme, dan cerita epik dalam satu pementasan.",
      region: "Bali",
    },
    {
      title: "Rumah Gadang",
      fact: "Rumah Gadang adalah identitas budaya Minangkabau yang mencerminkan kekerabatan, keterbukaan, dan harmoni sosial.",
      region: "Sumatra Barat",
    },
  ]);
});

app.get(
  "/leaderboard",
  requireAuth,
  asyncHandler(async (_request, response) => {
    const users = await prisma.user.findMany({
      where: { role: "LEARNER" },
      orderBy: [{ xp: "desc" }, { username: "asc" }],
      take: 100,
      select: { username: true, xp: true, streak: true, lessonsCompleted: true },
    });
    response.json(
      buildLeaderboard(users).map((user) => ({
        name: user.username,
        xp: user.xp,
        streak: user.streak,
        level: getLevelFromXp(user.xp),
        lessonsCompleted: user.lessonsCompleted,
      })),
    );
  }),
);

app.post(
  "/xp",
  requireAuth,
  asyncHandler(async (request, response) => {
    const payload = xpPayloadSchema.safeParse(request.body);
    if (!payload.success) {
      throw new HttpError(400, "INVALID_PAYLOAD", "Jawaban kuis tidak valid.");
    }

    const lesson = getLesson(payload.data.lessonId);
    if (!lesson) {
      throw new HttpError(404, "LESSON_NOT_FOUND", "Materi tidak ditemukan.");
    }

    const isCorrect = normalizeText(payload.data.answer) === normalizeText(lesson.meaning);
    if (!isCorrect) {
      response.json({ isCorrect: false, xpAwarded: 0 });
      return;
    }

    const completion = await awardLessonCompletion(request.user!, lesson, 10);
    response.json({
      isCorrect: true,
      xpAwarded: completion.awarded ? 10 : 0,
      alreadyCompleted: !completion.awarded,
      user: completion.user,
    });
  }),
);

app.post(
  "/score",
  requireAuth,
  asyncHandler(async (request, response) => {
    if (!config.ENABLE_DEMO_TEXT_SCORING) {
      throw new HttpError(503, "SCORING_UNAVAILABLE", "Penilaian suara belum tersedia.");
    }
    const payload = scorePayloadSchema.safeParse(request.body);
    if (!payload.success) {
      throw new HttpError(400, "INVALID_PAYLOAD", "Payload skor pelafalan tidak valid.");
    }

    const lesson = getLesson(payload.data.lessonId);
    if (!lesson) {
      throw new HttpError(404, "LESSON_NOT_FOUND", "Materi tidak ditemukan.");
    }
    const result = calculatePronunciationScore(lesson.word, payload.data.heard);
    const xpAwarded = result.score >= 80 ? 5 : 0;

    const attempt = await prisma.pronunciationAttempt.create({
      data: {
        userId: request.user!.id,
        lessonId: lesson.id,
        target: lesson.word,
        heard: payload.data.heard,
        score: result.score,
        xpGained: 0,
        feedback: result.feedback,
        pronunciationMatch: result.pronunciationMatch,
        language: lesson.language,
      },
    });

    const completion =
      xpAwarded > 0
        ? await awardLessonCompletion(request.user!, lesson, xpAwarded)
        : null;
    if (completion?.awarded) {
      await prisma.pronunciationAttempt.update({
        where: { id: attempt.id },
        data: { xpGained: xpAwarded },
      });
    }

    const updatedUser =
      completion?.user ??
      (await prisma.user.findUniqueOrThrow({
        where: { id: request.user!.id },
        select: { username: true, xp: true, streak: true, lessonsCompleted: true },
      }));

    response.json({
      ...result,
      xpGained: completion?.awarded ? xpAwarded : 0,
      user: completion?.user ?? userSummary(updatedUser),
    });
  }),
);

app.use((_request, _response, next) => {
  next(new HttpError(404, "NOT_FOUND", "Endpoint tidak ditemukan."));
});

const errorHandler: ErrorRequestHandler = (error: unknown, request, response, _next) => {
  const typedRequest = request as AuthenticatedRequest;
  const requestId = typedRequest.requestId ?? randomUUID();
  const isHttpError = error instanceof HttpError;
  const status =
    isHttpError
      ? error.status
      : typeof error === "object" && error !== null && "status" in error &&
          typeof error.status === "number" && error.status >= 400 && error.status < 500
        ? error.status
        : 500;

  if (status >= 500) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "request_failed",
        requestId,
        errorName: error instanceof Error ? error.name : "UnknownError",
      }),
    );
  }

  response.status(status).json({
    error: {
      code: isHttpError ? error.code : status === 400 ? "INVALID_REQUEST" : "INTERNAL_ERROR",
      message: isHttpError
        ? error.message
        : status === 400
          ? "Permintaan tidak valid."
          : "Terjadi kesalahan internal.",
      requestId,
    },
  });
};

app.use(errorHandler);

const server = createServer(app);

const start = async () => {
  await prisma.$connect();
  server.listen(config.PORT, () => {
    console.log(
      JSON.stringify({
        level: "info",
        event: "server_started",
        port: config.PORT,
        environment: config.NODE_ENV,
      }),
    );
  });
};

const shutdown = async (signal: string) => {
  console.log(JSON.stringify({ level: "info", event: "server_shutdown", signal }));
  server.close(async (error) => {
    if (error) {
      console.error(JSON.stringify({ level: "error", event: "http_shutdown_failed" }));
      process.exitCode = 1;
    }
    await prisma.$disconnect();
  });
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

if (process.env.NODE_ENV !== "test") {
  void start().catch(async (error: unknown) => {
    console.error(
      JSON.stringify({
        level: "fatal",
        event: "startup_failed",
        errorName: error instanceof Error ? error.name : "UnknownError",
      }),
    );
    await prisma.$disconnect();
    process.exitCode = 1;
  });
}

export { app };
