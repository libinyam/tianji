import { describe, it, expect } from "vitest";
import { createPost, createAnswer, createComment, createBook, createUser, createQuestion } from "./testFactories";
import { createMockDb, createMockApp, seedCollection } from "./mockCloudbase";

describe("testFactories", () => {
  it("createPost 返回合理的默认帖子", () => {
    const post = createPost();
    expect(post._id).toBe("post-1");
    expect(post.title).toBe("测试帖子");
    expect(post.authorUid).toBe("test-uid");
    expect(post.answerList).toEqual([]);
  });

  it("createPost 支持覆盖字段", () => {
    const post = createPost({ title: "自定义标题", views: 100 });
    expect(post.title).toBe("自定义标题");
    expect(post.views).toBe(100);
    expect(post.authorUid).toBe("test-uid");
  });

  it("createAnswer 返回合理的默认回答", () => {
    const answer = createAnswer();
    expect(answer.id).toBe("answer-1");
    expect(answer.votes).toBe(0);
    expect(answer.accepted).toBe(false);
  });

  it("createComment 返回合理的默认评论", () => {
    const comment = createComment();
    expect(comment.id).toBe("comment-1");
    expect(comment.content).toBe("测试评论内容");
  });

  it("createBook 返回合理的默认书籍", () => {
    const book = createBook();
    expect(book.id).toBe("book-1");
    expect(book.difficulty).toBe(3);
    expect(book.rating).toBe(4.5);
  });

  it("createUser 返回合理的默认用户", () => {
    const user = createUser();
    expect(user.uid).toBe("test-uid");
    expect(user.nickname).toBe("Tester");
  });

  it("createQuestion 返回合理的默认 Question", () => {
    const q = createQuestion();
    expect(q.id).toBe("post-1");
    expect(q.answers).toBe(0);
    expect(q.category).toBe("academic");
  });
});

describe("mockCloudbase", () => {
  it("createMockDb 支持集合操作", async () => {
    const db = createMockDb();
    await db.collection("posts").doc("p1").set({ title: "测试", authorUid: "u1" });

    const { data } = await db.collection("posts").doc("p1").get();
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe("测试");
  });

  it("createMockDb 支持 add 和自动 ID", async () => {
    const db = createMockDb();
    const { id } = await db.collection("posts").add({ title: "新帖子" });

    expect(id).toBeTruthy();
    const { data } = await db.collection("posts").doc(id).get();
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe("新帖子");
  });

  it("createMockDb 支持 update 和 command.inc", async () => {
    const db = createMockDb();
    await db.collection("posts").doc("p1").set({ views: 10 });
    await db.collection("posts").doc("p1").update({ views: db.command.inc(5) });

    const { data } = await db.collection("posts").doc("p1").get();
    expect(data[0].views).toBe(15);
  });

  it("createMockDb 支持 where 过滤", async () => {
    const db = createMockDb();
    await db.collection("posts").doc("p1").set({ category: "academic", title: "学术帖" });
    await db.collection("posts").doc("p2").set({ category: "casual", title: "闲聊帖" });

    const result = await db.collection("posts").where({ category: "academic" }).get();
    expect(result.data).toHaveLength(1);
    expect(result.data[0].title).toBe("学术帖");
  });

  it("createMockDb 支持 remove", async () => {
    const db = createMockDb();
    await db.collection("posts").doc("p1").set({ title: "测试" });
    await db.collection("posts").doc("p1").remove();

    const { data } = await db.collection("posts").doc("p1").get();
    expect(data).toHaveLength(0);
  });

  it("seedCollection 批量初始化数据", async () => {
    const db = createMockDb();
    seedCollection(db, "posts", [
      { _id: "p1", title: "帖子1" },
      { _id: "p2", title: "帖子2" },
    ]);

    const { data } = await db.collection("posts").doc("p1").get();
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe("帖子1");
  });

  it("createMockApp 返回可用的 app 对象", async () => {
    const db = createMockDb();
    const app = createMockApp(db);

    expect(typeof app.database).toBe("function");
    expect(typeof app.callFunction).toBe("function");
    expect(typeof app.auth).toBe("function");

    const result = await app.callFunction({ name: "test", data: {} });
    expect(result.result.ok).toBe(true);
  });
});
