# -*- coding: utf-8 -*-
"""提取 docx 全部文本(段落+表格), 仅用标准库。用法: python -I extract_docx.py <docx路径> <输出txt>"""
import sys, zipfile
import xml.etree.ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

def para_text(p):
    parts = []
    for node in p.iter():
        tag = node.tag
        if tag == W + "t":
            parts.append(node.text or "")
        elif tag == W + "br" or tag == W + "cr":
            parts.append("\n")
        elif tag == W + "tab":
            parts.append("\t")
    return "".join(parts)

def cell_text(tc):
    lines = []
    for child in tc:
        if child.tag == W + "p":
            lines.append(para_text(child))
    return "\n".join(lines).strip()

def main():
    sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) < 3:
        print("usage: extract_docx.py <docx> <out>"); return 1
    docx_path, out_path = sys.argv[1], sys.argv[2]
    with zipfile.ZipFile(docx_path) as z:
        xml = z.read("word/document.xml")
    root = ET.fromstring(xml)
    body = root.find(W + "body")
    out = []
    for child in body:
        if child.tag == W + "p":
            t = para_text(child).strip()
            if t:
                out.append(t)
        elif child.tag == W + "tbl":
            for tr in child.iter(W + "tr"):
                cells = [cell_text(tc).replace("\n", "⏎") for tc in tr.findall(W + "tc")]
                out.append(" | ".join(cells))
            out.append("----TABLE-END----")
    text = "\n".join(out)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(text)
    print("chars:", len(text), "lines:", len(out))
    return 0

if __name__ == "__main__":
    sys.exit(main())
