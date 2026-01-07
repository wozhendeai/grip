#!/usr/bin/env python3
"""
Document the structure of the Next.js API routes.

Scans app/api/ for route.ts files and extracts:
- Route path (from directory structure)
- HTTP methods exported (GET, POST, PUT, DELETE, PATCH)
- JSDoc descriptions if present

Usage:
    python scripts/document-api.py [--format markdown|json]
"""

import os
import re
import json
import argparse
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class RouteInfo:
    path: str
    file_path: str
    methods: list[str] = field(default_factory=list)
    description: Optional[str] = None
    auth_required: bool = False
    queries_used: list[str] = field(default_factory=list)


@dataclass
class SSRPageInfo:
    route: str
    file_path: str
    queries_used: list[str] = field(default_factory=list)


@dataclass
class DBQueryInfo:
    name: str
    module: str
    file_path: str
    operation: str  # READ, CREATE, UPDATE, DELETE
    description: Optional[str] = None


def parse_route_file(file_path: Path) -> RouteInfo:
    """Parse a route.ts file to extract methods and metadata."""
    content = file_path.read_text()

    # Convert file path to API route
    # e.g., app/api/bounties/[id]/route.ts -> /api/bounties/[id]
    rel_path = str(file_path.relative_to(Path.cwd()))
    route_path = rel_path.replace("app/api", "/api").replace("/route.ts", "")

    # Find exported HTTP methods
    methods = []
    http_methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]
    for method in http_methods:
        # Match: export async function GET, export function GET, export const GET
        if re.search(rf"export\s+(async\s+)?function\s+{method}\b", content):
            methods.append(method)
        elif re.search(rf"export\s+const\s+{method}\s*=", content):
            methods.append(method)

    # Extract JSDoc comment - try function-level first, then file-level
    description = None

    # Try function-level JSDoc: /** ... */ followed by export (async)? function
    jsdoc_pattern = r"/\*\*\s*([\s\S]*?)\*/\s*export\s+(async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)"
    jsdoc_match = re.search(jsdoc_pattern, content)

    # If no function-level doc, try file-level doc at start of file
    if not jsdoc_match:
        jsdoc_match = re.match(r"^\s*/\*\*\s*([\s\S]*?)\*/", content)

    if jsdoc_match:
        desc_lines = []
        for line in jsdoc_match.group(1).split("\n"):
            line = re.sub(r"^\s*\*\s?", "", line).strip()
            # Skip empty lines, @param, @returns, route path lines like "POST /api/..."
            if line and not line.startswith("@") and not re.match(r"^(GET|POST|PUT|DELETE|PATCH)\s+/", line):
                desc_lines.append(line)
        if desc_lines:
            description = " ".join(desc_lines)

    # Check if auth is required (look for getSession, auth, requireAuth patterns)
    auth_patterns = [
        r"getSession\s*\(",
        r"auth\.api\.",
        r"requireAuth",
        r"session\s*=\s*await",
        r"headers\(\).*authorization",
    ]
    auth_required = any(re.search(p, content, re.IGNORECASE) for p in auth_patterns)

    # Find db query imports: import { func1, func2 } from '@/db/queries/module'
    db_imports = re.findall(
        r"import\s*\{([^}]+)\}\s*from\s*['\"]@/db/queries/(\w+)['\"]", content
    )

    # Extract which queries are actually called
    queries_used = []
    for funcs, module in db_imports:
        for func in funcs.split(","):
            func = func.strip()
            # Handle 'type X' imports
            if func.startswith("type "):
                continue
            # Handle 'X as Y' imports
            if " as " in func:
                func = func.split(" as ")[0].strip()
            if func and re.search(rf"\b{re.escape(func)}\s*\(", content):
                queries_used.append(f"{module}.{func}")

    return RouteInfo(
        path=route_path,
        file_path=rel_path,
        methods=methods,
        description=description,
        auth_required=auth_required,
        queries_used=sorted(set(queries_used)),
    )


def find_route_files(api_dir: Path) -> list[Path]:
    """Find all route.ts files in the API directory."""
    return sorted(api_dir.rglob("route.ts"))


def is_ssr_page(file_path: Path) -> bool:
    """Check if file is an SSR page (no 'use client' + imports from db/)."""
    content = file_path.read_text()

    # Skip client components
    if "'use client'" in content or '"use client"' in content:
        return False

    # Must import from db
    if not re.search(r"from\s+['\"]@/db", content):
        return False

    return True


def file_to_route(file_path: Path, app_dir: Path) -> str:
    """Convert file path to Next.js route."""
    rel = file_path.relative_to(app_dir)
    parts = list(rel.parts)

    # Remove file name
    parts = parts[:-1]

    # Remove route groups like (main)
    parts = [p for p in parts if not (p.startswith("(") and p.endswith(")"))]

    # Remove _components, _lib, etc
    parts = [p for p in parts if not p.startswith("_")]

    return "/" + "/".join(parts) if parts else "/"


def parse_ssr_page(file_path: Path, app_dir: Path) -> SSRPageInfo:
    """Extract data fetching info from SSR page."""
    content = file_path.read_text()
    rel_path = str(file_path.relative_to(Path.cwd()))

    # Find db query imports: import { func1, func2 } from '@/db/queries/module'
    db_imports = re.findall(
        r"import\s*\{([^}]+)\}\s*from\s*['\"]@/db/queries/(\w+)['\"]", content
    )

    # Extract which queries are actually called
    queries_used = []
    for funcs, module in db_imports:
        for func in funcs.split(","):
            func = func.strip()
            # Handle 'type X' imports
            if func.startswith("type "):
                continue
            # Handle 'X as Y' imports
            if " as " in func:
                func = func.split(" as ")[0].strip()
            if func and re.search(rf"\b{re.escape(func)}\s*\(", content):
                queries_used.append(f"{module}.{func}")

    return SSRPageInfo(
        route=file_to_route(file_path, app_dir),
        file_path=rel_path,
        queries_used=sorted(set(queries_used)),
    )


def find_ssr_pages(app_dir: Path) -> list[SSRPageInfo]:
    """Find all SSR pages that import from db/."""
    pages = []
    for tsx_file in app_dir.rglob("*.tsx"):
        # Only look at page.tsx and layout.tsx
        if tsx_file.name not in ("page.tsx", "layout.tsx"):
            continue
        if is_ssr_page(tsx_file):
            pages.append(parse_ssr_page(tsx_file, app_dir))
    return sorted(pages, key=lambda p: p.route)


def infer_operation(func_name: str) -> str:
    """Infer CRUD operation from function name."""
    name_lower = func_name.lower()
    if any(name_lower.startswith(p) for p in ["get", "find", "list", "fetch", "is", "has", "check"]):
        return "READ"
    if any(name_lower.startswith(p) for p in ["create", "insert", "add"]):
        return "CREATE"
    if any(name_lower.startswith(p) for p in ["update", "set", "mark", "approve", "reject"]):
        return "UPDATE"
    if any(name_lower.startswith(p) for p in ["delete", "remove", "revoke"]):
        return "DELETE"
    return "READ"  # Default


def parse_db_queries(queries_dir: Path) -> list[DBQueryInfo]:
    """Parse all db/queries/*.ts files for exported functions."""
    queries = []

    for ts_file in sorted(queries_dir.glob("*.ts")):
        if ts_file.name == "index.ts":
            continue

        module = ts_file.stem
        content = ts_file.read_text()
        rel_path = str(ts_file.relative_to(Path.cwd()))

        # Find exported async functions
        # Pattern: /** JSDoc */ export async function name(
        pattern = r"(?:/\*\*\s*([\s\S]*?)\*/\s*)?export\s+async\s+function\s+(\w+)\s*\("
        for match in re.finditer(pattern, content):
            jsdoc = match.group(1)
            func_name = match.group(2)

            description = None
            if jsdoc:
                desc_lines = []
                for line in jsdoc.split("\n"):
                    line = re.sub(r"^\s*\*\s?", "", line).strip()
                    if line and not line.startswith("@"):
                        desc_lines.append(line)
                if desc_lines:
                    description = " ".join(desc_lines)

            queries.append(
                DBQueryInfo(
                    name=func_name,
                    module=module,
                    file_path=rel_path,
                    operation=infer_operation(func_name),
                    description=description,
                )
            )

    return queries


def group_by_prefix(routes: list[RouteInfo]) -> dict[str, list[RouteInfo]]:
    """Group routes by their first path segment."""
    groups: dict[str, list[RouteInfo]] = {}
    for route in routes:
        # Extract first segment after /api/
        parts = route.path.split("/")
        if len(parts) >= 3:
            prefix = parts[2]  # /api/{prefix}/...
        else:
            prefix = "root"

        if prefix not in groups:
            groups[prefix] = []
        groups[prefix].append(route)

    return groups


def format_markdown(
    routes: list[RouteInfo],
    ssr_pages: list[SSRPageInfo] | None = None,
    db_queries: list[DBQueryInfo] | None = None,
) -> str:
    """Format routes as Markdown documentation."""
    lines = [
        "# Server-Side Documentation",
        "",
    ]

    # Collect all used queries from SSR pages and API routes
    used_queries: set[str] = set()
    if ssr_pages:
        for page in ssr_pages:
            used_queries.update(page.queries_used)
    for route in routes:
        used_queries.update(route.queries_used)

    # Filter db_queries to only show used ones
    used_db_queries = [q for q in (db_queries or []) if f"{q.module}.{q.name}" in used_queries]

    # Summary
    summary_parts = [f"{len(routes)} API routes"]
    if ssr_pages:
        summary_parts.append(f"{len(ssr_pages)} SSR pages")
    if db_queries:
        summary_parts.append(f"{len(used_db_queries)}/{len(db_queries)} DB queries used")
    lines.append(f"Generated: {', '.join(summary_parts)}.")
    lines.append("")

    # SSR Pages section
    if ssr_pages:
        lines.append("## SSR Pages")
        lines.append("")
        lines.append("Pages that fetch data server-side (no `'use client'` + imports from `@/db`).")
        lines.append("")
        lines.append("| Route | File | Queries Used |")
        lines.append("|-------|------|--------------|")
        for page in ssr_pages:
            queries = ", ".join(f"`{q}`" for q in page.queries_used) or "-"
            lines.append(f"| `{page.route}` | `{page.file_path}` | {queries} |")
        lines.append("")

    # API Routes section
    lines.append("## API Routes")
    lines.append("")

    groups = group_by_prefix(routes)

    for group_name, group_routes in sorted(groups.items()):
        lines.append(f"### {group_name.title()}")
        lines.append("")
        lines.append("| Route | Methods | Auth | Description |")
        lines.append("|-------|---------|------|-------------|")

        for route in group_routes:
            methods_str = ", ".join(f"`{m}`" for m in route.methods) or "-"
            auth_str = "✓" if route.auth_required else "-"
            desc = route.description[:60] + "..." if route.description and len(route.description) > 60 else (route.description or "-")
            desc = desc.replace("|", "\\|")
            lines.append(f"| `{route.path}` | {methods_str} | {auth_str} | {desc} |")

        lines.append("")

    # DB Queries section - only show used queries
    if used_db_queries:
        lines.append("## Database Queries (Used)")
        lines.append("")

        # Group by module
        by_module: dict[str, list[DBQueryInfo]] = {}
        for q in used_db_queries:
            by_module.setdefault(q.module, []).append(q)

        for module, queries in sorted(by_module.items()):
            lines.append(f"### {module}")
            lines.append("")
            lines.append("| Function | Op | Description |")
            lines.append("|----------|-----|-------------|")
            for q in queries:
                op_badge = {"READ": "R", "CREATE": "C", "UPDATE": "U", "DELETE": "D"}.get(q.operation, "?")
                desc = q.description[:50] + "..." if q.description and len(q.description) > 50 else (q.description or "-")
                desc = desc.replace("|", "\\|")
                lines.append(f"| `{q.name}` | {op_badge} | {desc} |")
            lines.append("")

    return "\n".join(lines)


def format_json(routes: list[RouteInfo]) -> str:
    """Format routes as JSON."""
    data = {
        "total": len(routes),
        "routes": [
            {
                "path": r.path,
                "file": r.file_path,
                "methods": r.methods,
                "auth_required": r.auth_required,
                "description": r.description,
            }
            for r in routes
        ],
        "by_group": {
            group: [r.path for r in routes]
            for group, routes in group_by_prefix(routes).items()
        },
    }
    return json.dumps(data, indent=2)


def main():
    parser = argparse.ArgumentParser(description="Document Next.js server-side code")
    parser.add_argument(
        "--format",
        choices=["markdown", "json"],
        default="markdown",
        help="Output format (default: markdown)",
    )
    parser.add_argument(
        "--output",
        "-o",
        type=str,
        help="Output file (default: stdout)",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Include SSR pages and DB queries (default: API routes only)",
    )
    parser.add_argument(
        "--routes-only",
        action="store_true",
        help="Only document API routes",
    )
    args = parser.parse_args()

    cwd = Path.cwd()
    api_dir = cwd / "app" / "api"
    app_dir = cwd / "app"
    queries_dir = cwd / "db" / "queries"

    if not api_dir.exists():
        print(f"Error: API directory not found at {api_dir}")
        return 1

    # Find and parse API routes
    route_files = find_route_files(api_dir)
    routes = [parse_route_file(f) for f in route_files]

    # Parse SSR pages and DB queries if --all
    ssr_pages = None
    db_queries = None

    if args.all and not args.routes_only:
        if app_dir.exists():
            ssr_pages = find_ssr_pages(app_dir)
        if queries_dir.exists():
            db_queries = parse_db_queries(queries_dir)

    # Format output
    if args.format == "markdown":
        output = format_markdown(routes, ssr_pages, db_queries)
    else:
        output = format_json(routes)

    # Write output
    if args.output:
        Path(args.output).write_text(output)
        print(f"Written to {args.output}")
    else:
        print(output)

    return 0


if __name__ == "__main__":
    exit(main())
