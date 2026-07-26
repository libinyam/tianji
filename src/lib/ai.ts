import { app } from "@/lib/cloudbase";

/**
 * 触发 AI bot 回复（#38 加固后入参精简）
 * 云函数从数据库取 post title/body/tags 和 answer content，客户端不再传这些
 */
export async function triggerAiBotReply(params: {
  postId: string;
  replyType: "post" | "comment";
  answerId?: string;
  userComment?: string;
}): Promise<{ ok: boolean; reply?: string; comment?: unknown; answer?: unknown }> {
  // ai-bot 返回扁平 { ok, reply, ... } 而非 {ok,data} 信封,且调用方自行消费 ok,
  // 不适用 callCloudFunction(#418)
  const res = await app.callFunction({
    name: "ai-bot",
    data: params,
  });
  return (res?.result ?? {}) as {
    ok: boolean;
    reply?: string;
    comment?: unknown;
    answer?: unknown;
  };
}
