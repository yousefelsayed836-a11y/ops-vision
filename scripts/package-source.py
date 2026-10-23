"""Package authored source only; exclude secrets, databases and installed/build artifacts."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib
import json
import os

root = Path(__file__).resolve().parents[1]
target = root.parent / "opsvision-source.zip"
excluded = {"node_modules", ".next", ".next-dev", ".data", ".git", "coverage", ".cache", "__pycache__"}
files = []
paths = []
for directory, dirs, names in os.walk(root):
    dirs[:] = [name for name in dirs if name not in excluded and not (Path(directory) == root / "src" and name == "generated")]
    paths.extend(Path(directory) / name for name in names)
for path in paths:
    relative = path.relative_to(root)
    if any(part in excluded for part in relative.parts):
        continue
    if relative.parts[:2] == ("src", "generated"):
        continue
    if not path.is_file() or path.is_symlink():
        continue
    if path.name.startswith(".env") and path.name != ".env.example":
        continue
    if path.suffix in {".log", ".tsbuildinfo", ".zip", ".pem", ".key"}:
        continue
    files.append((path, relative))
with ZipFile(target, "w", ZIP_DEFLATED) as archive:
    for path, relative in sorted(files):
        archive.write(path, (Path("opsvision") / relative).as_posix())
with ZipFile(target) as archive:
    assert archive.testzip() is None
    assert not any("/.env" in name and not name.endswith("/.env.example") for name in archive.namelist())
checksum = hashlib.sha256(target.read_bytes()).hexdigest()
target.with_suffix(".zip.sha256").write_text(f"{checksum}  {target.name}\n", encoding="utf-8")
print(json.dumps({"archive": str(target), "files": len(files), "bytes": target.stat().st_size, "sha256": checksum}))
