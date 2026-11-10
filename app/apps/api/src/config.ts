import "dotenv/config";

import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url().refine(
    (value) => value.startsWith("postgresql://") || value.startsWith("postgres://"),
    { message: "DATABASE_URL must use PostgreSQL." },
  ),
  JWT_SECRET: z.string().refine((value) => Buffer.byteLength(value, "utf8") >= 32, {
    message: "JWT_SECRET must contain at least 32 bytes.",
  }),
  CORS_ORIGINS: z.string().default(""),
  ENABLE_DEMO_TEXT_SCORING: z.preprocess((value) => value === "true", z.boolean()).default(false),
});

const parsedEnvironment = environmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  const issues = parsedEnvironment.error.issues.map(
    ({ path, message }) => `${path.join(".")}: ${message}`,
  );
  throw new Error(`Invalid API environment configuration: ${issues.join("; ")}`);
}

const environment = parsedEnvironment.data;
const corsOrigins = environment.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean);

if (environment.NODE_ENV === "production" && corsOrigins.length === 0) {
  throw new Error("CORS_ORIGINS must contain at least one trusted origin in production.");
}

if (environment.NODE_ENV === "production" && environment.ENABLE_DEMO_TEXT_SCORING) {
  throw new Error("ENABLE_DEMO_TEXT_SCORING cannot be enabled in production.");
}

export const config = {
  ...environment,
  corsOrigins:
    corsOrigins.length > 0
      ? corsOrigins
      : ["http://localhost:19006", "http://localhost:5173"],
};
