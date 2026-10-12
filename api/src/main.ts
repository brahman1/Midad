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
import { json, Request, Response, NextFunction } from "express";
import { AuthController, PublicController } from "./auth";
import { DomainController } from "./domain";
import { db, migrate } from "./db";
import { origins } from "./security";
import { startWorker } from "./mail";
import { SecurityController } from "./security-account";
import { PrivacyController } from "./privacy";
import {
  maintainSecurity,
  persistentLimiter,
  securityEvent,
} from "./protection";
import { AuthRequest } from "./security";
import { NestInterceptor, ExecutionContext, CallHandler } from "@nestjs/common";
import { mergeMap, catchError, defer } from "rxjs";
class Activity implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const trace = async (outcome: string) => {
      if (req.user && !req.path.startsWith("/api/auth/"))
        await securityEvent(
          req.user,
          req.method === "GET" ? "data.read" : "data.write",
          req.path,
          outcome,
        );
    };
    return next.handle().pipe(
      mergeMap(async (result) => {
        await trace("success");
        return result;
      }),
      catchError((error) =>
        defer(async () => {
          await trace("denied");
          throw error;
        }),
      ),
    );
  }
}
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
    } else if ([400, 413, 415].includes(error.status)) {
      status = error.status;
      message =
        status === 413 ? "Requête trop volumineuse" : "Requête invalide";
    } else
      console.error(
        "API error",
        typeof error.code === "string" ? error.code : "internal",
      );
    res.status(status).json({ message });
  }
}
@Module({
  controllers: [
    AuthController,
    PublicController,
    SecurityController,
    PrivacyController,
    DomainController,
  ],
})
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
  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Cache-Control", "no-store, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });
  app.use(
    "/api",
    persistentLimiter(
      "api-ip",
      600,
      60,
      (req) => req.path === "/public/health",
    ),
  );
  const smallBody = json({ limit: "256kb" }),
    fileBody = json({ limit: "8mb" });
  app.use((req: Request, res: Response, next: NextFunction) =>
    (req.method === "POST" && req.path === "/api/materials"
      ? fileBody
      : smallBody)(req, res, next),
  );
  app.use(cookieParser());
  app.use(
    "/api/auth",
    persistentLimiter(
      "auth-ip",
      120,
      900,
      (req) => req.method === "GET" || req.path === "/logout",
    ),
  );
  app.use("/api/public/contact", persistentLimiter("contact-ip", 10, 3600));
  app.use(
    "/api/security",
    persistentLimiter("security-ip", 60, 900, (req) => req.method === "GET"),
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
  app.useGlobalInterceptors(new Activity());
  app.enableShutdownHooks();
  startWorker();
  await maintainSecurity();
  const maintenance = setInterval(() => {
    void maintainSecurity().catch(() =>
      console.error("Security maintenance failed"),
    );
  }, 3600000);
  maintenance.unref();
  const port = Number(process.env.PORT ?? 4100);
  await app.listen(port, process.env.API_BIND ?? "0.0.0.0");
  console.log(`Midad API: http://localhost:${port}`);
  for (const signal of ["SIGTERM", "SIGINT"] as const)
    process.once(signal, async () => {
      await app.close();
      clearInterval(maintenance);
      await db.end();
    });
}
start().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
