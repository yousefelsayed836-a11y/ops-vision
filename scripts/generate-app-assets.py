"""Run the web asset export pipeline for approved dashboard branding."""
from pathlib import Path
import subprocess
subprocess.run(["node", str(Path(__file__).with_suffix(".mjs"))], check=True)
