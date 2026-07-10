import { app } from "@/lib/cloudbase";
import { assertAdmin } from "@/lib/admin";

const db = app.database();

export async function togglePin(postId: string): Promise<void> {
  await assertAdmin();
  const { data } = await db.collection("posts").doc(postId).get();
  const current = (data?.[0] as { pinned?: boolean })?.pinned ?? false;
  await db.collection("posts").doc(postId).update({ pinned: !current });
}

export async function toggleLock(postId: string): Promise<void> {
  await assertAdmin();
  const { data } = await db.collection("posts").doc(postId).get();
  const current = (data?.[0] as { locked?: boolean })?.locked ?? false;
  await db.collection("posts").doc(postId).update({ locked: !current });
}

export async function toggleFeature(postId: string): Promise<void> {
  await assertAdmin();
  const { data } = await db.collection("posts").doc(postId).get();
  const current = (data?.[0] as { featured?: boolean })?.featured ?? false;
  await db.collection("posts").doc(postId).update({ featured: !current });
}
