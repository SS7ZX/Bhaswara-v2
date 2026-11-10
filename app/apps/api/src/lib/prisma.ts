import { PrismaPg } from "@prisma/adapter-pg";

import { config } from "../config.js";
import { PrismaClient } from "../generated/prisma/client.js";

const prismaGlobal = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

const createPrismaClient = () => {
  const adapter = new PrismaPg({
    connectionString: config.DATABASE_URL,
    max: 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
  });

  return new PrismaClient({ adapter });
};

export const prisma = prismaGlobal.prisma ?? createPrismaClient();

if (config.NODE_ENV !== "production") {
  prismaGlobal.prisma = prisma;
}
