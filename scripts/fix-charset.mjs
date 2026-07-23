/**
 * 修复 CloudBase 静态托管文件的 Content-Type 和 Content-Disposition。
 *
 * 问题 1（#135）: .html 文件 Content-Type 缺少 charset=utf-8
 * 问题 2（#41）: 所有文件被设置了 Content-Disposition: attachment，
 *   导致浏览器将页面/JS 当作下载文件而非内联渲染，引发白屏。
 *
 * 本脚本通过 COS putObjectCopy 将文件复制到自身，同时：
 *   - 设置正确的 Content-Type（含 charset）
 *   - 清除 Content-Disposition（设为空，等效于 inline）
 *
 * 用法（CI/CD 部署后执行）：
 *   TCB_SECRET_ID=xxx TCB_SECRET_KEY=yyy node scripts/fix-charset.mjs
 *
 * 对应 issue #135 #41。
 */
import COS from "cos-nodejs-sdk-v5";

const BUCKET = "4147-static-tianji-d3gozv3qr802e49cb-1445413468";
const REGION = "ap-shanghai";

const FILES_TO_FIX = [
  { key: "index.html", contentType: "text/html; charset=utf-8" },
];

async function main() {
  const SecretId = process.env.TCB_SECRET_ID;
  const SecretKey = process.env.TCB_SECRET_KEY;
  if (!SecretId || !SecretKey) {
    console.error("错误：请设置 TCB_SECRET_ID 和 TCB_SECRET_KEY 环境变量");
    process.exit(1);
  }

  const cos = new COS({ SecretId, SecretKey });

  for (const { key, contentType } of FILES_TO_FIX) {
    try {
      await new Promise((resolve, reject) => {
        cos.putObjectCopy(
          {
            Bucket: BUCKET,
            Region: REGION,
            Key: key,
            CopySource: `${BUCKET}.cos.${REGION}.myqcloud.com/${key}`,
            MetadataDirective: "Replaced",
            ContentType: contentType,
            ContentDisposition: "",
          },
          (err, data) => {
            if (err) reject(err);
            else resolve(data);
          }
        );
      });
      console.log(`✓ ${key}: Content-Type=${contentType}, Content-Disposition cleared`);
    } catch (err) {
      console.error(`✗ 修复失败 (${key}):`, err.message || err);
      process.exit(1);
    }
  }

  console.log("全部文件元数据已修正（charset + 清除 attachment 头）");
}

main();
