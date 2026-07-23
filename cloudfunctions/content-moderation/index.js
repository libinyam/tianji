/**
 * content-moderation 云函数
 *
 * 调用腾讯云数据万象（CI）文本审核 API 对 UGC 文本进行审核。
 * 零依赖，使用 Node.js 内置 crypto + https 模块手动实现 COS v5 签名。
 *
 * 环境变量：
 *   CI_SECRET_ID  - 腾讯云 API SecretId
 *   CI_SECRET_KEY - 腾讯云 API SecretKey
 *   CI_BUCKET     - 数据万象存储桶名（格式 BucketName-APPID）
 *   CI_REGION     - 地域（默认 ap-shanghai）
 *
 * 入参：
 *   { text: string, uid?: string, source?: string }
 *
 * 返回：
 *   {
 *     ok: boolean,
 *     suggestion: "pass" | "review" | "block",
 *     label?: string,
 *     score?: number,
 *     requestId?: string,
 *     error?: string
 *   }
 *
 * 审核服务异常时默认拒绝（fail-closed），防止通过制造服务故障绕过 UGC 审核。
 */

const crypto = require("crypto");
let https = require("https");

/** URL 安全编码（与 cos-nodejs-sdk-v5 camSafeUrlEncode 一致） */
function camSafeUrlEncode(str) {
  return encodeURIComponent(String(str))
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A");
}

/** 将对象转为 key=value&key=value 格式（key 小写 + URL编码，按 key 排序） */
function obj2str(obj, lowerCaseKey) {
  const keys = Object.keys(obj).sort(function (a, b) {
    a = a.toLowerCase(); b = b.toLowerCase();
    return a === b ? 0 : a > b ? 1 : -1;
  });
  const list = [];
  for (const key of keys) {
    const k = lowerCaseKey ? camSafeUrlEncode(key).toLowerCase() : camSafeUrlEncode(key);
    const v = camSafeUrlEncode(obj[key] == null ? "" : obj[key]) || "";
    list.push(k + "=" + v);
  }
  return list.join("&");
}

/** 获取 header key 列表（小写 + URL编码，排序） */
function getHeaderList(headers) {
  return Object.keys(headers)
    .map(function (k) { return camSafeUrlEncode(k).toLowerCase(); })
    .sort()
    .join(";");
}

/**
 * COS v5 签名（与 cos-nodejs-sdk-v5 util.getAuth 实现一致）
 * 文档：https://cloud.tencent.com/document/product/436/7778
 */
function cosSign(secretId, secretKey, method, path, headersToSign) {
  const now = Math.floor(Date.now() / 1000) - 1;
  const exp = now + 900;
  const keyTime = now + ";" + exp;

  // q-header-list
  const qHeaderList = getHeaderList(headersToSign);

  // FormatString = method\npathname\nqueryParams\nheaders\n
  const formatString = [
    method.toLowerCase(),
    path,
    "",                         // HttpParameters 为空
    obj2str(headersToSign, true), // HttpHeaders: key=value&key=value
    "",                         // 末尾空元素 → join 产生尾部 \n
  ].join("\n");

  // StringToSign = sha1\nKeyTime\nSHA1(FormatString)\n
  const sha1FormatString = crypto.createHash("sha1").update(Buffer.from(formatString, "utf8")).digest("hex");
  const stringToSign = ["sha1", keyTime, sha1FormatString, ""].join("\n");

  // SignKey = HMAC-SHA1(SecretKey, KeyTime)
  const signKey = crypto.createHmac("sha1", secretKey).update(keyTime).digest("hex");

  // Signature = HMAC-SHA1(SignKey, StringToSign)
  const signature = crypto.createHmac("sha1", signKey).update(stringToSign).digest("hex");

  // Authorization
  return "q-sign-algorithm=sha1&q-ak=" + secretId +
    "&q-sign-time=" + keyTime +
    "&q-key-time=" + keyTime +
    "&q-header-list=" + qHeaderList +
    "&q-url-param-list=" +
    "&q-signature=" + signature;
}

/**
 * 从 XML 响应中提取文本审核结果
 * 响应格式：<Response><JobsDetail><Result>0/1/2</Result><Section>...</Section></JobsDetail><RequestId>xxx</RequestId></Response>
 */
function parseCiResponse(xml) {
  const result = {};

  // Result: 0=通过, 1=审核中(同步审核一般立即完成), 2=确认违规
  const resultMatch = xml.match(/<Result>(\d+)<\/Result>/);
  if (resultMatch) result.resultNum = parseInt(resultMatch[1], 10);

  // 找第一个 Section 中的 Suggestion/Label/Score
  const sectionMatch = xml.match(/<Section>([\s\S]*?)<\/Section>/);
  if (sectionMatch) {
    const section = sectionMatch[1];
    const sugMatch = section.match(/<Suggestion>(\w+)<\/Suggestion>/);
    const labelMatch = section.match(/<Label>(\w+)<\/Label>/);
    const scoreMatch = section.match(/<Score>(\d+)<\/Score>/);
    if (sugMatch) result.suggestion = sugMatch[1].toLowerCase();
    if (labelMatch) result.label = labelMatch[1];
    if (scoreMatch) result.score = parseInt(scoreMatch[1], 10);
  }

  // RequestId
  const reqIdMatch = xml.match(/<RequestId>([^<]+)<\/RequestId>/);
  if (reqIdMatch) result.requestId = reqIdMatch[1];

  // 如果没有 Section 但 Result=0，说明通过
  if (!result.suggestion) {
    result.suggestion = result.resultNum === 0 ? "pass" : (result.resultNum === 2 ? "block" : "review");
  }

  return result;
}

/**
 * 调用数据万象 CI 文本审核 API
 * 文档：https://cloud.tencent.com/document/product/460/76283
 */
async function moderateText(text) {
  const secretId = process.env.CI_SECRET_ID;
  const secretKey = process.env.CI_SECRET_KEY;
  const bucket = process.env.CI_BUCKET;
  const region = process.env.CI_REGION || "ap-shanghai";

  if (!secretId || !secretKey || !bucket) {
    throw new Error("CI_SECRET_ID / CI_SECRET_KEY / CI_BUCKET 环境变量未配置");
  }

  // CI 文本审核要求文本 Base64 编码，截断到 50000 字符避免超限
  const truncated = String(text).slice(0, 50000);
  const contentBase64 = Buffer.from(truncated, "utf-8").toString("base64");

  const host = bucket + ".ci." + region + ".myqcloud.com";
  const path = "/text/auditing";

  // 请求体 XML
  const bodyXml =
    "<Request>" +
    "<Input><Content>" + contentBase64 + "</Content></Input>" +
    "<Conf><DetectType>porn,ads,illegal,abuse,politics</DetectType></Conf>" +
    "</Request>";

  const body = Buffer.from(bodyXml, "utf-8");

  // 需要签名的 headers
  const headersToSign = {
    "content-type": "application/xml",
    "host": host,
  };

  const authorization = cosSign(secretId, secretKey, "POST", path, headersToSign);

  const options = {
    hostname: host,
    port: 443,
    path: path,
    method: "POST",
    headers: {
      "Authorization": authorization,
      "Content-Type": "application/xml",
      "Host": host,
      "Content-Length": body.length,
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf-8");

        // HTTP 错误
        if (res.statusCode !== 200) {
          reject(new Error("CI 审核请求失败 HTTP " + res.statusCode + ": " + raw.slice(0, 300)));
          return;
        }

        try {
          const parsed = parseCiResponse(raw);
          resolve(parsed);
        } catch (err) {
          reject(new Error("CI 响应解析失败: " + raw.slice(0, 300)));
        }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

exports.main = async (event) => {
  const { text, uid, source } = event;

  if (!text || !String(text).trim()) {
    return { ok: true, suggestion: "pass", reason: "空文本直接放行" };
  }

  try {
    const result = await moderateText(text);

    // suggestion: pass | review | block
    // block 拦截；review 暂时放行（转人工复核）；pass 放行
    const ok = result.suggestion !== "block";

    return {
      ok,
      suggestion: result.suggestion,
      label: result.label || "",
      score: result.score || 0,
      requestId: result.requestId || "",
      uid: uid || "",
      source: source || "",
      timestamp: Date.now(),
    };
  } catch (err) {
    // #315 fail-closed：审核服务异常时拒绝，防止通过制造服务故障绕过 UGC 审核
    console.error("[content-moderation] 审核异常:", err.message);
    return {
      ok: false,
      suggestion: "block",
      label: "ServiceError",
      error: err.message,
      failOpen: false,
      uid: uid || "",
      source: source || "",
      timestamp: Date.now(),
    };
  }
};

// 仅供测试使用：注入 mock https 模块以避免真实网络请求
exports.__setTestHttps = (mockHttps) => {
  https = mockHttps;
};

// 仅供测试使用：重置环境变量
exports.__resetEnv = () => {
  delete process.env.CI_SECRET_ID;
  delete process.env.CI_SECRET_KEY;
  delete process.env.CI_BUCKET;
  delete process.env.CI_REGION;
};
