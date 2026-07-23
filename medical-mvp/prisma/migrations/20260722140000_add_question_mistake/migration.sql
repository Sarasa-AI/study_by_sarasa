-- CreateTable
CREATE TABLE "QuestionMistake" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionMistake_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuestionMistake_userId_isResolved_idx" ON "QuestionMistake"("userId", "isResolved");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionMistake_userId_questionId_key" ON "QuestionMistake"("userId", "questionId");

-- AddForeignKey
ALTER TABLE "QuestionMistake" ADD CONSTRAINT "QuestionMistake_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionMistake" ADD CONSTRAINT "QuestionMistake_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
