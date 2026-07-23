-- AlterTable
ALTER TABLE "Question" ADD COLUMN "clinicalReasoning" TEXT;
ALTER TABLE "Question" ADD COLUMN "distractorRationales" JSONB;
