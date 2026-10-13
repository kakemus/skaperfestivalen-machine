"""Write a copy of a firmware file without comments and docstrings.

uflash only takes scripts under ~20 KB, and machine.py outgrew that with its
comments (2026-10-13). The readable file stays the source; the stripped copy
is only what goes into the .hex:

    python3 firmware/strip.py firmware/machine.py /tmp/x/main.py
    uflash /tmp/x/main.py <folder>      # then copy the hex to firmware/machine.hex
"""
import io, sys, tokenize

src = open(sys.argv[1]).read()
out, prev = [], tokenize.INDENT
for tok in tokenize.generate_tokens(io.StringIO(src).readline):
    if tok.type == tokenize.COMMENT:
        continue
    # a string standing alone as a statement = a docstring
    if tok.type == tokenize.STRING and prev in (tokenize.INDENT, tokenize.NEWLINE, tokenize.DEDENT):
        tok = tok._replace(string="0")          # keeps the block non-empty
    out.append(tok)
    if tok.type not in (tokenize.NL, tokenize.COMMENT):
        prev = tok.type
text = tokenize.untokenize(out)
lines = [l.rstrip() for l in text.split("\n")]
open(sys.argv[2], "w").write("\n".join(l for l in lines if l.strip()) + "\n")
