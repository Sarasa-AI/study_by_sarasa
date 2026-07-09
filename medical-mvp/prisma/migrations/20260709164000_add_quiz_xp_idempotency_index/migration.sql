-- CreateIndex
CREATE UNIQUE INDEX "QuizResult_userId_caseId_xpAwarded_unique"
ON "QuizResult" ("userId", "caseId")
WHERE "xpAwarded" = true;
