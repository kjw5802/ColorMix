"""JPEG 그림들로 PDF 만들기 (외부 라이브러리 없이).

화면에서 쪽마다 그림(캔버스)을 그려 JPEG로 넘기면, 쪽 하나에 그림 하나를 꽉 채운 PDF를 만든다.
JPEG은 PDF 안에 그대로 넣을 수 있어서(DCTDecode) 다시 압축하지 않는다.
"""


def jpeg_info(data):
    """JPEG의 (가로 픽셀, 세로 픽셀, 색 성분 수)."""
    if data[:2] != b"\xff\xd8":
        raise ValueError("JPEG 파일이 아닙니다")
    i = 2
    while i + 4 <= len(data):
        if data[i] != 0xFF:
            raise ValueError("JPEG 구조가 올바르지 않습니다")
        marker = data[i + 1]
        if marker == 0xFF:  # 채움 바이트
            i += 1
            continue
        length = int.from_bytes(data[i + 2:i + 4], "big")
        # SOF(그림 크기가 적힌 부분). C4·C8·CC는 다른 용도
        if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
            height = int.from_bytes(data[i + 5:i + 7], "big")
            width = int.from_bytes(data[i + 7:i + 9], "big")
            return width, height, data[i + 9]
        i += 2 + length
    raise ValueError("JPEG 크기를 찾지 못했습니다")


def build_pdf(pages):
    """pages: [(JPEG 바이트, 쪽 너비 pt, 쪽 높이 pt), ...] → PDF 바이트."""
    if not pages:
        raise ValueError("쪽이 없습니다")
    # 객체 번호: 1 문서, 2 쪽 목록, 그 뒤로 쪽마다 [쪽, 그리기 명령, 그림] 3개씩
    n = len(pages)
    kids = " ".join(f"{3 + 3 * i} 0 R" for i in range(n))
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        f"<< /Type /Pages /Kids [{kids}] /Count {n} >>".encode(),
    ]
    for i, (jpeg, w, h) in enumerate(pages):
        content, image = 4 + 3 * i, 5 + 3 * i
        px, py, comps = jpeg_info(jpeg)
        space = "/DeviceGray" if comps == 1 else "/DeviceCMYK" if comps == 4 else "/DeviceRGB"
        objects.append(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {w:.2f} {h:.2f}] "
            f"/Resources << /XObject << /Im0 {image} 0 R >> >> /Contents {content} 0 R >>".encode())
        objects.append(_stream("", f"q {w:.2f} 0 0 {h:.2f} 0 0 cm /Im0 Do Q".encode()))
        objects.append(_stream(
            f"/Type /XObject /Subtype /Image /Width {px} /Height {py} /ColorSpace {space} "
            "/BitsPerComponent 8 /Filter /DCTDecode ", jpeg))

    out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = []
    for num, body in enumerate(objects, 1):
        offsets.append(len(out))
        out += f"{num} 0 obj\n".encode() + body + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    for off in offsets:
        out += f"{off:010d} 00000 n \n".encode()
    out += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return bytes(out)


def _stream(entries, data):
    return f"<< {entries}/Length {len(data)} >>\nstream\n".encode() + data + b"\nendstream"
