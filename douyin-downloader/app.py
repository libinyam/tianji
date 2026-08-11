"""抖音 / TikTok 无水印下载器 - 本地网页工具

启动: python app.py  然后浏览器打开 http://127.0.0.1:5200
"""
from __future__ import annotations

import io
import zipfile
from urllib.parse import quote

import requests
from flask import Flask, Response, jsonify, render_template, request, stream_with_context

from parser import COMMON_HEADER, ParseError, parse_url

app = Flask(__name__)

UA = COMMON_HEADER["User-Agent"]


@app.route("/")
def index():
    return render_template("index.html")


@app.post("/api/parse")
def api_parse():
    payload = request.get_json(silent=True) or {}
    url = (payload.get("url") or "").strip()
    if not url:
        return jsonify({"ok": False, "msg": "请输入抖音 / TikTok 链接"}), 400
    try:
        result = parse_url(url)
    except ParseError as e:
        return jsonify({"ok": False, "msg": str(e)}), 200
    except Exception as e:  # noqa: BLE001
        return jsonify({"ok": False, "msg": f"解析异常: {e}"}), 200
    return jsonify({"ok": True, "data": result})


def _media_headers(referer: str | None) -> dict:
    h = {"User-Agent": UA}
    if referer:
        h["Referer"] = referer
    return h


@app.get("/api/media")
def api_media():
    url = request.args.get("url")
    if not url:
        return jsonify({"ok": False, "msg": "缺少 url"}), 400
    referer = request.args.get("referer")
    filename = request.args.get("filename") or "media"
    as_download = request.args.get("download") == "1"

    headers = _media_headers(referer)
    rng = request.headers.get("Range")
    if rng:
        headers["Range"] = rng

    try:
        upstream = requests.get(url, headers=headers, stream=True, timeout=60, allow_redirects=True)
    except requests.RequestException as e:
        return jsonify({"ok": False, "msg": f"请求失败: {e}"}), 502

    def generate():
        try:
            for chunk in upstream.iter_content(chunk_size=8192):
                if chunk:
                    yield chunk
        finally:
            upstream.close()

    resp = Response(
        stream_with_context(generate()),
        status=upstream.status_code,
        content_type=upstream.headers.get("Content-Type", "application/octet-stream"),
    )
    for h in ("Content-Length", "Content-Range", "Accept-Ranges", "Last-Modified"):
        v = upstream.headers.get(h)
        if v:
            resp.headers[h] = v
    disposition = "attachment" if as_download else "inline"
    try:
        ascii_name = filename.encode("ascii", "ignore").decode("ascii") or "media"
    except Exception:
        ascii_name = "media"
    resp.headers["Content-Disposition"] = (
        f"{disposition}; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(filename)}"
    )
    return resp


@app.post("/api/zip")
def api_zip():
    payload = request.get_json(silent=True) or {}
    items = payload.get("items") or []
    if not items:
        return jsonify({"ok": False, "msg": "没有可打包的文件"}), 400
    zip_name = (payload.get("name") or "media").strip() or "media"

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        used: set[str] = set()
        for item in items:
            url = item.get("url")
            if not url:
                continue
            referer = item.get("referer")
            fname = item.get("filename") or "media"
            try:
                r = requests.get(
                    url, headers=_media_headers(referer), timeout=60, allow_redirects=True
                )
                r.raise_for_status()
            except requests.RequestException:
                continue
            final_name = fname
            i = 1
            while final_name in used:
                stem, dot, ext = fname.rpartition(".")
                final_name = f"{stem}_{i}{dot and '.' + ext}"
                i += 1
            used.add(final_name)
            zf.writestr(final_name, r.content)
    buf.seek(0)
    return Response(
        buf.getvalue(),
        content_type="application/zip",
        headers={
            "Content-Disposition": (
                f"attachment; filename=\"{zip_name}.zip\"; "
                f"filename*=UTF-8''{quote(zip_name)}.zip"
            )
        },
    )


if __name__ == "__main__":
    import socket

    def get_lan_ip() -> str:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
        except OSError:
            return "127.0.0.1"
        finally:
            s.close()

    host = "0.0.0.0"
    port = 5200
    lan_ip = get_lan_ip()
    print("=" * 50)
    print(" 抖音 / TikTok 无水印下载器已启动")
    print("-" * 50)
    print(f" 本机访问:    http://127.0.0.1:{port}")
    print(f" 手机访问:    http://{lan_ip}:{port}")
    print("-" * 50)
    print(" 确保手机和电脑连接同一个 WiFi/局域网")
    print(" 若手机打不开, 请检查 Windows 防火墙是否放行该端口")
    print("=" * 50)
    app.run(host=host, port=port, debug=False)
