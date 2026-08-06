import type { PrismaClient } from "@repo/db/generated/prisma/client";
import type { OutreachDashboardClient } from "@repo/utils/src/outreach-dashboard/client";

interface SyncResult {
  programId: string | null;
  imported: number;
  updated: number;
  errors: number;
}

/**
 * Syncs Program + ProgramMember records from the Outreach Dashboard.
 *
 * - Program comes from course.json (name/slug/school/start/end).
 * - Members come from users.json, where each participant carries enrolled_at —
 *   the timestamp used for edit attribution (edits before enrolledAt are
 *   excluded from program metrics).
 *
 * Idempotent: upserts by unique keys (program name/slug; programId+editorId).
 */
export class ProgramSyncService {
  private readonly prisma: PrismaClient;
  private readonly dashboardClient: OutreachDashboardClient;

  constructor(prisma: PrismaClient, dashboardClient: OutreachDashboardClient) {
    this.prisma = prisma;
    this.dashboardClient = dashboardClient;
  }

  async syncProgram(
    school: string,
    slug: string,
  ): Promise<SyncResult> {
    const startTime = Date.now();
    let programId: string | null = null;
    let imported = 0;
    let updated = 0;
    let errors = 0;

    // Data window starts 2026-01-01 (fresh start; no historical data before this).
    const DATA_START = new Date(Date.UTC(2026, 0, 1));

    try {
      const [courseData, userData] = await Promise.all([
        this.dashboardClient.getCourse(school, slug),
        this.dashboardClient.getUsers(school, slug),
      ]);

      const course = courseData.course;
      const courseStart = new Date(course.start);
      // Clamp program window to data start (ignore pre-2026 history).
      const programStart = courseStart < DATA_START ? DATA_START : courseStart;
      const program = await this.prisma.program.upsert({
        where: { slug },
        create: {
          name: course.title || slug,
          slug,
          school: course.school || school,
          startAt: programStart,
          endAt: new Date(course.end),
          source: "outreach_dashboard",
        },
        update: {
          name: course.title || slug,
          school: course.school || school,
          startAt: programStart,
          endAt: new Date(course.end),
          updatedAt: new Date(),
        },
      });
      programId = program.id;

      const allUsers = userData.course?.users ?? userData.users ?? [];
      const participants = allUsers.filter((user) => user.role === 0);

      for (const user of participants) {
        try {
          const normalizedUsername = String(user.username)
            .normalize("NFC")
            .replace(/\s+/g, "_");
          let enrolledAt = typeof user.enrolled_at === "string" ? new Date(user.enrolled_at) : null;
          if (!enrolledAt || Number.isNaN(enrolledAt.getTime())) {
            errors += 1;
            continue;
          }
          // Clamp enrollment to data start (attribution only counts from 2026-01-01).
          if (enrolledAt < DATA_START) enrolledAt = DATA_START;

          // Ensure editor exists. Do NOT set externalId here: it may already be
          // claimed by another editor record (syncEditorsFromDashboard owns it),
          // and a unique-constraint violation would abort the member sync.
          const editor = await this.prisma.editor.upsert({
            where: { username: normalizedUsername },
            create: {
              username: normalizedUsername,
              source: "outreach_dashboard",
              isActive: true,
            },
            update: {
              isActive: true,
              updatedAt: new Date(),
            },
          });

          const member = await this.prisma.programMember.upsert({
            where: { programId_editorId: { programId: program.id, editorId: editor.id } },
            create: {
              programId: program.id,
              editorId: editor.id,
              enrolledAt,
              externalId: user.id != null ? String(user.id) : null,
              isActive: true,
            },
            update: {
              enrolledAt,
              externalId: user.id != null ? String(user.id) : null,
              isActive: true,
            },
          });

          if (member.createdAt.getTime() > startTime - 1000) {
            imported += 1;
          } else {
            updated += 1;
          }
        } catch (error) {
          errors += 1;
          console.warn(
            `[ProgramSync] member sync failed for ${user.username}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      return { programId, imported, updated, errors };
    } catch (error) {
      console.error(
        `[ProgramSync] program sync failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { programId: null, imported, updated, errors: errors + 1 };
    }
  }
}
