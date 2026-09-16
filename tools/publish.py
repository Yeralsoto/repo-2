"""Makes dist/ — exactly the files the live site needs, and nothing else.

    python3 tools/build.py && python3 tools/publish.py

Upload the CONTENTS of dist/ to the host's web root (public_html, htdocs, www…),
or drag the dist folder itself onto Netlify. Her notes, the source, the Figma
files and the old homepage stay behind.
"""
import os, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")
# every public part of the site; anything not named here never reaches the host
SITE = ["index.html", "robots.txt", "sitemap.xml", "assets", "css", "js",
        "about", "work", "mind", "practice", "journal", "days", "aerodrome", "path",
        "aerodrome-3d", "follow-the-line"]
SKIP_DIRS = {".git", "tools", "figma", "content", "__pycache__", "node_modules"}
SKIP_FILES = {".DS_Store", "CLAUDE.md", "BACKLINKS.md", "README.md", "index.previous.html", ".gitattributes"}

def keep(path, names):
    return [n for n in names if n in SKIP_DIRS or n in SKIP_FILES or n.endswith((".md", ".py", ".pyc"))]

def main():
    if os.path.isdir(DIST):
        shutil.rmtree(DIST)
    os.makedirs(DIST)
    missing = []
    for item in SITE:
        src = os.path.join(ROOT, item)
        if not os.path.exists(src):
            missing.append(item); continue
        dst = os.path.join(DIST, item)
        if os.path.isdir(src):
            shutil.copytree(src, dst, ignore=keep)
        else:
            shutil.copy2(src, dst)
    files = bytes_ = 0
    for base, dirs, names in os.walk(DIST):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for n in names:
            if n in SKIP_FILES:
                os.remove(os.path.join(base, n)); continue
            files += 1
            bytes_ += os.path.getsize(os.path.join(base, n))
    print(f"dist/ ready — {files} files, {bytes_/1e6:.1f} MB")
    if missing:
        print("missing (not copied):", ", ".join(missing))
    # a page that still points at something outside dist/ would break once it is live
    import re
    broken = []
    for base, dirs, names in os.walk(DIST):
        for n in names:
            if not n.endswith(".html"):
                continue
            p = os.path.join(base, n)
            html = open(p, encoding="utf8").read()
            for m in re.finditer(r'(?:href|src)="((?!https?:|mailto:|tel:|data:|#|\?)[^"]+)"', html):
                t = m.group(1).split("#")[0].split("?")[0]
                if not t or t.endswith("/"):
                    continue
                if not os.path.exists(os.path.normpath(os.path.join(base, t))):
                    broken.append(f"{os.path.relpath(p, DIST)} → {t}")
    print("broken links:", len(broken))
    for b in broken[:10]:
        print("  ", b)
    return 1 if broken or missing else 0

if __name__ == "__main__":
    sys.exit(main())
