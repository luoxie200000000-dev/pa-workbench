#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""逐点权威分类：对源码中每个 ${escapeAttr 出现点，用状态机跑到其精确字节位置，
判定当时是否处于模板字面量（反引号 `...`）内。行号用 count('\n') 精确计算，绕开行号 bug。"""
import sys

path = sys.argv[1] if len(sys.argv) > 1 else "src/app.js"
src = open(path, encoding="utf-8").read()
n = len(src)

# 找所有 ${escapeAttr 的精确位置
positions = []
i = src.find("${escapeAttr")
while i != -1:
    positions.append(i)
    i = src.find("${escapeAttr", i + 1)

def in_template_at(pos):
    """从文件头跑到 pos，返回到达 pos 时的 in_template 状态。"""
    in_t = False
    in_s = False
    in_d = False
    in_lc = False
    in_bc = False
    j = 0
    while j < pos:
        c = src[j]
        nxt = src[j + 1] if j + 1 < n else ""
        if in_lc:
            if c == "\n":
                in_lc = False
            j += 1
            continue
        if in_bc:
            if c == "*" and nxt == "/":
                in_bc = False
                j += 2
                continue
            j += 1
            continue
        if in_t:
            if c == "\\":
                j += 2
                continue
            if c == "`":
                in_t = False
                j += 1
                continue
            j += 1
            continue
        if in_s:
            if c == "\\":
                j += 2
                continue
            if c == "'":
                in_s = False
                j += 1
                continue
            j += 1
            continue
        if in_d:
            if c == "\\":
                j += 2
                continue
            if c == '"':
                in_d = False
                j += 1
                continue
            j += 1
            continue
        if c == "/":
            if nxt == "//":
                in_lc = True
                j += 2
                continue
            if nxt == "*":
                in_bc = True
                j += 2
                continue
            j += 1
            continue
        if c == "`":
            in_t = True
            j += 1
            continue
        if c == "'":
            in_s = True
            j += 1
            continue
        if c == '"':
            in_d = True
            j += 1
            continue
        j += 1
    return in_t

results = []
for pos in positions:
    tpl = in_template_at(pos)
    line = src[:pos].count("\n") + 1
    snippet = src[pos:src.find("\n", pos)].strip()[:80]
    results.append((line, tpl, snippet))

in_tpl = [(ln, s) for (ln, t, s) in results if t]
not_tpl = [(ln, s) for (ln, t, s) in results if not t]
print("=== 模板字面量内（正确，不应改动）%d 处 ===" % len(in_tpl))
for ln, s in in_tpl:
    print("  L%d  %s" % (ln, s))
print()
print("=== 普通串/代码内（损坏，应修复）%d 处 ===" % len(not_tpl))
for ln, s in not_tpl:
    print("  L%d  %s" % (ln, s))
print()
print("总计 ${escapeAttr 出现: %d" % len(results))
