"""Run the backend with auto-reload: the server restarts whenever a backend file changes.

    C:\\venvs\\hw4\\Scripts\\python.exe dev.py            (port 8000)
    C:\\venvs\\hw4\\Scripts\\python.exe dev.py 8001       (another port)

Why not `uvicorn main:app --reload`? On Windows, uvicorn's reloader stops the old server
by sending it a Ctrl+C event and then waits with no timeout. When the server isn't
attached to a regular console window, that event never arrives, so the reload hangs and
the old code keeps running. watchfiles' runner (the same library uvicorn uses to watch
files) stops the old server with a timeout and falls back to killing it, so a reload
always completes.

Watches this folder for .py and .md changes, so editing prompts/prompt.md also reloads.
"""

import sys
from pathlib import Path

import uvicorn
from watchfiles import PythonFilter, run_process

HERE = Path(__file__).resolve().parent
HOST = "127.0.0.1"


def serve(port: int) -> None:
    uvicorn.run("main:app", host=HOST, port=port, app_dir=str(HERE))


def on_reload(changes: set) -> None:
    files = sorted({Path(path).name for _, path in changes})
    print(f"\nReloading: changed {', '.join(files)}", flush=True)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f"Campus Customs backend on http://{HOST}:{port} with auto-reload (Ctrl+C to stop)", flush=True)
    run_process(
        HERE,
        target=serve,
        args=(port,),
        watch_filter=PythonFilter(extra_extensions=(".md",)),
        callback=on_reload,
    )
