import { prisma } from "@repo/db";

interface AuditLogOptions {
  actorId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function auditLog(options: AuditLogOptions) {
  return prisma.auditLog.create({
    data: {
      actorId: options.actorId,
      action: options.action,
      targetType: options.targetType,
      targetId: options.targetId,
      metadata: options.metadata ? JSON.parse(JSON.stringify(options.metadata)) : {},
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
    },
  });
}
