import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { main, __setTestHttps, __resetEnv } from "./index.js";

// #321 content-moderation 云函数测试
// 通过 __setTestHttps 注入 mock https 模块，避免真实网络请求
// 覆盖关键路径：正常审核、block 拦截、review 放行、HTTP 错误、网络异常、环境变量缺失

function makeMockHttps(statusCode, responseBody) {
  return {
    request(options, callback) {
      const res = {
        statusCode,
        on(event, handler) {
          if (event === "data") {
            // 模拟分块返回
            setTimeout(() => handler(Buffer.from(responseBody, "utf-8")), 0);
          } else if (event === "end") {
            setTimeout(() => handler(), 0);
          }
        },
      };
      const req = {
        on() {},
        write() {},
        end() {
          setTimeout(() => callback(res), 0);
        },
      };
      return req;
    },
  };
}

function makeErrorHttps(err) {
  return {
    request(options, callback) {
      const req = {
        on(event, handler) {
          if (event === "error") {
            setTimeout(() => handler(err), 0);
          }
        },
        write() {},
        end() {},
      };
      return req;
    },
  };
}

beforeEach(() => {
  process.env.CI_SECRET_ID = "test-secret-id";
  process.env.CI_SECRET_KEY = "test-secret-key";
  process.env.CI_BUCKET = "test-bucket-1234567890";
  process.env.CI_REGION = "ap-shanghai";
});

afterEach(() => {
  __setTestHttps(require("https"));
  __resetEnv();
});

describe("content-moderation 云函数（#321）", () => {
  it("空文本直接放行", async () => {
    const res = await main({ text: "" });
    expect(res.ok).toBe(true);
    expect(res.suggestion).toBe("pass");
    expect(res.reason).toContain("空文本");
  });

  it("空白字符串也视为空文本放行", async () => {
    const res = await main({ text: "   " });
    expect(res.ok).toBe(true);
    expect(res.suggestion).toBe("pass");
  });

  it("审核通过：CI 返回 suggestion=pass 时放行", async () => {
    const xml = `<Response><JobsDetail><Result>0</Result><Section><Suggestion>pass</Suggestion><Label>Normal</Label><Score>0</Score></Section></JobsDetail><RequestId>req-123</RequestId></Response>`;
    __setTestHttps(makeMockHttps(200, xml));

    const res = await main({ text: "正常内容", uid: "u1", source: "createPost" });

    expect(res.ok).toBe(true);
    expect(res.suggestion).toBe("pass");
    expect(res.label).toBe("Normal");
    expect(res.requestId).toBe("req-123");
    expect(res.uid).toBe("u1");
    expect(res.source).toBe("createPost");
  });

  it("审核拦截：CI 返回 suggestion=block 时拒绝", async () => {
    const xml = `<Response><JobsDetail><Result>2</Result><Section><Suggestion>block</Suggestion><Label>Porn</Label><Score>99</Score></Section></JobsDetail><RequestId>req-456</RequestId></Response>`;
    __setTestHttps(makeMockHttps(200, xml));

    const res = await main({ text: "违规内容", uid: "u2" });

    expect(res.ok).toBe(false);
    expect(res.suggestion).toBe("block");
    expect(res.label).toBe("Porn");
    expect(res.score).toBe(99);
  });

  it("审核 review：CI 返回 review 时放行转人工", async () => {
    const xml = `<Response><JobsDetail><Result>1</Result><Section><Suggestion>review</Suggestion><Label>Ads</Label><Score>50</Score></Section></JobsDetail><RequestId>req-789</RequestId></Response>`;
    __setTestHttps(makeMockHttps(200, xml));

    const res = await main({ text: "待复核内容" });

    expect(res.ok).toBe(true);
    expect(res.suggestion).toBe("review");
    expect(res.label).toBe("Ads");
  });

  it("#315 fail-closed：HTTP 错误时拒绝并返回 ServiceError", async () => {
    __setTestHttps(makeMockHttps(500, "Internal Server Error"));

    const res = await main({ text: "测试内容", uid: "u3" });

    expect(res.ok).toBe(false);
    expect(res.suggestion).toBe("block");
    expect(res.label).toBe("ServiceError");
    expect(res.failOpen).toBe(false);
    expect(res.error).toContain("HTTP 500");
    expect(res.uid).toBe("u3");
  });

  it("#315 fail-closed：网络异常时拒绝并返回 ServiceError", async () => {
    __setTestHttps(makeErrorHttps(new Error("connect ECONNREFUSED")));

    const res = await main({ text: "测试内容" });

    expect(res.ok).toBe(false);
    expect(res.suggestion).toBe("block");
    expect(res.label).toBe("ServiceError");
    expect(res.failOpen).toBe(false);
    expect(res.error).toContain("ECONNREFUSED");
  });

  it("#315 fail-closed：环境变量缺失时拒绝并返回 ServiceError", async () => {
    __resetEnv();

    const res = await main({ text: "测试内容" });

    expect(res.ok).toBe(false);
    expect(res.suggestion).toBe("block");
    expect(res.label).toBe("ServiceError");
    expect(res.error).toContain("环境变量未配置");
  });

  it("响应 XML 无 Section 但 Result=0 时判为 pass", async () => {
    const xml = `<Response><JobsDetail><Result>0</Result></JobsDetail><RequestId>req-000</RequestId></Response>`;
    __setTestHttps(makeMockHttps(200, xml));

    const res = await main({ text: "无 Section 内容" });

    expect(res.ok).toBe(true);
    expect(res.suggestion).toBe("pass");
  });

  it("响应 XML 无 Section 但 Result=2 时判为 block", async () => {
    const xml = `<Response><JobsDetail><Result>2</Result></JobsDetail></Response>`;
    __setTestHttps(makeMockHttps(200, xml));

    const res = await main({ text: "无 Section 违规" });

    expect(res.ok).toBe(false);
    expect(res.suggestion).toBe("block");
  });

  it("长文本（>50000 字符）被截断后正常送审", async () => {
    const longText = "a".repeat(60000);
    let capturedBody = "";
    const mockHttps = {
      request(options, callback) {
        const res = {
          statusCode: 200,
          on(event, handler) {
            if (event === "data") {
              setTimeout(() => handler(Buffer.from(`<Response><JobsDetail><Result>0</Result><Section><Suggestion>pass</Suggestion></Section></JobsDetail></Response>`, "utf-8")), 0);
            } else if (event === "end") {
              setTimeout(() => handler(), 0);
            }
          },
        };
        const req = {
          on() {},
          write(body) {
            capturedBody = body.toString("utf-8");
          },
          end() {
            setTimeout(() => callback(res), 0);
          },
        };
        return req;
      },
    };
    __setTestHttps(mockHttps);

    const res = await main({ text: longText });

    expect(res.ok).toBe(true);
    // 验证 Base64 内容解码后确实是截断到 50000 字符
    const base64Match = capturedBody.match(/<Content>([^<]+)<\/Content>/);
    expect(base64Match).not.toBeNull();
    const decoded = Buffer.from(base64Match[1], "base64").toString("utf-8");
    expect(decoded.length).toBe(50000);
  });

  it("返回结果包含 timestamp 字段", async () => {
    const xml = `<Response><JobsDetail><Result>0</Result><Section><Suggestion>pass</Suggestion></Section></JobsDetail></Response>`;
    __setTestHttps(makeMockHttps(200, xml));

    const before = Date.now();
    const res = await main({ text: "测试" });
    const after = Date.now();

    expect(res.timestamp).toBeGreaterThanOrEqual(before);
    expect(res.timestamp).toBeLessThanOrEqual(after);
  });

  it("uid 和 source 缺省时为空字符串", async () => {
    const xml = `<Response><JobsDetail><Result>0</Result><Section><Suggestion>pass</Suggestion></Section></JobsDetail></Response>`;
    __setTestHttps(makeMockHttps(200, xml));

    const res = await main({ text: "测试" });

    expect(res.uid).toBe("");
    expect(res.source).toBe("");
  });
});
