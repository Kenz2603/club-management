import json
import os
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

CONTAINER = "club-management-backend-1"
LOG = Path("/var/log/club/backend/backend.log")
STATE = Path("/var/lib/club-log-forwarder/last_timestamp")
DOCKER = "/usr/bin/docker"

def read_state():
    if STATE.exists():
        value = STATE.read_text().strip()
        if value:
            return value
    return None

def save_state(value):
    temporary = STATE.with_suffix(".tmp")
    temporary.write_text(value + "\n")
    os.replace(temporary, STATE)

def run():
    LOG.parent.mkdir(parents=True, exist_ok=True)
    STATE.parent.mkdir(parents=True, exist_ok=True)

    while True:
        since = read_state()

        command = [
            DOCKER,
            "logs",
            "--follow",
            "--timestamps",
            "--tail",
            "0" if since is None else "all",
        ]

        if since:
            command.extend(["--since", since])

        command.append(CONTAINER)

        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            bufsize=1,
        )

        try:
            with LOG.open("a", encoding="utf-8", buffering=1) as output:
                os.chmod(LOG, 0o640)

                for line in process.stdout:
                    timestamp, separator, payload = line.partition(" ")

                    if not separator:
                        continue

                    try:
                        datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
                        json.loads(payload)
                    except (ValueError, json.JSONDecodeError):
                        continue

                    previous = read_state()

                    if previous and timestamp <= previous:
                        continue

                    output.write(payload.rstrip("\n") + "\n")
                    output.flush()
                    save_state(timestamp)

        finally:
            process.wait()

        time.sleep(3)

if __name__ == "__main__":
    run()
