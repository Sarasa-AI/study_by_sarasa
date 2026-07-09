"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

type DeleteCaseButtonProps = {
  caseId: string;
};

export function DeleteCaseButton({ caseId }: DeleteCaseButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!window.confirm("از حذف این کیس مطمئن هستید؟")) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/cases/${caseId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        alert("حذف کیس ناموفق بود");
        return;
      }

      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="danger" disabled={loading} onClick={handleDelete}>
      {loading ? "در حال حذف..." : "حذف"}
    </Button>
  );
}
