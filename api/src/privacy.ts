import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Req,
  Res,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { Response } from "express";
import { z } from "zod";
import { adminRoles } from "@midad/shared";
import { AuthGuard, AuthRequest, parse, permit, uuid } from "./security";
import { db, transaction } from "./db";
import { requireRecent, securityEvent, enforceRate } from "./protection";
@Controller("api/privacy")
@UseGuards(AuthGuard)
export class PrivacyController {
  @Get("notice") async notice(@Req() req: AuthRequest) {
    const school = (
      await db.query(
        "SELECT name,address,privacy_contact,dpo_name,retention_policy,processing_basis FROM tenants WHERE id=$1",
        [req.user.tenant_id],
      )
    ).rows[0];
    return {
      school,
      demo:
        process.env.MIDAD_DEMO_ENABLED === "true" ||
        req.user.slug === "midad-local",
      hosting:
        process.env.RENDER === "true"
          ? "Render · Francfort (Allemagne)"
          : "Hébergement configuré par l’exploitant",
      security_log_days: 180,
    };
  }
  @Get("export") async exportSelf(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await requireRecent(req);
    await enforceRate("privacy-export:" + req.user.id, 5, 3600);
    const data: Record<string, unknown> = {
      exported_at: new Date().toISOString(),
      profile: req.user,
    };
    const own = (
      await db.query(
        "SELECT id FROM students WHERE tenant_id=$1 AND (parent_id=$2 OR user_id=$2)",
        [req.user.tenant_id, req.user.id],
      )
    ).rows.map((r) => r.id);
    data.students = (
      await db.query(
        "SELECT * FROM students WHERE tenant_id=$1 AND id=ANY($2::uuid[])",
        [req.user.tenant_id, own],
      )
    ).rows;
    data.enrollments = (
      await db.query(
        "SELECT * FROM enrollments WHERE tenant_id=$1 AND student_id=ANY($2::uuid[])",
        [req.user.tenant_id, own],
      )
    ).rows;
    data.attendance = (
      await db.query(
        "SELECT * FROM attendance WHERE tenant_id=$1 AND student_id=ANY($2::uuid[])",
        [req.user.tenant_id, own],
      )
    ).rows;
    data.invoices = (
      await db.query(
        "SELECT * FROM invoice_balances WHERE tenant_id=$1 AND student_id=ANY($2::uuid[])",
        [req.user.tenant_id, own],
      )
    ).rows;
    data.payments = (
      await db.query(
        "SELECT p.id,p.invoice_id,p.amount_centimes,p.kind,p.method,p.reference,p.receipt_number,p.created_at FROM payments p JOIN invoices i ON i.tenant_id=p.tenant_id AND i.id=p.invoice_id WHERE i.tenant_id=$1 AND i.student_id=ANY($2::uuid[])",
        [req.user.tenant_id, own],
      )
    ).rows;
    data.notifications = (
      await db.query(
        "SELECT title,body,seen,created_at FROM notifications WHERE tenant_id=$1 AND user_id=$2",
        [req.user.tenant_id, req.user.id],
      )
    ).rows;
    data.requests = (
      await db.query(
        "SELECT kind,message,status,response,created_at,due_at,updated_at FROM privacy_requests WHERE tenant_id=$1 AND user_id=$2",
        [req.user.tenant_id, req.user.id],
      )
    ).rows;
    if (req.user.role === "TEACHER")
      data.payroll = (
        await db.query(
          "SELECT teacher_id,amount_centimes,month,reference,created_at FROM payroll_payments WHERE tenant_id=$1 AND teacher_id=$2",
          [req.user.tenant_id, req.user.id],
        )
      ).rows;
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="midad-mes-donnees.json"',
    );
    return data;
  }
  @Get("requests") async requests(@Req() req: AuthRequest) {
    return (
      await db.query(
        "SELECT id,kind,message,status,response,created_at,due_at,updated_at FROM privacy_requests WHERE tenant_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 100",
        [req.user.tenant_id, req.user.id],
      )
    ).rows;
  }
  @Post("requests") async request(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    await enforceRate("privacy-request:" + req.user.id, 10, 86400);
    const v = parse(
      z.object({
        kind: z.enum([
          "access",
          "rectification",
          "erasure",
          "restriction",
          "objection",
          "portability",
        ]),
        message: z.string().trim().min(10).max(3000),
      }),
      body,
    );
    return transaction(async (c) => {
      const r = await c.query(
        "INSERT INTO privacy_requests(tenant_id,user_id,kind,message) VALUES($1,$2,$3,$4) RETURNING id",
        [req.user.tenant_id, req.user.id, v.kind, v.message],
      );
      await securityEvent(
        req.user,
        "privacy.request",
        r.rows[0].id,
        "success",
        c,
      );
      return r.rows[0];
    });
  }
  @Get("admin") async admin(@Req() req: AuthRequest) {
    permit(req.user, adminRoles);
    const profile = (
      await db.query(
        "SELECT privacy_contact,dpo_name,retention_policy,processing_basis FROM tenants WHERE id=$1",
        [req.user.tenant_id],
      )
    ).rows[0];
    const requests = (
      await db.query(
        "SELECT p.*,u.name AS requester,u.email FROM privacy_requests p JOIN users u ON u.id=p.user_id WHERE p.tenant_id=$1 ORDER BY p.created_at DESC LIMIT 200",
        [req.user.tenant_id],
      )
    ).rows;
    return { profile, requests };
  }
  @Post("profile") async profile(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    permit(req.user, adminRoles);
    await requireRecent(req);
    const v = parse(
      z.object({
        privacy_contact: z.email().max(254),
        dpo_name: z.string().trim().min(2).max(120),
        retention_policy: z.string().trim().min(20).max(2000),
        processing_basis: z.string().trim().min(20).max(2000),
      }),
      body,
    );
    await db.query(
      "UPDATE tenants SET privacy_contact=$1,dpo_name=$2,retention_policy=$3,processing_basis=$4 WHERE id=$5",
      [
        v.privacy_contact,
        v.dpo_name,
        v.retention_policy,
        v.processing_basis,
        req.user.tenant_id,
      ],
    );
    await securityEvent(req.user, "privacy.profile", req.user.tenant_id);
    return { ok: true };
  }
  @Patch("requests/:id") async resolve(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    permit(req.user, adminRoles);
    await requireRecent(req);
    const v = parse(
      z.object({
        status: z.enum(["in_progress", "completed", "refused"]),
        response: z.string().trim().min(10).max(3000),
      }),
      body,
    );
    const r = await db.query(
      "UPDATE privacy_requests SET status=$1,response=$2,updated_at=now(),resolved_by=$3 WHERE id=$4 AND tenant_id=$5 RETURNING id",
      [v.status, v.response, req.user.id, uuid(id), req.user.tenant_id],
    );
    if (!r.rowCount) throw new NotFoundException();
    await securityEvent(req.user, "privacy.response", id);
    return { ok: true };
  }
  @Get("journal") async journal(@Req() req: AuthRequest) {
    permit(req.user, adminRoles);
    return (
      await db.query(
        "SELECT s.id,s.user_id,u.name AS actor,s.action,s.resource,s.outcome,s.created_at FROM security_events s LEFT JOIN users u ON u.id=s.user_id WHERE s.tenant_id=$1 ORDER BY s.created_at DESC LIMIT 500",
        [req.user.tenant_id],
      )
    ).rows;
  }
}
