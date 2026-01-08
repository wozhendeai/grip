#!/usr/bin/env python3
"""
Remove unused database query functions.

Scans SSR pages and API routes to find which db/queries functions are used,
then removes unused functions from the source files.

Usage:
    python scripts/cleanup-unused-queries.py --dry-run  # Preview changes
    python scripts/cleanup-unused-queries.py            # Actually delete
"""

import re
import argparse
from pathlib import Path
from dataclasses import dataclass


@dataclass
class FunctionInfo:
    name: str
    module: str
    file_path: Path
    start_line: int
    end_line: int
    content: str


def find_used_queries(app_dir: Path, api_dir: Path, lib_dir: Path, queries_dir: Path) -> set[str]:
    """Find all queries used by SSR pages, API routes, lib utilities, and re-exports."""
    used = set()

    # Scan SSR pages (page.tsx, layout.tsx without 'use client')
    for tsx_file in app_dir.rglob("*.tsx"):
        if tsx_file.name not in ("page.tsx", "layout.tsx"):
            continue

        content = tsx_file.read_text()

        # Skip client components
        if "'use client'" in content or '"use client"' in content:
            continue

        # Find db query imports
        used.update(extract_used_queries(content))

    # Scan API routes (including dynamic imports)
    for route_file in api_dir.rglob("route.ts"):
        content = route_file.read_text()
        used.update(extract_used_queries(content))

    # Scan server actions (_actions/*.ts)
    for action_file in app_dir.rglob("_actions/*.ts"):
        content = action_file.read_text()
        used.update(extract_used_queries(content))

    # Scan server components (_components/*.tsx without 'use client')
    for component_file in app_dir.rglob("_components/*.tsx"):
        content = component_file.read_text()
        if "'use client'" not in content and '"use client"' not in content:
            used.update(extract_used_queries(content))

    # Scan lib/ directory (utility functions that use db queries)
    if lib_dir.exists():
        for ts_file in lib_dir.rglob("*.ts"):
            content = ts_file.read_text()
            used.update(extract_used_queries(content))

    # Check re-exports in db/queries/index.ts
    index_file = queries_dir / "index.ts"
    if index_file.exists():
        content = index_file.read_text()
        # Find: export { func1, func2 as alias } from './module'
        reexports = re.findall(
            r"export\s*\{([^}]+)\}\s*from\s*['\"]\./?([\w-]+)['\"]", content
        )
        for funcs, module in reexports:
            for func in funcs.split(","):
                func = func.strip()
                if func.startswith("type "):
                    continue
                # Handle 'original as alias' - we want the original name
                if " as " in func:
                    func = func.split(" as ")[0].strip()
                if func:
                    used.add(f"{module}.{func}")

    return used


def extract_used_queries(content: str) -> set[str]:
    """Extract module.function names from file content."""
    used = set()

    # Find static imports: import { func1, func2 } from '@/db/queries/module'
    # Module names can have hyphens (e.g., pending-payments, repo-settings)
    db_imports = re.findall(
        r"import\s*\{([^}]+)\}\s*from\s*['\"]@/db/queries/([\w-]+)['\"]", content
    )

    for funcs, module in db_imports:
        for func in funcs.split(","):
            func = func.strip()
            # Handle 'type X' imports
            if func.startswith("type "):
                continue
            # Handle 'X as Y' imports
            if " as " in func:
                func = func.split(" as ")[0].strip()
            # Check if actually called (not just imported)
            if func and re.search(rf"\b{re.escape(func)}\s*\(", content):
                used.add(f"{module}.{func}")

    # Find dynamic imports: const { func } = await import('@/db/queries/module')
    # Handle both single-line and multi-line dynamic imports
    # Pattern matches: { funcs } = await import( followed later by '@/db/queries/module'
    dynamic_pattern = r"\{\s*([\w\s,]+)\s*\}\s*=\s*await\s+import\s*\(\s*['\"]@/db/queries/([\w-]+)['\"]"
    for match in re.finditer(dynamic_pattern, content, re.DOTALL):
        funcs_str, module = match.groups()
        for func in funcs_str.split(","):
            func = func.strip()
            if func and re.search(rf"\b{re.escape(func)}\s*\(", content):
                used.add(f"{module}.{func}")

    # Also find imports from @/db/queries (the index file)
    index_imports = re.findall(
        r"import\s*\{([^}]+)\}\s*from\s*['\"]@/db/queries['\"]", content
    )
    for funcs in index_imports:
        for func in funcs.split(","):
            func = func.strip()
            if func.startswith("type "):
                continue
            if " as " in func:
                func = func.split(" as ")[0].strip()
            # For index imports, we need to figure out which module they're from
            # Just mark them as used for now (module will be determined by re-exports)
            if func and re.search(rf"\b{re.escape(func)}\s*\(", content):
                used.add(f"__index__.{func}")

    return used


def parse_functions(file_path: Path) -> list[FunctionInfo]:
    """Parse exported async functions from a file."""
    content = file_path.read_text()
    lines = content.split("\n")
    module = file_path.stem
    functions = []

    # Pattern to match function start (with optional JSDoc)
    # We need to find: /** ... */ export async function name(
    i = 0
    while i < len(lines):
        line = lines[i]

        # Check for JSDoc start
        jsdoc_start = None
        if line.strip().startswith("/**"):
            jsdoc_start = i
            # Find end of JSDoc
            while i < len(lines) and "*/" not in lines[i]:
                i += 1
            i += 1  # Move past the */ line
            if i >= len(lines):
                break
            line = lines[i]

        # Check for export async function
        match = re.match(r"^export\s+async\s+function\s+(\w+)\s*\(", line)
        if match:
            func_name = match.group(1)
            func_start = jsdoc_start if jsdoc_start is not None else i

            # Find end of function by tracking braces
            brace_count = 0
            func_end = i
            started = False

            for j in range(i, len(lines)):
                for char in lines[j]:
                    if char == "{":
                        brace_count += 1
                        started = True
                    elif char == "}":
                        brace_count -= 1

                if started and brace_count == 0:
                    func_end = j
                    break

            # Extract function content
            func_content = "\n".join(lines[func_start : func_end + 1])

            functions.append(
                FunctionInfo(
                    name=func_name,
                    module=module,
                    file_path=file_path,
                    start_line=func_start,
                    end_line=func_end,
                    content=func_content,
                )
            )

            i = func_end + 1
        else:
            i += 1

    return functions


def remove_functions(file_path: Path, functions_to_remove: list[FunctionInfo]) -> str:
    """Remove specified functions from file content."""
    content = file_path.read_text()
    lines = content.split("\n")

    # Sort by line number descending to remove from bottom up
    functions_to_remove.sort(key=lambda f: f.start_line, reverse=True)

    for func in functions_to_remove:
        # Remove the function lines
        del lines[func.start_line : func.end_line + 1]

        # Remove any blank lines that are now doubled up
        # (but be careful not to remove intentional spacing)

    # Clean up multiple blank lines
    result_lines = []
    prev_blank = False
    for line in lines:
        is_blank = line.strip() == ""
        if is_blank and prev_blank:
            continue
        result_lines.append(line)
        prev_blank = is_blank

    return "\n".join(result_lines)


def main():
    parser = argparse.ArgumentParser(description="Remove unused DB query functions")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without modifying files",
    )
    args = parser.parse_args()

    cwd = Path.cwd()
    app_dir = cwd / "app"
    api_dir = cwd / "app" / "api"
    lib_dir = cwd / "lib"
    queries_dir = cwd / "db" / "queries"

    if not queries_dir.exists():
        print(f"Error: Queries directory not found at {queries_dir}")
        return 1

    # Find used queries
    used_queries = find_used_queries(app_dir, api_dir, lib_dir, queries_dir)
    print(f"Found {len(used_queries)} used queries\n")

    # Parse all functions
    all_functions: list[FunctionInfo] = []
    for ts_file in sorted(queries_dir.glob("*.ts")):
        if ts_file.name == "index.ts":
            continue
        all_functions.extend(parse_functions(ts_file))

    print(f"Found {len(all_functions)} total functions\n")

    # Find unused functions
    # A function is used if either:
    # 1. It's directly referenced as module.func
    # 2. It's imported from index file and called (__index__.func)
    def is_used(f: FunctionInfo) -> bool:
        direct = f"{f.module}.{f.name}" in used_queries
        via_index = f"__index__.{f.name}" in used_queries
        return direct or via_index

    unused = [f for f in all_functions if not is_used(f)]

    if not unused:
        print("No unused functions found!")
        return 0

    print(f"Found {len(unused)} unused functions:\n")

    # Group by module
    by_module: dict[str, list[FunctionInfo]] = {}
    for func in unused:
        by_module.setdefault(func.module, []).append(func)

    for module, funcs in sorted(by_module.items()):
        print(f"  {module}.ts:")
        for func in funcs:
            print(f"    - {func.name}")
        print()

    if args.dry_run:
        print("Dry run - no files modified")
        return 0

    # Actually remove the functions
    print("Removing unused functions...")

    for module, funcs in by_module.items():
        file_path = queries_dir / f"{module}.ts"
        new_content = remove_functions(file_path, funcs)
        file_path.write_text(new_content)
        print(f"  Updated {file_path.name} (removed {len(funcs)} functions)")

    print("\nDone!")
    return 0


if __name__ == "__main__":
    exit(main())
