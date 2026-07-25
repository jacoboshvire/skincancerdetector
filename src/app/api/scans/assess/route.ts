import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb, ProfileRow } from "@/lib/db";
import { getSession } from "@/lib/session";
import { HAM10000_CLASSES, malignantRiskFromProbabilities, topPrediction } from "@/lib/modelClasses";
import { assessSymptoms } from "@/lib/symptomRisk";
import { combineRisk } from "@/lib/riskFusion";

const schema = z.object({
  probabilities: z.array(z.number()).length(HAM10000_CLASSES.length),
  bodyLocation: z.string().max(100).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

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

  const { probabilities, bodyLocation, notes } = parsed.data;
  const malignantRisk = malignantRiskFromProbabilities(probabilities);
  const symptomAssessment = assessSymptoms(notes);

  const sql = await getDb();

  const [{ rows: profileRows }, priorScans] = await Promise.all([
    sql`SELECT * FROM profiles WHERE user_id = ${session.userId}`,
    bodyLocation
      ? sql`
          SELECT malignant_risk, created_at FROM scans
          WHERE user_id = ${session.userId} AND body_location = ${bodyLocation}
          ORDER BY created_at DESC LIMIT 10
        `
      : Promise.resolve({ rows: [] }),
  ]);
  const profile = profileRows[0] as ProfileRow | undefined;

  const { combinedRisk, factors } = combineRisk({
    imageMalignantRisk: malignantRisk,
    symptomAssessment,
    dateOfBirth: profile?.date_of_birth ?? null,
    familyHistorySkinCancer: profile?.family_history_skin_cancer ?? false,
    priorScansAtLocation: priorScans.rows.map((r) => ({
      malignantRisk: Number(r.malignant_risk),
      createdAt: Number(r.created_at),
    })),
  });

  return NextResponse.json({
    malignantRisk,
    top: topPrediction(probabilities),
    symptomAssessment,
    combinedRisk,
    factors,
  });
}
