import { app } from "@/lib/cloudbase";
import { getCurrentUid, getCurrentUserName } from "@/lib/current-user";
import { assertAdmin } from "@/lib/admin";
import { sanitizeInput } from "@/lib/sanitize";

const db = app.database();

const COLLECTION = "reports";

export interface Report {
  id: string;
  reporterUid: string;
  reporterName: string;
  targetType: "post" | "idea" | "book" | "workshop" | "answer" | "comment";
  targetId: string;
  targetTitle: string;
  reason: string;
  status: "pending" | "resolved" | "dismissed";
  createdAt: string;
}

/** 提交举报 */
export async function createReport(params: {
  targetType: Report["targetType"];
  targetId: string;
  targetTitle: string;
  reason: string;
}): Promise<boolean> {
  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");

  // 检查是否已举报过同一内容
  const { data: existing } = await db
    .collection(COLLECTION)
    .where({ reporterUid: uid, targetId: params.targetId })
    .get();

  if (existing && existing.length > 0) {
    throw new Error("你已举报过此内容");
  }

  await db.collection(COLLECTION).add({
    reporterUid: uid,
    reporterName: getCurrentUserName(),
    targetType: params.targetType,
    targetId: params.targetId,
    targetTitle: sanitizeInput(params.targetTitle, 200),
    reason: sanitizeInput(params.reason, 500),
    status: "pending",
    createdAt: new Date().toISOString(),
  });

  return true;
}

/** 获取举报列表（管理员） */
export async function fetchReports(status?: string): Promise<Report[]> {
  await assertAdmin();
  const base = db.collection(COLLECTION);
  const { data } = status
    ? await base.where({ status }).orderBy("createdAt", "desc").limit(50).get()
    : await base.orderBy("createdAt", "desc").limit(50).get();
  return ((data as unknown as Report[]) ?? []).map((r) => ({
    ...r,
    id: (r as unknown as { _id: string })._id,
  }));
}

/** 处理举报（管理员） */
export async function resolveReport(
  reportId: string,
  action: "resolved" | "dismissed"
): Promise<boolean> {
  await assertAdmin();
  await db.collection(COLLECTION).doc(reportId).update({ status: action });
  return true;
}
