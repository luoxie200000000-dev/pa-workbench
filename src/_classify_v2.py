#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
权威判定 v2：带正则字面量识别的 JS 词法状态机。
正确区分：模板字面量(反引号 `...`)、单/双引号串、行/块注释、正则字面量。
对每个 ${escapeAttr 出现点，判定是否处于模板字面量内：
 - 在模板字面量内 → ${...} 会插值，写法正确，不应改动。
 - 在普通串/代码内 → ${...} 是字面文本，写法损坏，应修复。
验证：EOF 须回到 NORMAL；反引号须配平。
"""
import sys

path = sys.argv[1] if len(sys.argv) > 1 else "src/app.js"
src = open(path, encoding="utf-8").read()
n = len(src)

CTRL_KW = {"if", "for", "while", "switch", "with", "catch", "do"}
REGEX_AFTER_KW = {"return", "case", "else", "in", "of", "instanceof", "throw",
                  "typeof", "void", "delete", "new", "default", "yield", "await",
                  "do", "else", "in", "of"}

state = "NORMAL"          # NORMAL, TMPL, SSTR, DSTR, LC, BC, REGEX, CCLASS
prevSig = "other"         # ident num strlit tmplit regexlit rparen rbracket rbrace incdec other
paren_stack = []          # 每个 '(' 之前的关键信息: 'call'/'ctrl'/'group'
in_template = False
btick_open = 0
btick_close = 0
line = 1

# 找所有 ${escapeAttr 位置（先全找出来，后面按状态机判定）
positions = []
p = src.find("${escapeAttr")
while p != -1:
    positions.append(p)
    p = src.find("${escapeAttr", p + 1)

# 状态机主循环，同时记录每个 position 处的 in_template
results = []
pos_set = set(positions)
j = 0
last_was_lbrace_or_bracket = False  # 用于 '[' / '{' 之前的 prevSig

def set_prev(kind):
    global prevSig
    prevSig = kind

while j < n:
    c = src[j]
    nxt = src[j + 1] if j + 1 < n else ""

    if state == "LC":
        if c == "\n":
            state = "NORMAL"; line += 1
        j += 1
        continue

    if state == "BC":
        if c == "*" and nxt == "/":
            state = "NORMAL"; j += 2; continue
        if c == "\n":
            line += 1
        j += 1
        continue

    if state == "TMPL":
        if c == "\n":
            line += 1
        if c == "\\":
            j += 2; continue
        if c == "`":
            state = "NORMAL"; in_template = False; btick_close += 1
            set_prev("tmplit"); j += 1; continue
        j += 1; continue

    if state == "SSTR":
        if c == "\n":
            line += 1
        if c == "\\":
            j += 2; continue
        if c == "'":
            state = "NORMAL"; set_prev("strlit"); j += 1; continue
        j += 1; continue

    if state == "DSTR":
        if c == "\n":
            line += 1
        if c == "\\":
            j += 2; continue
        if c == '"':
            state = "NORMAL"; set_prev("strlit"); j += 1; continue
        j += 1; continue

    if state == "REGEX":
        if c == "\\":
            j += 2; continue
        if c == "[":
            state = "CCLASS"; j += 1; continue
        if c == "\n":
            # 未终止正则（容错）：当作结束
            state = "NORMAL"; set_prev("regexlit"); line += 1; j += 1; continue
        if c == "/":
            # 正则结束，吃 flags
            j += 1
            while j < n and src[j].isalpha():
                j += 1
            state = "NORMAL"; set_prev("regexlit"); continue
        j += 1; continue

    if state == "CCLASS":
        if c == "\\":
            j += 2; continue
        if c == "]":
            state = "REGEX"; j += 1; continue
        j += 1; continue

    # ---- NORMAL ----
    if c == "\n":
        line += 1; j += 1; continue
    if c == "/":
        if nxt == "/":
            state = "LC"; j += 2; continue
        if nxt == "*":
            state = "BC"; j += 2; continue
        # 判断正则 vs 除号
        is_regex = prevSig not in ("ident", "num", "strlit", "tmplit", "regexlit",
                                   "rparen", "rbracket", "rbrace", "incdec")
        if is_regex:
            state = "REGEX"; j += 1; continue
        else:
            set_prev("other"); j += 1; continue
    if c == "`":
        state = "TMPL"; in_template = True; btick_open += 1
        set_prev("other"); j += 1
        # 记录后续命中
        continue
    if c == "'":
        state = "SSTR"; j += 1; continue
    if c == '"':
        state = "DSTR"; j += 1; continue
    if c == "(":
        # 判定 call / ctrl / group
        if prevSig == "ident":
            paren_stack.append("call")
        elif prevSig == "keyword":
            paren_stack.append("ctrl")
        else:
            paren_stack.append("group")
        set_prev("other"); j += 1; continue
    if c == "[":
        set_prev("other"); j += 1; continue
    if c == "{":
        set_prev("other"); j += 1; continue
    if c == ")":
        kind = paren_stack.pop() if paren_stack else "group"
        set_prev("rparen" if kind in ("call", "group") else "other")
        j += 1; continue
    if c == "]":
        set_prev("rbracket"); j += 1; continue
    if c == "}":
        set_prev("rbrace"); j += 1; continue
    if c == ";":
        set_prev("other"); j += 1; continue
    if c == ",":
        set_prev("other"); j += 1; continue
    if c == ":":
        set_prev("other"); j += 1; continue
    if c == "?":
        set_prev("other"); j += 1; continue
    if c == "=":
        set_prev("other"); j += 1; continue
    # 标识符 / 关键字
    if c.isalpha() or c == "_" or c == "$":
        k = j
        while k < n and (src[k].isalnum() or src[k] == "_" or src[k] == "$"):
            k += 1
        word = src[j:k]
        if word in CTRL_KW:
            paren_stack_info = "ctrl"
            set_prev("keyword")
        elif word in REGEX_AFTER_KW:
            set_prev("other")  # 这些之后 / 是正则
        else:
            set_prev("ident")
        j = k; continue
    if c.isdigit():
        # 数字（含 0x, 小数, 指数，粗略）
        k = j
        while k < n and (src[k].isalnum() or src[k] in "._"):
            k += 1
        set_prev("num"); j = k; continue
    # 运算符（含 ++ --）
    if c in "+-*/%&|^~!<>":
        if c in "+-" and nxt == c:
            set_prev("incdec"); j += 2; continue
        set_prev("other"); j += 1; continue
    # 其他字符
    set_prev("other"); j += 1; continue

# 收尾：记录每个 position 的 in_template 状态
# 由于上面是单遍扫描，需要在扫描时记录。改为：再次对 positions 用同样逻辑跑到该点。
# 为简单可靠，直接复用：上面扫描已被 positions 忽略。重新跑一个“跑到 pos”的函数。

def in_template_at(pos):
    st = "NORMAL"; pv = "other"; pstack = []; it = False; ln = 1
    jj = 0
    while jj < pos:
        c = src[jj]; nxt = src[jj + 1] if jj + 1 < n else ""
        if st == "LC":
            if c == "\n": st = "NORMAL"; ln += 1
            jj += 1; continue
        if st == "BC":
            if c == "*" and nxt == "/": st = "NORMAL"; jj += 2; continue
            if c == "\n": ln += 1
            jj += 1; continue
        if st == "TMPL":
            if c == "\n": ln += 1
            if c == "\\": jj += 2; continue
            if c == "`": st = "NORMAL"; it = False; jj += 1; continue
            jj += 1; continue
        if st == "SSTR":
            if c == "\n": ln += 1
            if c == "\\": jj += 2; continue
            if c == "'": st = "NORMAL"; pv = "strlit"; jj += 1; continue
            jj += 1; continue
        if st == "DSTR":
            if c == "\n": ln += 1
            if c == "\\": jj += 2; continue
            if c == '"': st = "NORMAL"; pv = "strlit"; jj += 1; continue
            jj += 1; continue
        if st == "REGEX":
            if c == "\\": jj += 2; continue
            if c == "[": st = "CCLASS"; jj += 1; continue
            if c == "\n": st = "NORMAL"; pv = "regexlit"; ln += 1; jj += 1; continue
            if c == "/":
                jj += 1
                while jj < n and src[jj].isalpha(): jj += 1
                st = "NORMAL"; pv = "regexlit"; continue
            jj += 1; continue
        if st == "CCLASS":
            if c == "\\": jj += 2; continue
            if c == "]": st = "REGEX"; jj += 1; continue
            jj += 1; continue
        # NORMAL
        if c == "\n": ln += 1; jj += 1; continue
        if c == "/":
            if nxt == "/": st = "LC"; jj += 2; continue
            if nxt == "*": st = "BC"; jj += 2; continue
            is_regex = pv not in ("ident", "num", "strlit", "tmplit", "regexlit",
                                  "rparen", "rbracket", "rbrace", "incdec")
            if is_regex: st = "REGEX"; jj += 1; continue
            else: pv = "other"; jj += 1; continue
        if c == "`": st = "TMPL"; it = True; pv = "other"; jj += 1; continue
        if c == "'": st = "SSTR"; jj += 1; continue
        if c == '"': st = "DSTR"; jj += 1; continue
        if c == "(":
            if pv == "ident": pstack.append("call")
            elif pv == "keyword": pstack.append("ctrl")
            else: pstack.append("group")
            pv = "other"; jj += 1; continue
        if c == "[": pv = "other"; jj += 1; continue
        if c == "{": pv = "other"; jj += 1; continue
        if c == ")":
            kind = pstack.pop() if pstack else "group"
            pv = "rparen" if kind in ("call", "group") else "other"; jj += 1; continue
        if c == "]": pv = "rbracket"; jj += 1; continue
        if c == "}": pv = "rbrace"; jj += 1; continue
        if c in ";,?:=": pv = "other"; jj += 1; continue
        if c.isalpha() or c == "_" or c == "$":
            k = jj
            while k < n and (src[k].isalnum() or src[k] == "_" or src[k] == "$"): k += 1
            w = src[jj:k]
            if w in CTRL_KW: pv = "keyword"
            elif w in REGEX_AFTER_KW: pv = "other"
            else: pv = "ident"
            jj = k; continue
        if c.isdigit():
            k = jj
            while k < n and (src[k].isalnum() or src[k] in "._"): k += 1
            pv = "num"; jj = k; continue
        if c in "+-*/%&|^~!<>":
            if c in "+-" and nxt == c: pv = "incdec"; jj += 2; continue
            pv = "other"; jj += 1; continue
        pv = "other"; jj += 1; continue
    return it

results = []
for pos in positions:
    tpl = in_template_at(pos)
    ln = src[:pos].count("\n") + 1
    snippet = src[pos:src.find("\n", pos)].strip()[:80]
    results.append((ln, tpl, snippet))

in_tpl = [(ln, s) for (ln, t, s) in results if t]
not_tpl = [(ln, s) for (ln, t, s) in results if not t]
print("EOF state=%s 反引号开=%d 闭=%d 配平=%s" % (state, btick_open, btick_close, "YES" if btick_open == btick_close and state == "NORMAL" else "NO(!)"))
print("=== 模板字面量内（正确，不应改动）%d 处 ===" % len(in_tpl))
for ln, s in in_tpl:
    print("  L%d  %s" % (ln, s))
print()
print("=== 普通串/代码内（损坏，应修复）%d 处 ===" % len(not_tpl))
for ln, s in not_tpl:
    print("  L%d  %s" % (ln, s))
print()
print("总计 ${escapeAttr 出现: %d" % len(results))
