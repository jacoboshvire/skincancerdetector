import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb, ProfileRow } from "@/lib/db";
import { getSession } from "@/lib/session";

const schema = z.object({
  fullName: z.string().max(200).nullable().optional(),
  dateOfBirth: z.string().max(20).nullable().optional(),
  sex: z.enum(["female", "male", "other", "unspecified"]).nullable().optional(),
  familyHistorySkinCancer: z.boolean().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const sql = await getDb();
  const { rows } = await sql`SELECT * FROM profiles WHERE user_id = ${session.userId}`;
  const row = rows[0] as ProfileRow | undefined;

  return NextResponse.json({
    profile: row
      ? {
          fullName: row.full_name,
          dateOfBirth: row.date_of_birth,
          sex: row.sex,
          familyHistorySkinCancer: row.family_history_skin_cancer,
          notes: row.notes,
          updatedAt: Number(row.updated_at),
        }
      : null,
  });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const d = parsed.data;
  const sql = await getDb();
  await sql`
    INSERT INTO profiles (user_id, full_name, date_of_birth, sex, family_history_skin_cancer, notes, updated_at)
    VALUES (
      ${session.userId}, ${d.fullName ?? null}, ${d.dateOfBirth ?? null}, ${d.sex ?? null},
      ${d.familyHistorySkinCancer ?? false}, ${d.notes ?? null}, ${Date.now()}
    )
    ON CONFLICT (user_id) DO UPDATE SET
      full_name = excluded.full_name,
      date_of_birth = excluded.date_of_birth,
      sex = excluded.sex,
      family_history_skin_cancer = excluded.family_history_skin_cancer,
      notes = excluded.notes,
      updated_at = excluded.updated_at
  `;

  return NextResponse.json({ success: true });
}
