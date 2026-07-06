#!/usr/bin/env python3
"""
修复 CloudBase 静态托管 HTML 文件的 Content-Type，补齐 charset=utf-8。

CloudBase/COS 托管默认为 .html 文件返回 `Content-Type: text/html`（无 charset），
导致抓取器、分享预览、比赛平台等按 HTTP 头解析的客户端看到中文乱码。
本脚本通过 COS CopyObject API 将 index.html 复制到自身并替换 Content-Type。

用法（CI/CD 部署后执行）：
  TCB_SECRET_ID=xxx TCB_SECRET_KEY=yyy python scripts/fix-charset.py

对应 issue #135。
"""
import os
import sys

# 自动安装依赖（CI 环境可能未预装）
try:
    from qcloud_cos import CosConfig, CosS3Client
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "qcloud-cos-sdk"])
    from qcloud_cos import CosConfig, CosS3Client

# CloudBase 托管对应的 COS 桶（从 queryHosting 获取）
BUCKET = "4147-static-tianji-d3gozv3qr802e49cb-1445413468"
REGION = "ap-shanghai"

# 需要修正 Content-Type 的 HTML 文件
HTML_FILES = ["index.html"]


def main():
    secret_id = os.environ.get("TCB_SECRET_ID")
    secret_key = os.environ.get("TCB_SECRET_KEY")
    if not secret_id or not secret_key:
        print("错误：请设置 TCB_SECRET_ID 和 TCB_SECRET_KEY 环境变量", file=sys.stderr)
        sys.exit(1)

    config = CosConfig(
        Region=REGION,
        SecretId=secret_id,
        SecretKey=secret_key,
        Scheme="https",
    )
    client = CosS3Client(config)

    for key in HTML_FILES:
        try:
            # CopyObject 到自身，用 MetadataDirective=Replaced 替换元数据
            client.copy_object(
                Bucket=BUCKET,
                Key=key,
                CopySource=f"{BUCKET}.cos.{REGION}.myqcloud.com/{key}",
                ContentType="text/html; charset=utf-8",
                MetadataDirective="Replaced",
            )
            print(f"✓ 已更新 Content-Type → text/html; charset=utf-8  ({key})")
        except Exception as e:
            print(f"✗ 更新失败 ({key}): {e}", file=sys.stderr)
            sys.exit(1)

    print("全部 HTML 文件 Content-Type 已修正为 text/html; charset=utf-8")


if __name__ == "__main__":
    main()
