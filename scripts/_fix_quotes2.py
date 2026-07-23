#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fix embedded ASCII double-quotes inside single-line Python u"..." string literals.
Correctly skips triple-quoted strings and single-quoted strings.
"""
import py_compile


def fix_file(path):
    with open(path, 'rb') as f:
        data = f.read()

    result = bytearray()
    i = 0
    n = len(data)

    while i < n:
        b = data[i]

        # Check for triple-quoted string: u""" or """
        if (b == ord('u') and i+3 < n and
                data[i+1] == ord('"') and data[i+2] == ord('"') and data[i+3] == ord('"')):
            # Triple-quoted string: copy verbatim until closing """
            result.append(b)
            i += 1
            result.append(data[i]); i += 1
            result.append(data[i]); i += 1
            result.append(data[i]); i += 1
            # Find closing """
            while i < n:
                if (data[i] == ord('"') and i+2 < n and
                        data[i+1] == ord('"') and data[i+2] == ord('"')):
                    result.append(data[i]); i += 1
                    result.append(data[i]); i += 1
                    result.append(data[i]); i += 1
                    break
                else:
                    result.append(data[i]); i += 1
            continue

        if data[i:i+3] == b'"""':
            # Plain triple-quoted string
            result += data[i:i+3]
            i += 3
            while i < n:
                if data[i:i+3] == b'"""':
                    result += data[i:i+3]
                    i += 3
                    break
                result.append(data[i]); i += 1
            continue

        # Check for u"..." single-line string
        if (b == ord('u') and i+1 < n and data[i+1] == ord('"')):
            result.append(b); i += 1   # u
            result.append(data[i]); i += 1  # "
            # Read until closing "
            while i < n:
                c = data[i]
                if c == ord('\\') and i+1 < n:
                    result.append(c); i += 1
                    result.append(data[i]); i += 1
                elif c == ord('"'):
                    prev = result[-1] if result else 0
                    if prev > 0x7F:
                        # Embedded " after Chinese byte: escape it
                        result.append(ord('\\'))
                        result.append(ord('"'))
                    else:
                        # End of string
                        result.append(c)
                        i += 1
                        break
                    i += 1
                elif c == ord('\n'):
                    # Unterminated on this line: just close
                    result.append(c); i += 1
                    break
                else:
                    result.append(c); i += 1
            continue

        # Check for plain "..." single-line string (not preceded by u)
        if b == ord('"'):
            result.append(b); i += 1
            while i < n:
                c = data[i]
                if c == ord('\\') and i+1 < n:
                    result.append(c); i += 1
                    result.append(data[i]); i += 1
                elif c == ord('"'):
                    result.append(c); i += 1
                    break
                elif c == ord('\n'):
                    result.append(c); i += 1
                    break
                else:
                    result.append(c); i += 1
            continue

        # Check for '...' single-quoted string
        if b == ord("'"):
            result.append(b); i += 1
            while i < n:
                c = data[i]
                if c == ord('\\') and i+1 < n:
                    result.append(c); i += 1
                    result.append(data[i]); i += 1
                elif c == ord("'"):
                    result.append(c); i += 1
                    break
                elif c == ord('\n'):
                    result.append(c); i += 1
                    break
                else:
                    result.append(c); i += 1
            continue

        result.append(b); i += 1

    with open(path, 'wb') as f:
        f.write(bytes(result))


for fname in ['scripts/gen_design_doc.py', 'scripts/gen_user_manual.py']:
    fix_file(fname)
    try:
        py_compile.compile(fname, doraise=True)
        print(f'{fname}: OK')
    except py_compile.PyCompileError as e:
        print(f'{fname}: ERROR - {e}')
