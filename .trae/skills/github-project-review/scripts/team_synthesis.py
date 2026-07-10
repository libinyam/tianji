#!/usr/bin/env python3
"""Aggregate team findings for the final review report.

Commands:
  aggregate   Compute aggregated scores into _synthesis/scores.json
  scores      Output the score table for the report
  blockers    Output all P0 findings across roles
  report-data Output comprehensive JSON for report generation
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


WORKSPACE_NAME = ".github-review-workspace"

ROLE_DIR_MAP = {
    "A": "role-a-planning",
    "B": "role-b-frontend",
    "C": "role-c-backend",
    "D": "role-d-testing",
    "E": "role-e-code-review",
    "F": "role-f-product",
    "G": "role-g-security",
}

ROLE_LABELS = {
    "A": "Planning Analyst",
    "B": "Frontend Engineer",
    "C": "Backend Engineer",
    "D": "Test Engineer",
    "E": "Code Reviewer",
    "F": "Product & Market",
    "G": "Security & DevOps",
}


def resolve_workspace(base_dir: str | Path) -> Path:
    ws = Path(base_dir) / WORKSPACE_NAME
    if not ws.exists():
        print(f"Error: no workspace at {ws}.", file=sys.stderr)
        sys.exit(1)
    return ws


def read_json(path: Path) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, data: Any) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def load_all_findings(ws: Path) -> dict[str, dict[str, Any] | None]:
    """Load findings from all roles."""
    results = {}
    for code, dirname in ROLE_DIR_MAP.items():
        fp = ws / dirname / "findings.json"
        if fp.exists():
            results[code] = read_json(fp)
        else:
            results[code] = None
    return results


def compute_role_avg(scores: dict[str, Any]) -> float | None:
    """Compute average score for a role from its dimension scores."""
    if not scores:
        return None
    values = []
    for s in scores.values():
        if isinstance(s, dict):
            v = s.get("value")
            if isinstance(v, (int, float)):
                values.append(v)
        elif isinstance(s, (int, float)):
            values.append(s)
    if not values:
        return None
    return sum(values) / len(values)


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def cmd_aggregate(ws: Path) -> dict[str, Any]:
    """Aggregate all scores and write to _synthesis/scores.json."""
    session = read_json(ws / "_session.json")
    all_findings = load_all_findings(ws)

    scores: dict[str, Any] = {}
    for code, findings in all_findings.items():
        role_info = session.get("roles", {}).get(code, {})
        applicable = role_info.get("applicable", True)

        if not applicable or findings is None:
            scores[code] = {
                "label": ROLE_LABELS.get(code, code),
                "applicable": applicable,
                "avg_score": None,
                "scores": {},
                "status": role_info.get("status", "pending"),
            }
            continue

        role_scores = findings.get("scores", {})
        avg = compute_role_avg(role_scores)

        scores[code] = {
            "label": ROLE_LABELS.get(code, code),
            "applicable": True,
            "avg_score": round(avg, 1) if avg is not None else None,
            "scores": role_scores,
            "status": findings.get("timestamp", "unknown"),
            "findings_count": len(findings.get("findings", [])),
            "p0_count": sum(1 for f in findings.get("findings", []) if f.get("severity", "").upper() == "P0"),
            "p1_count": sum(1 for f in findings.get("findings", []) if f.get("severity", "").upper() == "P1"),
        }

    # Compute overall average (applicable roles only)
    applicable_avgs = [
        s["avg_score"] for s in scores.values()
        if s.get("applicable") and s.get("avg_score") is not None
    ]
    overall_avg = round(sum(applicable_avgs) / len(applicable_avgs), 1) if applicable_avgs else None

    result = {
        "roles": scores,
        "overall_avg": overall_avg,
        "applicable_count": len(applicable_avgs),
    }

    write_json(ws / "_synthesis" / "scores.json", result)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return result


def cmd_scores(ws: Path) -> str:
    """Output score table in report-ready format."""
    scores_path = ws / "_synthesis" / "scores.json"
    if not scores_path.exists():
        # Auto-aggregate
        cmd_aggregate(ws)

    data = read_json(scores_path)
    lines = ["| 维度 | 角色 | 评分 | 证据摘要 |", "|---|---|---:|---|"]

    for code in sorted(data.get("roles", {})):
        role = data["roles"][code]
        label = role.get("label", code)
        avg = role.get("avg_score")
        applicable = role.get("applicable", True)

        if not applicable:
            lines.append(f"| {label} | {ROLE_LABELS.get(code, code)} | N/A | 不适用 |")
        elif avg is not None:
            # Build evidence summary from individual scores
            evidence_parts = []
            for dim, s in role.get("scores", {}).items():
                if isinstance(s, dict) and s.get("evidence"):
                    evidence_parts.append(s["evidence"][:60])
            evidence = "; ".join(evidence_parts[:2]) if evidence_parts else "—"
            lines.append(f"| {label} | {ROLE_LABELS.get(code, code)} | {avg}/10 | {evidence} |")
        else:
            lines.append(f"| {label} | {ROLE_LABELS.get(code, code)} | — | 未完成 |")

    overall = data.get("overall_avg")
    lines.append("")
    if overall is not None:
        lines.append(f"> 综合均分: {overall}/10（{data.get('applicable_count', 0)} 个适用角色）")

    output = "\n".join(lines)
    print(output)
    return output


def cmd_blockers(ws: Path) -> list[dict[str, Any]]:
    """Output all P0 findings across roles."""
    all_findings = load_all_findings(ws)
    blockers: list[dict[str, Any]] = []

    for code, findings in all_findings.items():
        if findings is None:
            continue
        for f in findings.get("findings", []):
            if f.get("severity", "").upper() == "P0":
                blockers.append({
                    "role": code,
                    "label": ROLE_LABELS.get(code, code),
                    "finding_id": f.get("id", ""),
                    "title": f.get("title", ""),
                    "evidence": f.get("evidence", ""),
                    "files": f.get("files", []),
                    "recommendation": f.get("recommendation", ""),
                })

    # Also check escalation resolutions for P0 findings
    esc_path = ws / "_mailbox" / "escalations.json"
    if esc_path.exists():
        esc_data = read_json(esc_path)
        for e in esc_data.get("escalations", []):
            if e.get("severity") == "P0" and e.get("resolution_summary"):
                blockers.append({
                    "role": e.get("to_role", ""),
                    "label": ROLE_LABELS.get(e.get("to_role", ""), ""),
                    "finding_id": e.get("resolution_finding_id", ""),
                    "title": f"[Escalation] {e.get('subject', '')}",
                    "evidence": e.get("resolution_summary", ""),
                    "files": [],
                    "recommendation": "",
                })

    print(json.dumps(blockers, ensure_ascii=False, indent=2))
    return blockers


def cmd_report_data(ws: Path) -> dict[str, Any]:
    """Comprehensive data for report generation."""
    session = read_json(ws / "_session.json")

    # Aggregate if not done
    scores_path = ws / "_synthesis" / "scores.json"
    if not scores_path.exists():
        scores_data = cmd_aggregate(ws)
    else:
        scores_data = read_json(scores_path)

    all_findings = load_all_findings(ws)
    blockers = cmd_blockers(ws)

    # Load cross-findings
    cross_path = ws / "_synthesis" / "cross-findings.json"
    cross_findings = read_json(cross_path) if cross_path.exists() else {"findings": []}

    # Load escalation history
    esc_path = ws / "_mailbox" / "escalations.json"
    escalations = []
    if esc_path.exists():
        esc_data = read_json(esc_path)
        escalations = esc_data.get("escalations", [])

    # Determine promotion decision
    has_p0 = len(blockers) > 0
    overall_avg = scores_data.get("overall_avg")

    if has_p0:
        decision = "暂不建议推广"
    elif overall_avg is not None and overall_avg >= 7:
        decision = "可以推广"
    elif overall_avg is not None and overall_avg >= 5:
        decision = "小范围试推广"
    else:
        decision = "暂不建议推广"

    # Build per-role detail
    role_details: dict[str, Any] = {}
    for code, findings in all_findings.items():
        role_info = session.get("roles", {}).get(code, {})
        if not role_info.get("applicable", True):
            role_details[code] = {"applicable": False, "label": ROLE_LABELS.get(code, code)}
            continue

        if findings is None:
            role_details[code] = {"applicable": True, "label": ROLE_LABELS.get(code, code), "data": None}
            continue

        # Read notes if available
        notes_path = ws / ROLE_DIR_MAP[code] / "notes.md"
        notes = notes_path.read_text(encoding="utf-8") if notes_path.exists() else None

        role_details[code] = {
            "applicable": True,
            "label": ROLE_LABELS.get(code, code),
            "data": findings,
            "notes": notes,
        }

    result = {
        "repo": session.get("repo", "unknown"),
        "decision": decision,
        "scores": scores_data,
        "blockers": blockers,
        "cross_findings": cross_findings.get("findings", []),
        "escalations": escalations,
        "role_details": role_details,
        "overall_avg": scores_data.get("overall_avg"),
    }

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return result


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Aggregate team findings for report.")
    sub = parser.add_subparsers(dest="command")

    for cmd_name in ("aggregate", "scores", "blockers", "report-data"):
        p = sub.add_parser(cmd_name, help=f"Run {cmd_name}")
        p.add_argument("--dir", default=".", help="Base directory")

    args = parser.parse_args()
    ws = resolve_workspace(args.dir)

    if args.command == "aggregate":
        cmd_aggregate(ws)
        return 0
    if args.command == "scores":
        cmd_scores(ws)
        return 0
    if args.command == "blockers":
        cmd_blockers(ws)
        return 0
    if args.command == "report-data":
        cmd_report_data(ws)
        return 0

    parser.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
