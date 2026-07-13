import { app } from "@/lib/cloudbase";

export async function triggerAiBotReply(params: {
  postId: string;
  postTitle?: string;
  postBody?: string;
  tags?: string[];
  replyType: "post" | "comment";
  answerId?: string;
  answerContent?: string;
  userComment?: string;
}): Promise<{ ok: boolean; reply?: string; comment?: unknown; answer?: unknown }> {
  const res = await app.callFunction({
    name: "ai-bot",
    data: params,
  });
  return (res?.result ?? {}) as { ok: boolean; reply?: string; comment?: unknown; answer?: unknown };
}
