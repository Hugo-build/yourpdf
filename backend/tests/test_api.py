from io import BytesIO
import shutil
import zipfile

import pytest
from fastapi.testclient import TestClient
from pypdf import PdfReader, PdfWriter

from backend.main import app

client = TestClient(app)


def make_pdf(widths=(100, 200, 300), encrypted=False):
    writer = PdfWriter()
    for width in widths:
        writer.add_blank_page(width=width, height=400)
    if encrypted:
        writer.encrypt("secret")
    output = BytesIO()
    writer.write(output)
    return output.getvalue()


def upload(data=None):
    return ("document.pdf", data if data is not None else make_pdf(), "application/pdf")


def widths(data):
    return [int(page.mediabox.width) for page in PdfReader(BytesIO(data)).pages]


def test_merge_preserves_file_order():
    response = client.post('/api/merge', files=[('files', upload(make_pdf((200,)))), ('files', upload(make_pdf((100, 300))))])
    assert response.status_code == 200
    assert widths(response.content) == [200, 100, 300]


def test_split_returns_ranges_as_zip():
    response = client.post('/api/split', files={'file': upload()}, data={'ranges': '1-2, 3'})
    assert response.status_code == 200
    with zipfile.ZipFile(BytesIO(response.content)) as archive:
        assert archive.namelist() == ['part-1.pdf', 'part-2.pdf']
        assert widths(archive.read('part-1.pdf')) == [100, 200]
        assert widths(archive.read('part-2.pdf')) == [300]


def test_rotate_and_delete_and_reorder():
    rotated = client.post('/api/rotate', files={'file': upload()}, data={'pages': '2-3', 'angle': '90'})
    assert rotated.status_code == 200
    assert [page.rotation for page in PdfReader(BytesIO(rotated.content)).pages] == [0, 90, 90]
    deleted = client.post('/api/delete', files={'file': upload()}, data={'pages': '2'})
    assert widths(deleted.content) == [100, 300]
    reordered = client.post('/api/reorder', files={'file': upload()}, data={'pages': '3, 1, 2'})
    assert widths(reordered.content) == [300, 100, 200]


@pytest.mark.skipif(not shutil.which('gs'), reason='Ghostscript is not installed')
@pytest.mark.parametrize('level', ['light', 'balanced', 'strong'])
def test_compress(level):
    response = client.post('/api/compress', files={'file': upload()}, data={'level': level})
    assert response.status_code == 200
    assert widths(response.content) == [100, 200, 300]


@pytest.mark.parametrize('path,data', [('/split', {'ranges': '1-4'}), ('/split', {'ranges': '1,1'}), ('/rotate', {'pages': '0', 'angle': '90'}), ('/rotate', {'pages': '1', 'angle': '45'}), ('/delete', {'pages': '1-3'}), ('/reorder', {'pages': '1,2'}), ('/reorder', {'pages': '1,1,2'})])
def test_invalid_selections(path, data):
    response = client.post('/api' + path, files={'file': upload()}, data=data)
    assert response.status_code == 400
    assert response.json()['detail']


@pytest.mark.parametrize('data,expected', [(b'not a pdf', 'Invalid'), (make_pdf(encrypted=True), 'Encrypted')])
def test_bad_documents(data, expected):
    response = client.post('/api/compress', files={'file': upload(data)})
    assert response.status_code == 400
    assert expected in response.json()['detail']


def test_merge_requires_two_files():
    assert client.post('/api/merge', files={'files': upload()}).status_code == 400
