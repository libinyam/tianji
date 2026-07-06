/**
 * 修复 CloudBase 静态托管 HTML 文件的 Content-Type，补齐 charset=utf-8。
 *
 * CloudBase/COS 托管默认为 .html 文件返回 `Content-Type: text/html`（无 charset），
 * 导致抓取器、分享预览、比赛平台等按 HTTP 头解析的客户端看到中文乱码。
 * 本脚本通过 COS copyObject API 将 index.html 复制到自身并替换 Content-Type。
 *
 * 用法（CI/CD 部署后执行）：
 *   TCB_SECRET_ID=xxx TCB_SECRET_KEY=yyy node scripts/fix-charset.mjs
 *
 * 对应 issue #135。
 */
import COS from "cos-nodejs-sdk-v5";

// CloudBase 托管对应的 COS 桶（从 queryHosting 获取）
const BUCKET = "4147-static-tianji-d3gozv3qr802e49cb-1445413468";
const REGION = "ap-shanghai";

// 需要修正 Content-Type 的 HTML 文件
const HTML_FILES = ["index.html"];

async function main() {
  const SecretId = process.env.TCB_SECRET_ID;
  const SecretKey = process.env.TCB_SECRET_KEY;
  if (!SecretId || !SecretKey) {
    console.error("错误：请设置 TCB_SECRET_ID 和 TCB_SECRET_KEY 环境变量");
    process.exit(1);
  }

  const cos = new COS({ SecretId, SecretKey });

  for (const key of HTML_FILES) {
    try {
      // copyObject 到自身，用 MetadataDirective=Replaced 替换元数据
      await new Promise((resolve, reject) => {
        cos.copyObject(
          {
            Bucket: BUCKET,
            Region: REGION,
            Key: key,
            CopySource: `${BUCKET}.cos.${REGION}.myqcloud.com/${key}`,
            MetadataDirective: "Replaced",
            ContentType: "text/html; charset=utf-8",
          },
          (err, data) => {
            if (err) reject(err);
            else resolve(data);
          }
        );
      });
      console.log(`✓ 已更新 Content-Type → text/html; charset=utf-8  (${key})`);
    } catch (err) {
      console.error(`✗ 更新失败 (${key}):`, err.message || err);
      process.exit(1);
    }
  }

  console.log("全部 HTML 文件 Content-Type 已修正为 text/html; charset=utf-8");
}

main();
