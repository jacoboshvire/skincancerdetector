import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, ProfileRow } from "@/lib/db";
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

  const row = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(session.userId) as
    | ProfileRow
    | undefined;

  return NextResponse.json({
    profile: row
      ? {
          fullName: row.full_name,
          dateOfBirth: row.date_of_birth,
          sex: row.sex,
          familyHistorySkinCancer: !!row.family_history_skin_cancer,
          notes: row.notes,
          updatedAt: row.updated_at,
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
  db.prepare(
    `INSERT INTO profiles (user_id, full_name, date_of_birth, sex, family_history_skin_cancer, notes, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       full_name = excluded.full_name,
       date_of_birth = excluded.date_of_birth,
       sex = excluded.sex,
       family_history_skin_cancer = excluded.family_history_skin_cancer,
       notes = excluded.notes,
       updated_at = excluded.updated_at`
  ).run(
    session.userId,
    d.fullName ?? null,
    d.dateOfBirth ?? null,
    d.sex ?? null,
    d.familyHistorySkinCancer ? 1 : 0,
    d.notes ?? null,
    Date.now()
  );

  return NextResponse.json({ success: true });
}
