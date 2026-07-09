"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, X } from "lucide-react";
import { mentorChatAction } from "@/app/actions/chat-mentor";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import type {
  ClinicalMentorCaseContext,
  MentorChatMessage,
  MentorQuizContext,
} from "@/lib/mentor-types";
import { cn } from "@/lib/utils";

type ClinicalMentorChatProps = {
  caseContext: ClinicalMentorCaseContext;
  quizContext: MentorQuizContext;
  className?: string;
};

type AssistantMessage = MentorChatMessage & {
  clinicalReasoning?: string[];
};

function ChatContent({
  caseContext,
  quizContext,
  onClose,
  showClose,
}: ClinicalMentorChatProps & { onClose?: () => void; showClose?: boolean }) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isThinking) return;

    const userMessage: MentorChatMessage = { role: "user", content: trimmed };
    const nextHistory = [...messages, userMessage];
    const previousMessages = messages;

    setInput("");
    setError(null);
    setMessages(nextHistory);
    setIsThinking(true);

    try {
      const result = await mentorChatAction(caseContext.id, nextHistory, quizContext);
      if (!result.success || !result.data) {
        setError(result.message);
        setMessages(previousMessages);
        setInput(trimmed);
        return;
      }

      setMessages([
        ...nextHistory,
        {
          role: "assistant",
          content: result.data.reply,
          clinicalReasoning: result.data.clinicalReasoning,
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  }

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-2 border-b py-3">
        <div>
          <div className="font-semibold">مربی بالینی</div>
          <div className="text-xs text-slate-600">{caseContext.title}</div>
        </div>
        {showClose ? (
          <Button type="button" variant="secondary" onClick={onClose} aria-label="بستن">
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {messages.length === 0 ? (
            <div className="rounded-xl bg-muted p-3 text-sm text-slate-600">
              مربی بالینی — درباره استدلال بالینی این کیس بپرسید.
            </div>
          ) : null}

          {messages.map((message, index) => (
            <div
              key={index}
              className={cn(
                "max-w-[90%] rounded-xl px-3 py-2 text-sm",
                message.role === "user"
                  ? "ml-auto bg-teal-700 text-white"
                  : "mr-auto bg-muted text-slate-800",
              )}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
              {message.role === "assistant" && message.clinicalReasoning?.length ? (
                <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-600">
                  {message.clinicalReasoning.map((point, pointIndex) => (
                    <li key={pointIndex}>{point}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}

          {isThinking ? (
            <div className="mr-auto flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              در حال فکر کردن...
            </div>
          ) : null}

          <div ref={messagesEndRef} />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="space-y-2 border-t pt-3">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="سوال خود را بپرسید..."
            disabled={isThinking}
            className="min-h-20 resize-none"
          />
          <Button
            type="button"
            className="w-full"
            disabled={isThinking || !input.trim()}
            onClick={() => void handleSend()}
          >
            {isThinking ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                در حال ارسال...
              </span>
            ) : (
              "ارسال"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ClinicalMentorChat({ caseContext, quizContext, className }: ClinicalMentorChatProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <div className={cn("hidden lg:block", className)}>
        <div className="sticky top-4 h-[calc(100vh-6rem)]">
          <ChatContent caseContext={caseContext} quizContext={quizContext} />
        </div>
      </div>

      <div className="lg:hidden">
        <Button
          type="button"
          className="fixed bottom-6 left-6 z-40 h-14 w-14 rounded-full p-0 shadow-lg"
          onClick={() => setMobileOpen(true)}
          aria-label="باز کردن مربی بالینی"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>

        {mobileOpen ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 bg-black/40"
              onClick={() => setMobileOpen(false)}
              aria-label="بستن پس‌زمینه"
            />
            <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l bg-white shadow-soft">
              <ChatContent
                caseContext={caseContext}
                quizContext={quizContext}
                showClose
                onClose={() => setMobileOpen(false)}
              />
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
