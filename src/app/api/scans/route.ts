import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb, ScanRow } from "@/lib/db";
import { getSession } from "@/lib/session";

const schema = z.object({
  imageName: z.string().max(255).nullable().optional(),
  predictedClass: z.string(),
  predictedLabel: z.string(),
  malignantRisk: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  probabilities: z.array(z.number()),
  bodyLocation: z.string().max(100).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  model: z.string().max(50).optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const sql = await getDb();
  const { rows } = await sql`
    SELECT * FROM scans WHERE user_id = ${session.userId} ORDER BY created_at DESC LIMIT 200
  `;
  const scans = rows as ScanRow[];

  return NextResponse.json({
    scans: scans.map((r) => ({
      id: r.id,
      imageName: r.image_name,
      predictedClass: r.predicted_class,
      predictedLabel: r.predicted_label,
      malignantRisk: r.malignant_risk,
      confidence: r.confidence,
      probabilities: JSON.parse(r.probabilities),
      bodyLocation: r.body_location,
      notes: r.notes,
      favorite: r.favorite,
      model: r.model,
      createdAt: Number(r.created_at),
    })),
  });
}

export async function POST(req: NextRequest) {
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
    INSERT INTO scans
      (user_id, image_name, predicted_class, predicted_label, malignant_risk, confidence, probabilities, body_location, notes, created_at)
    VALUES (
      ${session.userId}, ${d.imageName ?? null}, ${d.predictedClass}, ${d.predictedLabel},
      ${d.malignantRisk}, ${d.confidence}, ${JSON.stringify(d.probabilities)},
      ${d.bodyLocation ?? null}, ${d.notes ?? null}, ${Date.now()}
    )
  `;

  return NextResponse.json({ success: true });
}
