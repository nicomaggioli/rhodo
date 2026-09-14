"""Dependency-free checks for a deployable static website."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import re
ROOT=Path(__file__).resolve().parents[1]/"public"
class Page(HTMLParser):
 def __init__(self,path):
  super().__init__();self.path=path;self.ids=[];self.refs=[];self.h1=0;self.errors=[];self.feed(path.read_text())
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a:self.ids.append(a['id'])
  if tag=='h1':self.h1+=1
  for k in ['href','src','poster']:
   if a.get(k):self.refs.append(a[k])
  if tag=='img' and 'alt' not in a:self.errors.append('Image missing alt attribute')
  if tag=='html' and a.get('lang')!='en':self.errors.append('Missing document language')
  if tag=='input' and a.get('type')=='email' and 'required' not in a:self.errors.append('Email should be required')
pages={p.name:Page(p) for p in ROOT.glob('*.html')};errors=[];count=0
for name,page in pages.items():
 errors.extend(f'{name}: {e}' for e in page.errors)
 if page.h1!=1:errors.append(f'{name}: expected one h1, got {page.h1}')
 if len(page.ids)!=len(set(page.ids)):errors.append(f'{name}: duplicate IDs')
 for ref in page.refs:
  if ref.startswith(('http:','https:','data:','mailto:')):
   if '.example' in ref:errors.append(f'{name}: placeholder destination {ref}')
   continue
  u=urlsplit(ref);target=ROOT/unquote(u.path) if u.path else page.path;count+=1
  if target.name=='rhodo-demo.mp4' and u.query.startswith('content='):
   version=u.query.split('=',1)[1]
   if not (ROOT/'assets/demo-stream'/version/'manifest.json').is_file():errors.append(f'{name}: missing video manifest')
   continue
  if not target.is_file():errors.append(f'{name}: missing {ref}');continue
  if u.fragment and target.suffix=='.html' and target.name in pages and unquote(u.fragment) not in pages[target.name].ids:errors.append(f'{name}: broken anchor {ref}')
for css in ROOT.glob('*.css'):
 for ref in re.findall(r"url\(['\"]?([^)'\"]+)",css.read_text()):
  if ref.startswith(('data:','https:','http:')):continue
  if not (css.parent/unquote(urlsplit(ref).path)).is_file():errors.append(f'{css.name}: missing {ref}')
for asset in ['assets/demo.vtt']:
 if not (ROOT/asset).is_file() or (ROOT/asset).stat().st_size<20:errors.append(f'Missing/empty {asset}')
if not (ROOT/'assets/demo.vtt').read_text().startswith('WEBVTT'):errors.append('Invalid caption header')
if errors:raise SystemExit('\n'.join(errors))
print(f'PASS: {len(pages)} pages, {count} local references, unique IDs, internal anchors, font assets, image labels and media assets.')
