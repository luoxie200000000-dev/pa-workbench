#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
权威判定：扫描 JS 源码中每个 `${escapeAttr}` 出现点，
判断它是否处于「模板字面量（反引号 `...`）」内部。
 - 在模板字面量内 → `${...}` 会插值，写法正确，不应改动。
 - 在普通单/双引号串或普通代码里 → `${...}` 是字面文本，写法损坏，应修复。
逐行判定法对「多行模板字面量中、本行不含反引号的行」会误判，
本脚本用真正的词法状态机跟踪反引号深度，避免误判。
"""
import sys

path = sys.argv[1] if len(sys.argv) > 1 else "src/app.js"
src = open(path, encoding="utf-8").read()
n = len(src)

in_template = False
in_sstr = False
in_dstr = False
in_lc = False
in_bc = False

hits = []  # (line, in_template, snippet)
line = 1
i = 0
while i < n:
    c = src[i]
    nxt = src[i + 1] if i + 1 < n else ""

    if in_lc:
        if c == "\n":
            in_lc = False
            line += 1
        i += 1
        continue
    if in_bc:
        if c == "*" and nxt == "/":
            in_bc = False
            i += 2
            continue
        if c == "\n":
            line += 1
        i += 1
        continue
    if in_template:
        if c == "\n":
            line += 1
        if c == "\\":
            i += 2
            continue
        if c == "`":
            in_template = False
            i += 1
            continue
        if c == "$" and nxt == "{":
            rest = src[i:i + 40]
            if rest.startswith("${escapeAttr"):
                snippet = src[i:src.find("\n", i)].strip()[:90]
                hits.append((line, True, snippet))
        i += 1
        continue
    if in_sstr:
        if c == "\n":
            line += 1
        if c == "\\":
            i += 2
            continue
        if c == "'":
            in_sstr = False
            i += 1
            continue
        i += 1
        continue
    if in_dstr:
        if c == "\n":
            line += 1
        if c == "\\":
            i += 2
            continue
        if c == '"':
            in_dstr = False
            i += 1
            continue
        i += 1
        continue
    # NORMAL
    if c == "/":
        if nxt == "/":
            in_lc = True
            i += 2
            continue
        if nxt == "*":
            in_bc = True
            i += 2
            continue
        i += 1
        continue
    if c == "`":
        in_template = True
        i += 1
        continue
    if c == "'":
        in_sstr = True
        i += 1
        continue
    if c == '"':
        in_dstr = True
        i += 1
        continue
    if c == "$" and nxt == "{":
        rest = src[i:i + 40]
        if rest.startswith("${escapeAttr"):
            snippet = src[i:src.find("\n", i)].strip()[:90]
            hits.append((line, False, snippet))
        i += 1
        continue
    if c == "\n":
        line += 1
    i += 1

# 输出分类
in_tpl = [(ln, s) for (ln, t, s) in hits if t]
not_tpl = [(ln, s) for (ln, t, s) in hits if not t]
print("=== 模板字面量内（正确，不应改动）%d 处 ===" % len(in_tpl))
for ln, s in in_tpl:
    print("  L%d  %s" % (ln, s))
print()
print("=== 普通串/代码内（损坏，应修复）%d 处 ===" % len(not_tpl))
for ln, s in not_tpl:
    print("  L%d  %s" % (ln, s))
print()
print("总计 ${escapeAttr 出现: %d" % len(hits))
