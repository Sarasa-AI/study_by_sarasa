/**
 * RAG seed script — ingests a mock pediatric clinical knowledge base,
 * then generates and publishes grounded cases via generateCaseWithRAG.
 *
 * Prerequisites: run `npm run prisma:seed` first (categories + instructor).
 * Usage: `npm run prisma:seed:rag`
 *
 * Leaves prisma/seed.ts untouched as the safe fallback.
 */

import { Prisma, Role } from "@prisma/client";
import { buildPatientInfoFromAi } from "@/lib/ai-schemas";
import { casePayloadSchema } from "@/lib/case-schema";
import { createCase } from "@/lib/case-service";
import { getLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { generateCaseWithRAG, ingestClinicalText } from "@/lib/rag";

type CorpusEntry = {
  title: string;
  content: string;
  source: string;
  topic: string;
  categorySlug?: string;
  metadata?: { urlOrDoi?: string };
};

const MOCK_CORPUS: CorpusEntry[] = [
  {
    title: "Pediatric Asthma Exacerbation — ED Protocol",
    topic: "pediatric asthma exacerbation emergency management",
    source: "GINA 2024 / NAEPP EPR-4 — Pediatric Asthma Exacerbation Guidance",
    metadata: { urlOrDoi: "https://ginasthma.org/" },
    content: `Pediatric asthma exacerbation assessment begins with rapid triage of respiratory distress. Classify severity using respiratory rate, accessory muscle use, ability to speak in sentences, oxygen saturation, and peak expiratory flow (PEF) or FEV1 when age-appropriate. Mild exacerbation: speaking in full sentences, SpO2 ≥94% on room air, mild tachypnea. Moderate: speaking in phrases, SpO2 90–93%, increased work of breathing. Severe: speaking in words only, SpO2 <90%, marked accessory muscle use, silent chest, or altered mental status — treat as a medical emergency.

Initial pharmacologic therapy centers on repeated short-acting beta-agonist (SABA) nebulization or MDI with spacer. For moderate-to-severe exacerbations give nebulized albuterol (salbutamol) 2.5–5 mg every 20 minutes for three doses, then continuously or hourly as needed. Add ipratropium bromide 0.25–0.5 mg with the first three SABA doses in moderate-severe exacerbations; anticholinergic combination reduces hospitalization rates. Administer systemic corticosteroids early — oral prednisolone/prednisone 1–2 mg/kg (max 40–60 mg) or IV methylprednisolone if vomiting or severe distress. Do not delay steroids pending PEF response.

Adjunctive therapy for severe, refractory disease includes IV magnesium sulfate 25–75 mg/kg (max 2 g) over 20 minutes, and consideration of epinephrine or terbutaline in life-threatening status asthmaticus. Supplemental oxygen titrate to SpO2 94–98%. Avoid routine chest radiography unless suspecting pneumothorax, foreign body, or consolidation. Disposition: discharge when work of breathing is minimal, SpO2 stable on room air, and the child tolerates spaced SABA (every 3–4 hours) with a written asthma action plan, controller review, and follow-up within 24–72 hours. Admit children with persistent hypoxia, incomplete response after three hours of intensive therapy, prior ICU intubation, or social barriers to safe outpatient care.`,
  },
  {
    title: "Neonatal Hyperbilirubinemia — Evaluation and Phototherapy",
    topic: "neonatal jaundice phototherapy management bilirubin",
    source: "AAP Clinical Practice Guideline — Hyperbilirubinemia in Neonates ≥35 Weeks Gestation (2022)",
    metadata: { urlOrDoi: "https://doi.org/10.1542/peds.2022-058859" },
    content: `Neonatal jaundice is common; pathologic hyperbilirubinemia requires structured risk assessment to prevent acute bilirubin encephalopathy and kernicterus. Measure total serum bilirubin (TSB) or transcutaneous bilirubin (TcB) whenever jaundice is visible in the first 24 hours of life, or when jaundice appears excessive for age. Plot TSB on hour-specific nomograms that incorporate gestational age and neurotoxicity risk factors (isoimmune hemolytic disease, G6PD deficiency, asphyxia, sepsis, acidosis, albumin <3.0 g/dL, and clinical instability).

Phototherapy thresholds are gestational-age and risk-stratified. For a well term infant ≥38 weeks without neurotoxicity risk factors, phototherapy may begin near 15–18 mg/dL at 48–72 hours of age (exact threshold from the AAP 2022 figure); lower thresholds apply for late-preterm infants and those with risk factors. Intensive phototherapy uses blue-green light (peak ~460–490 nm) with maximal body-surface exposure, appropriate irradiance (≥30 µW/cm²/nm), and eye protection. Recheck TSB within 4–6 hours of starting intensive phototherapy if near exchange levels, otherwise within 8–12 hours.

Evaluate cause when jaundice is early (<24 h), rising rapidly (>0.2 mg/dL/h), or conjugated bilirubin is elevated. Check blood type, direct Coombs, CBC with smear, reticulocyte count, G6PD if indicated, and fractionated bilirubin. Support breastfeeding: frequent feeds (8–12 times/day), lactation support, and supplementation only when weight loss, dehydration, or rising bilirubin warrant it. Escalate to exchange transfusion when TSB exceeds exchange thresholds despite intensive phototherapy, or when signs of acute bilirubin encephalopathy appear (lethargy, hypotonia progressing to hypertonia, opisthotonus, high-pitched cry). After phototherapy discontinuation, check rebound TSB based on etiology and age; arrange outpatient follow-up within 24–48 hours for neonates discharged with elevated bilirubin.`,
  },
  {
    title: "Kawasaki Disease — Diagnostic Criteria and Acute Management",
    topic: "Kawasaki disease diagnostic criteria IVIG aspirin",
    source: "AHA Scientific Statement — Diagnosis, Treatment, and Long-Term Management of Kawasaki Disease (2017)",
    metadata: { urlOrDoi: "https://doi.org/10.1161/CIR.0000000000000484" },
    content: `Kawasaki disease (KD) is an acute medium-vessel vasculitis of childhood and the leading cause of acquired heart disease in children in developed countries. Classic KD requires fever lasting ≥5 days plus at least four of five principal clinical criteria: (1) bilateral nonexudative bulbar conjunctival injection; (2) oral mucosal changes (strawberry tongue, cracked red lips, injected pharynx); (3) peripheral extremity changes (erythema/edema of hands/feet in acute phase; periungual desquamation in subacute phase); (4) polymorphous rash; and (5) cervical lymphadenopathy (≥1.5 cm, usually unilateral). Incomplete KD should be considered in infants and children with prolonged fever and fewer criteria when laboratory and echocardiographic findings support the diagnosis.

Laboratory support includes elevated CRP and/or ESR, anemia, thrombocytosis (often after day 7), sterile pyuria, hypoalbuminemia, elevated ALT, and leukocytosis. Obtain echocardiography as soon as KD is suspected — do not delay treatment awaiting echo. Assess coronary artery dimensions with z-scores of the left anterior descending and right coronary arteries; z-score ≥2.5 indicates dilation/aneurysm risk stratification.

First-line acute therapy is a single infusion of intravenous immunoglobulin (IVIG) 2 g/kg over 10–12 hours plus moderate-to-high dose aspirin (30–50 mg/kg/day divided, or historically up to 80–100 mg/kg/day during the acute febrile phase, then transition to low-dose 3–5 mg/kg/day once afebrile). Treat ideally within 10 days of fever onset; treat after day 10 if fever persists with inflammation or coronary involvement. IVIG resistance (recrudescent or persistent fever ≥36 hours after IVIG completion) warrants second-line therapy such as a second IVIG dose, IV methylprednisolone, or infliximab per institutional protocol. Cardiology follow-up with serial echocardiography (typically at diagnosis, 1–2 weeks, and 4–6 weeks) guides duration of antiplatelet therapy and activity restrictions. Live vaccines are deferred for 11 months after IVIG.`,
  },
  {
    title: "Febrile Infant 29–60 Days — Risk Stratification and Workup",
    topic: "febrile infant 29-60 days sepsis workup antibiotics",
    source: "AAP Clinical Practice Guideline — Evaluation and Management of Well-Appearing Febrile Infants 8–60 Days Old (2021)",
    metadata: { urlOrDoi: "https://doi.org/10.1542/peds.2021-052228" },
    content: `Fever in young infants (rectal temperature ≥38.0°C) demands careful risk stratification because clinical appearance alone cannot reliably exclude invasive bacterial infection (IBI) such as bacteremia and bacterial meningitis. For well-appearing infants 29–60 days of age, the AAP 2021 guideline supports shared decision-making pathways that use inflammatory markers and urinalysis to guide lumbar puncture and empiric antibiotics, while recognizing that infants 8–21 days remain highest risk and generally require full evaluation including CSF.

Minimum evaluation for a well-appearing febrile infant 29–60 days includes urine testing (catheter or SPA specimen for urinalysis and culture) and blood culture. Obtain inflammatory markers: procalcitonin (preferred when available), CRP, and/or ANC. Low-risk criteria typically require reassuring inflammatory markers (e.g., PCT ≤0.5 ng/mL or CRP ≤20 mg/L and ANC ≤4000–5200/µL depending on the pathway used) plus a negative urinalysis. Infants meeting low-risk criteria may be managed with close outpatient follow-up without lumbar puncture or empiric antibiotics when caregivers are reliable and return access is assured.

If inflammatory markers are elevated, urinalysis is positive, or the infant appears ill, perform lumbar puncture when meningitis cannot be excluded and start empiric parenteral antibiotics covering common pathogens (ampicillin plus gentamicin or a third-generation cephalosporin; add acyclovir when HSV risk factors are present — maternal primary HSV, seizures, CSF pleocytosis, or vesicular lesions). HSV evaluation is especially important under 21–28 days. Hospitalize infants who receive empiric antibiotics pending culture results, those with unreliable follow-up, and all ill-appearing infants. Counsel families that viral illness remains the most common cause, but delayed recognition of IBI carries substantial morbidity — shared decisions must document risk communication and a concrete return precautions plan.`,
  },
  {
    title: "Viral Bronchiolitis — Supportive Care Clinical Practice",
    topic: "bronchiolitis supportive care infants RSV",
    source: "AAP Clinical Practice Guideline — The Diagnosis, Management, and Prevention of Bronchiolitis (2014, reaffirmed)",
    metadata: { urlOrDoi: "https://doi.org/10.1542/peds.2014-2742" },
    content: `Bronchiolitis is a viral lower respiratory tract infection of infants and young children, most often caused by respiratory syncytial virus (RSV), characterized by rhinorrhea, cough, wheezing, crackles, and varying degrees of respiratory distress and hypoxia. Diagnosis is clinical. Routine laboratory testing and chest radiography are not recommended for typical uncomplicated bronchiolitis; imaging may increase unnecessary antibiotic use and should be reserved for severe disease, diagnostic uncertainty, or suspected complications such as pneumothorax.

Management is supportive. Assess hydration, work of breathing, and oxygenation. Provide nasal suctioning with saline as needed, and supplemental oxygen when SpO2 persistently falls below approximately 90–92% (institutional thresholds vary; AAP suggests against continuous pulse oximetry in stable infants once improving). Maintain hydration with frequent breastfeeding/bottle feeding or IV/NG fluids if oral intake is inadequate due to tachypnea. Do not routinely administer albuterol, epinephrine, systemic corticosteroids, chest physiotherapy, or antibiotics — high-quality evidence shows no meaningful improvement in clinically meaningful outcomes for typical viral bronchiolitis, and treatments add adverse effects and cost.

Risk factors for severe disease include age <12 weeks, prematurity, hemodynamically significant congenital heart disease, chronic lung disease, immunodeficiency, and suboptimal social circumstances. Admit infants with hypoxia requiring oxygen, marked distress, dehydration, apnea, or inability to maintain oral intake. Continuous cardiorespiratory monitoring is appropriate for high-risk or unstable infants. Counsel caregivers on expected illness duration (often 1–2 weeks of symptoms), nasal suctioning technique, hydration goals, and return precautions (apnea, poor feeding, cyanosis, lethargy). Prevention strategies include hand hygiene, limiting exposure of high-risk infants during RSV season, and monoclonal antibody prophylaxis (nirsevimab or palivizumab per current eligibility criteria) for selected high-risk infants.`,
  },
];

function urlOrDoiFromMetadata(metadata: Prisma.JsonValue): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const record = metadata as Record<string, unknown>;
  const value = record.urlOrDoi ?? record.url ?? record.doi;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function validateEnv(): void {
  const missing: string[] = [];
  if (!process.env.DATABASE_URL?.trim()) missing.push("DATABASE_URL");
  if (!process.env.OPENROUTER_API_KEY?.trim()) missing.push("OPENROUTER_API_KEY");
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        "Ensure medical-mvp/.env is configured before running prisma:seed:rag.",
    );
  }
}

async function resolveInstructor() {
  const byCode = await prisma.user.findFirst({
    where: { studentCode: "INST001", role: Role.INSTRUCTOR },
    select: { id: true, name: true, studentCode: true },
  });
  if (byCode) return byCode;

  return prisma.user.findFirst({
    where: { role: Role.INSTRUCTOR },
    select: { id: true, name: true, studentCode: true },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Remove previously RAG-seeded cases (identified via Citation.text matching corpus sources)
 * so re-runs stay idempotent without wiping base seed cases.
 */
async function cleanupPriorRagCases(sources: string[], logger: ReturnType<typeof getLogger>) {
  const citations = await prisma.citation.findMany({
    where: {
      text: { in: sources },
      caseId: { not: null },
    },
    select: { caseId: true },
  });

  const caseIds = [...new Set(citations.map((c) => c.caseId).filter((id): id is string => Boolean(id)))];
  if (caseIds.length === 0) {
    logger.info({ event: "seed-rag.cleanup.skip" }, "No prior RAG-seeded cases to remove");
    return;
  }

  await prisma.quizResult.deleteMany({ where: { caseId: { in: caseIds } } });
  await prisma.userProgress.deleteMany({ where: { caseId: { in: caseIds } } });
  await prisma.userBookmark.deleteMany({ where: { caseId: { in: caseIds } } });
  await prisma.userNote.deleteMany({ where: { caseId: { in: caseIds } } });
  await prisma.flashcard.updateMany({
    where: { caseId: { in: caseIds } },
    data: { caseId: null },
  });

  const deleted = await prisma.case.deleteMany({ where: { id: { in: caseIds } } });
  logger.info(
    { event: "seed-rag.cleanup.done", deletedCases: deleted.count, caseIds },
    `Removed ${deleted.count} prior RAG-seeded case(s)`,
  );
}

async function main() {
  const logger = getLogger();
  validateEnv();

  logger.info({ event: "seed-rag.start" }, "Starting RAG seed");

  const instructor = await resolveInstructor();
  if (!instructor) {
    throw new Error(
      "No instructor user found. Run `npm run prisma:seed` first to create categories and users.",
    );
  }

  const pediatrics = await prisma.category.findUnique({
    where: { slug: "pediatrics" },
    select: { id: true, name: true, slug: true },
  });
  if (!pediatrics) {
    throw new Error(
      'Category slug "pediatrics" not found. Run `npm run prisma:seed` first to create categories and users.',
    );
  }

  const corpusSources = MOCK_CORPUS.map((e) => e.source);
  await cleanupPriorRagCases(corpusSources, logger);

  // --- Ingestion phase ---
  logger.info({ event: "seed-rag.ingest.start" }, "Clearing ClinicalDocument table");
  await prisma.clinicalDocument.deleteMany({});

  let totalChunks = 0;
  for (const entry of MOCK_CORPUS) {
    logger.info(
      { event: "seed-rag.ingest.document", title: entry.title, source: entry.source },
      "Ingesting corpus entry",
    );
    const result = await ingestClinicalText(
      entry.title,
      entry.content,
      entry.source,
      entry.metadata ?? {},
    );
    totalChunks += result.chunkCount;
    logger.info(
      {
        event: "seed-rag.ingest.chunked",
        title: entry.title,
        chunkCount: result.chunkCount,
        documentIds: result.documentIds,
      },
      `Embedded ${result.chunkCount} chunk(s)`,
    );
  }

  logger.info(
    {
      event: "seed-rag.ingest.complete",
      corpusEntries: MOCK_CORPUS.length,
      totalChunks,
    },
    "Knowledge base ingestion complete",
  );

  // --- Generation & persistence phase ---
  let publishedCount = 0;
  let failedCount = 0;

  for (const entry of MOCK_CORPUS) {
    const slug = entry.categorySlug ?? "pediatrics";
    try {
      const category =
        slug === "pediatrics"
          ? pediatrics
          : await prisma.category.findUnique({
              where: { slug },
              select: { id: true, name: true, slug: true },
            });

      if (!category) {
        throw new Error(`Category slug "${slug}" not found`);
      }

      logger.info(
        { event: "seed-rag.generate.start", topic: entry.topic, category: category.name },
        "Generating RAG case",
      );

      const ragResult = await generateCaseWithRAG({
        topic: entry.topic,
        categoryName: category.name,
        questionCount: 1,
        retrievalLimit: 3,
      });

      const payload = casePayloadSchema.parse({
        title: ragResult.case.title,
        categoryId: category.id,
        instructorId: instructor.id,
        chiefComplaint: ragResult.case.chiefComplaint,
        patientInfo: buildPatientInfoFromAi(ragResult.case),
        mediaUrl: null,
        mediaType: null,
        symptoms: ragResult.case.symptoms,
        diagnosis: ragResult.case.diagnosis,
        differentialDiagnosis: ragResult.case.differentialDiagnosis,
        management: ragResult.case.management,
        teachingPoints: ragResult.case.teachingPoints,
        status: "PUBLISHED",
        questions: ragResult.case.questions.map((question) => ({
          questionText: question.questionText,
          optionA: question.optionA,
          optionB: question.optionB,
          optionC: question.optionC,
          optionD: question.optionD,
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
          clinicalReasoning: question.clinicalReasoning,
          distractorRationales: question.distractorRationales,
        })),
      });

      const created = await prisma.$transaction(async (tx) => {
        const kase = await createCase(tx, payload);

        const citationsBySource = new Map<string, string | null>();
        for (const source of ragResult.citationSources) {
          if (!citationsBySource.has(source)) {
            citationsBySource.set(source, null);
          }
        }
        for (const doc of ragResult.retrievedDocuments) {
          if (!citationsBySource.has(doc.source)) continue;
          if (citationsBySource.get(doc.source)) continue;
          citationsBySource.set(doc.source, urlOrDoiFromMetadata(doc.metadata));
        }

        if (citationsBySource.size > 0) {
          await tx.citation.createMany({
            data: [...citationsBySource.entries()].map(([text, urlOrDoi]) => ({
              text,
              urlOrDoi,
              caseId: kase.id,
            })),
          });
        }

        return kase;
      });

      publishedCount += 1;
      logger.info(
        {
          event: "seed-rag.case.created",
          caseId: created.id,
          title: created.title,
          citationSources: ragResult.citationSources,
          retrievedCount: ragResult.retrievedDocuments.length,
        },
        "Published RAG case",
      );
    } catch (err) {
      failedCount += 1;
      const message = err instanceof Error ? err.message : String(err);
      logger.error(
        {
          event: "seed-rag.case.failed",
          topic: entry.topic,
          title: entry.title,
          err: { message },
        },
        "Failed to generate/persist RAG case; continuing",
      );
    }
  }

  logger.info(
    {
      event: "seed-rag.complete",
      corpusEntries: MOCK_CORPUS.length,
      totalChunks,
      publishedCount,
      failedCount,
      instructorId: instructor.id,
    },
    `RAG seed finished: ${totalChunks} chunks ingested, ${publishedCount} case(s) published, ${failedCount} failed`,
  );

  if (publishedCount === 0) {
    throw new Error("RAG seed produced no published cases. Check API keys and LLM availability.");
  }
}

main()
  .catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    getLogger().error({ event: "seed-rag.failed", err: { message } }, "RAG seed failed");
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
