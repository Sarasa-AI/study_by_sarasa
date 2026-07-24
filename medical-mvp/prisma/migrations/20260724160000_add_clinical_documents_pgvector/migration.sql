-- Enable pgvector for clinical document embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "ClinicalDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalDocument_pkey" PRIMARY KEY ("id")
);
