import { PrismaPg } from "@prisma/adapter-pg";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { PrismaClient } from "./generated/prisma/client";

const currentDir = dirname(fileURLToPath(import.meta.url));
const rootEnvPath = resolve(currentDir, "../../.env");
const localEnvPath = resolve(currentDir, ".env");

if (existsSync(rootEnvPath)) {
  config({ path: rootEnvPath });
}

if (existsSync(localEnvPath)) {
  config({ path: localEnvPath });
}

const connectionString = process.env.DATABASE_URL!;

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const checkDatabase = async () => {
  await prisma.$queryRaw`SELECT 1`;
};

export { prisma, checkDatabase };
