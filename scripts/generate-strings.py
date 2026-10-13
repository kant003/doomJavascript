"""Convert the original English object-like string/character macros literally."""
from pathlib import Path
import ast,json,re
root=Path(__file__).resolve().parent.parent
source=(root/'original/linuxdoom-1.10/d_englsh.h').read_text()
source=source.replace('\\\n','')
source=re.sub(r'/\*.*?\*/|//[^\n]*','',source,flags=re.S)
values={}
for name,expression in re.findall(r'^#define\s+(\w+)[ \t]+([^\n]+)',source,re.M):
 tokens=re.findall(r'"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|[A-Za-z_]\w*|\d+',expression)
 remainder=expression
 for token in tokens: remainder=remainder.replace(token,'',1)
 assert not remainder.strip(),expression
 parts=[]
 for token in tokens:
  if token.startswith('"'): parts.append(ast.literal_eval(token))
  elif token.startswith("'"): parts.append(ord(ast.literal_eval(token)))
  elif token.isdigit(): parts.append(int(token))
  else: parts.append(values[token])
 values[name]=''.join(parts) if all(isinstance(p,str) for p in parts) else parts[0]
 assert len(parts)==1 or isinstance(values[name],str)
out='// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.\n// Literal macros from d_englsh.h. Regenerate with scripts/generate-strings.py.\n'
out+=''.join(f'export const {name} = {json.dumps(value,ensure_ascii=False)};\n' for name,value in values.items())
(root/'src/linuxdoom-1.10/d_englsh.h.ts').write_text(out)
print(f'{len(values)} English macros converted')
