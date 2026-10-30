from io import BytesIO
from pathlib import Path
import shutil
import subprocess
import tempfile
import zipfile

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pypdf import PdfReader, PdfWriter

app = FastAPI(title="YourPDF", version="0.1.0")


def reader_for(data: bytes) -> PdfReader:
    try:
        reader = PdfReader(BytesIO(data), strict=True)
        if reader.is_encrypted:
            raise HTTPException(400, "Encrypted PDFs are not supported.")
        if not reader.pages:
            raise HTTPException(400, "The PDF has no pages.")
        return reader
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(400, "Invalid or unreadable PDF file.") from exc


def parse_pages(value: str, count: int, *, allow_duplicates: bool = False) -> list[int]:
    pages = []
    try:
        for part in value.split(","):
            part = part.strip()
            if not part:
                raise ValueError()
            if "-" in part:
                start, end = (int(x.strip()) for x in part.split("-"))
                if start < 1 or start > end or end > count:
                    raise ValueError()
                pages.extend(range(start, end + 1))
            else:
                pages.append(int(part))
        if not pages or any(p < 1 or p > count for p in pages):
            raise ValueError()
        if not allow_duplicates and len(set(pages)) != len(pages):
            raise ValueError()
    except (ValueError, OverflowError):
        raise HTTPException(400, f"Invalid page selection. Use pages 1–{count}, for example 1, 3-5, without duplicates.")
    return [p - 1 for p in pages]


def pdf_response(writer: PdfWriter, filename: str) -> Response:
    output = BytesIO()
    writer.write(output)
    return Response(output.getvalue(), media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/merge")
async def merge(files: list[UploadFile] = File(...)):
    if len(files) < 2:
        raise HTTPException(400, "Choose at least two PDF files to merge.")
    writer = PdfWriter()
    for file in files:
        reader = reader_for(await file.read())
        for page in reader.pages:
            writer.add_page(page)
    return pdf_response(writer, "merged.pdf")


@app.post("/api/split")
async def split(file: UploadFile = File(...), ranges: str = Form(...)):
    reader = reader_for(await file.read())
    # Each comma-separated page or range becomes its own PDF in the archive.
    selections = ranges.split(",")
    parse_pages(ranges, len(reader.pages))
    output = BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for index, selection in enumerate(selections, 1):
            writer = PdfWriter()
            for page in parse_pages(selection, len(reader.pages)):
                writer.add_page(reader.pages[page])
            pdf = BytesIO()
            writer.write(pdf)
            archive.writestr(f"part-{index}.pdf", pdf.getvalue())
    return Response(output.getvalue(), media_type="application/zip", headers={"Content-Disposition": 'attachment; filename="split-pages.zip"'})


@app.post("/api/rotate")
async def rotate(file: UploadFile = File(...), pages: str = Form(...), angle: int = Form(...)):
    reader = reader_for(await file.read())
    if angle not in (90, 180, 270):
        raise HTTPException(400, "Choose a rotation of 90, 180, or 270 degrees.")
    selected = set(parse_pages(pages, len(reader.pages)))
    writer = PdfWriter()
    for index, page in enumerate(reader.pages):
        if index in selected:
            page.rotate(angle)
        writer.add_page(page)
    return pdf_response(writer, "rotated.pdf")


@app.post("/api/delete")
async def delete(file: UploadFile = File(...), pages: str = Form(...)):
    reader = reader_for(await file.read())
    selected = set(parse_pages(pages, len(reader.pages)))
    if len(selected) == len(reader.pages):
        raise HTTPException(400, "Keep at least one page in the PDF.")
    writer = PdfWriter()
    for index, page in enumerate(reader.pages):
        if index not in selected:
            writer.add_page(page)
    return pdf_response(writer, "trimmed.pdf")


@app.post("/api/reorder")
async def reorder(file: UploadFile = File(...), pages: str = Form(...)):
    reader = reader_for(await file.read())
    selected = parse_pages(pages, len(reader.pages))
    if len(selected) != len(reader.pages):
        raise HTTPException(400, "Include every page exactly once when reordering.")
    writer = PdfWriter()
    for page in selected:
        writer.add_page(reader.pages[page])
    return pdf_response(writer, "reordered.pdf")


@app.post("/api/compress")
async def compress(file: UploadFile = File(...), level: str = Form("balanced")):
    data = await file.read()
    reader_for(data)
    presets = {"light": "/prepress", "balanced": "/ebook", "strong": "/screen"}
    if level not in presets:
        raise HTTPException(400, "Choose a valid compression level.")
    gs = shutil.which("gs")
    if not gs:
        raise HTTPException(503, "Ghostscript is not installed. See the README for setup instructions.")
    with tempfile.TemporaryDirectory(prefix="yourpdf-") as directory:
        source = Path(directory) / "input.pdf"
        output = Path(directory) / "output.pdf"
        source.write_bytes(data)
        try:
            result = subprocess.run([gs, "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.4", f"-dPDFSETTINGS={presets[level]}", "-dNOPAUSE", "-dBATCH", "-dSAFER", f"-sOutputFile={output}", str(source)], capture_output=True, timeout=120, check=False)
            if result.returncode != 0 or not output.exists():
                raise HTTPException(422, "Could not compress this PDF.")
            compressed = output.read_bytes()
        except subprocess.TimeoutExpired as exc:
            raise HTTPException(504, "Compression took too long.") from exc
    return Response(compressed, media_type="application/pdf", headers={"Content-Disposition": 'attachment; filename="compressed.pdf"'})
