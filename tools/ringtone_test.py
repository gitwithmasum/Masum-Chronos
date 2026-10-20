"""Shared manual-loop and ten-second auto-stop regression check."""
from pathlib import Path
import subprocess
subprocess.run(["node", "tools/sound_studio_test.cjs"], cwd=Path(__file__).resolve().parents[1], check=True)
