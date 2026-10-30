# YourPDF

A small, local PDF studio for merging, splitting, compressing, rotating, deleting, and reordering pages. The React frontend talks to a Python FastAPI backend on your computer; there are no accounts or document storage.

## Requirements

- Python 3.11 or later and [uv](https://docs.astral.sh/uv/)
- Node.js 20 or later and npm
- Ghostscript for compression: on macOS, `brew install ghostscript`; on Ubuntu or Debian, `sudo apt install ghostscript`. On Windows, install Ghostscript and ensure `gs` is on your PATH. The other tools do not need Ghostscript.

## Start the app

In the project directory, start the backend:

```sh
uv sync
uv run uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

In a second terminal, start the frontend:

```sh
cd frontend
npm install
npm run dev
```

Open the local address printed by Vite (normally http://localhost:5173). Keep both terminals running. The development server proxies `/api` requests to the backend.

## Using the tools

- **Merge:** add at least two PDFs and use the arrows to set their order.
- **Split:** enter comma-separated page numbers or ranges such as `1-3, 4-6`. Each selection becomes a separate PDF in a downloaded ZIP.
- **Compress:** choose light, balanced, or strong compression. Image quality can be reduced; some PDFs may not become smaller.
- **Rotate / delete:** select pages with numbers and ranges, for example `1, 3-5`. Rotation is clockwise; deletion must leave at least one page.
- **Reorder:** list every page once in the desired order, for example `3, 1, 2`.

Page numbers begin at 1. Encrypted PDFs are not supported. Files are processed locally; compression uses a temporary directory that is removed after processing. The app is intended for local use, not exposure to the public internet. Fonts may be fetched from Google Fonts; system fonts are used if unavailable.

## Verification

```sh
uv run pytest
cd frontend && npm run build
```
