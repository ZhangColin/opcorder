#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fix embedded ASCII double-quotes inside Python u"..." string literals.
The write tool converts Chinese curly quotes to ASCII " which breaks strings.
Strategy: scan each line; inside a u"..." literal, escape any " preceded by
a non-ASCII byte (i.e., part of Chinese text).
"""
import sys

def fix_file(path):
    with open(path, 'rb') as f:
        data = f.read()

    lines = data.split(b'\n')
    out_lines = []

    for line in lines:
        out_lines.append(fix_line(line))

    with open(path, 'wb') as f:
        f.write(b'\n'.join(out_lines))

def fix_line(line):
    """
    Walk through the line bytes.
    Track when we're inside a u"..." string.
    When inside, if we see 0x22 (ASCII ") preceded by a byte > 0x7F,
    escape it as backslash + 0x22.
    """
    result = bytearray()
    i = 0
    n = len(line)
    in_str = False

    while i < n:
        b = line[i]

        if not in_str:
            # Detect start of u"..." string
            if b == ord('u') and i + 1 < n and line[i+1] == ord('"'):
                result.append(b)     # u
                i += 1
                result.append(line[i])  # "
                i += 1
                in_str = True
            elif b == ord('"'):
                # Could be start of plain "..." string
                result.append(b)
                i += 1
                in_str = True
            else:
                result.append(b)
                i += 1

        else:  # inside string
            if b == ord('\\') and i + 1 < n:
                # escape sequence: pass through both bytes
                result.append(b)
                i += 1
                result.append(line[i])
                i += 1
            elif b == ord('"'):
                # Check the last byte added to result
                # If the last byte is > 0x7F it's part of a multibyte
                # (Chinese) sequence => this " is an embedded quote
                prev_byte = result[-1] if result else 0
                if prev_byte > 0x7F:
                    # Embedded quote inside Chinese text: escape it
                    result.append(ord('\\'))
                    result.append(ord('"'))
                else:
                    # End of string
                    result.append(b)
                    in_str = False
                i += 1
            else:
                result.append(b)
                i += 1

    return bytes(result)

import py_compile
for fname in ['scripts/gen_design_doc.py', 'scripts/gen_user_manual.py']:
    fix_file(fname)
    try:
        py_compile.compile(fname, doraise=True)
        print(f'{fname}: OK')
    except py_compile.PyCompileError as e:
        print(f'{fname}: STILL HAS ERROR - {e}')
