import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import {
  Module,
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
} from "@nestjs/common";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { json } from "express";
import { rateLimit } from "express-rate-limit";
import { AuthController, PublicController } from "./auth";
import { DomainController } from "./domain";
import { db, migrate } from "./db";
import { origins } from "./security";
import { startWorker } from "./mail";
@Catch()
class Errors implements ExceptionFilter {
  catch(error: any, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    if (res.headersSent) return;
    let status = 500,
      message = "Erreur interne";
    if (error instanceof HttpException) {
      status = error.getStatus();
      const response = error.getResponse();
      message =
        typeof response === "string" ? response : (response as any).message;
    } else if (error.code === "23505") {
      status = 409;
      message = "Une entrée identique existe déjà";
    } else if (["23503", "23514", "22P02"].includes(error.code)) {
      status = 400;
      message = "Données incohérentes";
    } else console.error("API error", error.message);
    res.status(status).json({ message });
  }
}
@Module({ controllers: [AuthController, PublicController, DomainController] })
class AppModule {}
async function start() {
  await migrate();
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const proxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
  if (!Number.isInteger(proxyHops) || proxyHops < 0 || proxyHops > 2)
    throw new Error("TRUST_PROXY_HOPS invalide");
  if (proxyHops)
    app.getHttpAdapter().getInstance().set("trust proxy", proxyHops);
  app.use(helmet());
  app.use(json({ limit: "8mb" }));
  app.use(cookieParser());
  app.use(
    "/api/auth",
    rateLimit({
      windowMs: 15 * 60000,
      limit: process.env.NODE_ENV === "test" ? 1000 : 80,
      skip: (req) => req.method === "GET" || req.path === "/logout",
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { message: "Trop de tentatives. Réessayez plus tard." },
    }),
  );
  app.use(
    "/api/public/contact",
    rateLimit({
      windowMs: 3600000,
      limit: 10,
      message: { message: "Réessayez plus tard." },
    }),
  );
  app.enableCors({
    origin: (
      origin: string | undefined,
      cb: (error: Error | null, allow?: boolean) => void,
    ) => cb(null, !origin || origins().has(origin)),
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
  });
  app.useGlobalFilters(new Errors());
  app.enableShutdownHooks();
  startWorker();
  const port = Number(process.env.PORT ?? 4100);
  await app.listen(port, process.env.API_BIND ?? "0.0.0.0");
  console.log(`Midad API: http://localhost:${port}`);
  for (const signal of ["SIGTERM", "SIGINT"] as const)
    process.once(signal, async () => {
      await app.close();
      await db.end();
    });
}
start().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
