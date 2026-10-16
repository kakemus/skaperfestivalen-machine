"""Write a packed copy of a firmware file: no comments, no docstrings, 1-space
indentation and only the spaces Python needs (`a=b+1`, not `a = b + 1`).

    python3 firmware/strip.py firmware/machine.py <out.py> [--rename]

The readable machine.py stays the source; the packed copy is what goes onto
the micro:bit (firmware/upload.py cuts it into pieces). Why so tight: the
board's file storage holds only ~18 KB, and the light-trace version no longer
fit ("OSError: 28" = no space left, 2026-10-16) — before that, the board ran
out of memory parsing it in one go, and before that uflash's 20 KB limit.

Safety: the packed code is parsed back and must have exactly the same syntax
tree as the original (docstrings aside, which become 0) — otherwise this
script stops instead of writing something subtly different.

--rename (what upload.py uses, 2026-10-16): also renames every name the
program defines itself (functions, variables, parameters — never the
micro:bit's own names, builtins or attributes) to 1–2 letters, most-used
first: ~3 KB less, which the board's ~16 KB file store needed. The syntax
tree must then match the original's with the same renaming applied, and the
mapping is written next to the output (.names) to decode error messages.
"""
import ast
import io
import sys
import tokenize

SKIP = (tokenize.COMMENT, tokenize.NL, tokenize.ENCODING, tokenize.ENDMARKER)


def wordy(s, at_end):
    """Does the token end (or start) with a letter, digit or underscore?"""
    c = s[-1] if at_end else s[0]
    return c.isalnum() or c == "_"


def pack(src):
    lines, line, level = [], [], 0
    prev_type = tokenize.NEWLINE        # what the last kept token was (to spot docstrings)
    last = ""                           # text of the last token on the current line
    for tok in tokenize.generate_tokens(io.StringIO(src).readline):
        if tok.type in SKIP:
            continue
        if tok.type == tokenize.INDENT:
            level += 1
            prev_type = tok.type
            continue
        if tok.type == tokenize.DEDENT:
            level -= 1
            prev_type = tok.type
            continue
        if tok.type == tokenize.NEWLINE:
            if line:
                lines.append(" " * line[0] + "".join(line[1:]))
            line, last = [], ""
            prev_type = tok.type
            continue
        s = tok.string
        # a string standing alone as a statement = a docstring: keep the block non-empty
        if tok.type == tokenize.STRING and prev_type in (tokenize.INDENT, tokenize.NEWLINE, tokenize.DEDENT):
            s = "0"
        if not line:
            line = [level]
        elif last and wordy(last, True) and wordy(s, False):
            line.append(" ")            # `if x`, `return 1`, `x in y` need their space
        line.append(s)
        last = s
        prev_type = tok.type
    if line:
        lines.append(" " * line[0] + "".join(line[1:]))
    return "\n".join(lines) + "\n"


def same_tree(original, packed):
    """The packed code must parse to the same syntax tree (docstrings → 0)."""
    class Doc0(ast.NodeTransformer):
        def visit_Expr(self, node):
            if isinstance(node.value, ast.Constant) and isinstance(node.value.value, str):
                return ast.Expr(value=ast.Constant(value=0))
            return node
    a = ast.dump(Doc0().visit(ast.parse(original)), include_attributes=False)
    b = ast.dump(ast.parse(packed), include_attributes=False)
    return a == b


def defined_names(tree):
    """Names the program itself defines (so renaming them can't touch the
    micro:bit's names or builtins), with how often each is used."""
    import collections
    defined, uses = set(), collections.Counter()
    for n in ast.walk(tree):
        if isinstance(n, ast.FunctionDef):
            defined.add(n.name)
            uses[n.name] += 1
        elif isinstance(n, ast.arg):
            defined.add(n.arg)
            uses[n.arg] += 1
        elif isinstance(n, ast.Name):
            uses[n.id] += 1
            if isinstance(n.ctx, ast.Store):
                defined.add(n.id)
        elif isinstance(n, ast.Global):
            defined.update(n.names)
        elif isinstance(n, ast.ExceptHandler) and n.name:
            defined.add(n.name)
            uses[n.name] += 1
        elif isinstance(n, ast.keyword) and n.arg:
            raise SystemExit("strip.py --rename: keyword arguments (%s=) aren't handled — rename by hand" % n.arg)
    return defined, uses


def renamed(tree, mapping):
    class R(ast.NodeTransformer):
        def visit_Name(self, n):
            n.id = mapping.get(n.id, n.id)
            return n

        def visit_FunctionDef(self, n):
            n.name = mapping.get(n.name, n.name)
            self.generic_visit(n)
            return n

        def visit_arg(self, n):
            n.arg = mapping.get(n.arg, n.arg)
            return n

        def visit_Global(self, n):
            n.names = [mapping.get(x, x) for x in n.names]
            return n

        def visit_ExceptHandler(self, n):
            if n.name:
                n.name = mapping.get(n.name, n.name)
            self.generic_visit(n)
            return n
    return R().visit(tree)


def short_names(src):
    """Rename the program's own names to 1–2 letters; returns (new source, mapping)."""
    import builtins
    import itertools
    import keyword
    import string
    tree = ast.parse(src)
    defined, uses = defined_names(tree)
    taken = set(uses) - defined                      # names from outside (micro:bit, builtins) must stay free
    taken |= set(keyword.kwlist) | set(dir(builtins))
    letters = string.ascii_letters
    pool = (a + b for a, b in itertools.chain(((c, "") for c in letters), itertools.product(letters, letters + string.digits)))
    mapping = {}
    for name in sorted((n for n in defined if len(n) > 1), key=lambda n: -uses[n] * len(n)):
        new = next(c for c in pool if c not in taken and c not in defined)
        if len(new) < len(name):
            mapping[name] = new
    return ast.unparse(renamed(tree, mapping)), mapping


if __name__ == "__main__":
    src = open(sys.argv[1]).read()
    if "--rename" in sys.argv:
        # strip docstrings first so they don't bloat the unparsed source, then rename
        class Doc0(ast.NodeTransformer):
            def visit_Expr(self, node):
                if isinstance(node.value, ast.Constant) and isinstance(node.value.value, str):
                    return ast.Expr(value=ast.Constant(value=0))
                return node
        base = ast.unparse(Doc0().visit(ast.parse(src)))
        short, mapping = short_names(base)
        out = pack(short)
        # check: the original, with the same renaming applied, must give the same tree
        expect = ast.dump(renamed(ast.parse(base), mapping), include_attributes=False)
        if ast.dump(ast.parse(out), include_attributes=False) != expect:
            sys.exit("strip.py: the packed code differs from the original — not written.")
        with open(sys.argv[2] + ".names", "w") as f:
            f.write("\n".join("%s = %s" % (v, k) for k, v in sorted(mapping.items(), key=lambda kv: kv[1])) + "\n")
    else:
        out = pack(src)
        if not same_tree(src, out):
            sys.exit("strip.py: the packed code differs from the original — not written.")
    open(sys.argv[2], "w").write(out)
