import re

import pytest

import pdfmaker


def fake_jpeg(width, height, comps=3):
    """크기 정보만 담은 최소 JPEG 머리 (APP0 + SOF0). PDF 구조 확인용."""
    app0 = b"\xff\xe0" + (16).to_bytes(2, "big") + b"JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    sof = b"\xff\xc0" + (8 + 3 * comps).to_bytes(2, "big") + b"\x08" + height.to_bytes(2, "big") + width.to_bytes(2, "big") + bytes([comps]) + b"\x00" * (3 * comps)
    return b"\xff\xd8" + app0 + sof + b"\xff\xd9"


def test_jpeg_info_reads_size_after_other_segments():
    assert pdfmaker.jpeg_info(fake_jpeg(1600, 2264)) == (1600, 2264, 3)


def test_jpeg_info_rejects_other_files():
    with pytest.raises(ValueError):
        pdfmaker.jpeg_info(b"\x89PNG\r\n\x1a\n")


def test_build_pdf_structure():
    pages = [(fake_jpeg(1240, 1754), 595.28, 841.89), (fake_jpeg(100, 50, comps=1), 200, 100)]
    pdf = pdfmaker.build_pdf(pages)
    assert pdf.startswith(b"%PDF-1.4") and pdf.rstrip().endswith(b"%%EOF")
    assert pdf.count(b"/Type /Page ") == 2 and b"/Count 2" in pdf
    assert b"/MediaBox [0 0 595.28 841.89]" in pdf and b"/MediaBox [0 0 200.00 100.00]" in pdf
    assert b"/Width 1240 /Height 1754 /ColorSpace /DeviceRGB" in pdf
    assert b"/ColorSpace /DeviceGray" in pdf
    # 상호 참조표의 위치가 실제 객체 위치와 맞아야 PDF 뷰어가 연다
    startxref = int(re.search(rb"startxref\n(\d+)", pdf).group(1))
    assert pdf[startxref:startxref + 4] == b"xref"
    offsets = [int(m) for m in re.findall(rb"(\d{10}) 00000 n ", pdf)]
    assert len(offsets) == 2 + 3 * len(pages)
    for num, off in enumerate(offsets, 1):
        assert pdf[off:].startswith(f"{num} 0 obj".encode())


def test_build_pdf_stream_lengths_match():
    jpeg = fake_jpeg(10, 10)
    pdf = pdfmaker.build_pdf([(jpeg, 10, 10)])
    for m in re.finditer(rb"/Length (\d+) >>\nstream\n", pdf):
        end = m.end() + int(m.group(1))
        assert pdf[end:end + 10] == b"\nendstream"


def test_build_pdf_needs_pages():
    with pytest.raises(ValueError):
        pdfmaker.build_pdf([])
