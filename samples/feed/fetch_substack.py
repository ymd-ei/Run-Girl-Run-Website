#!/usr/bin/env python3
"""Pull a Substack's posts into the feed sample's post format.

First draft of the daily job's Substack step (see the RGR Social Feed spec).
Writes samples/feed/live/substack.json, which the sample page picks up in place
of its mock Substack posts. That folder is git-ignored: test runs may pull
someone else's articles, which must never deploy.

    python3 fetch_substack.py animationobsessive --limit 1 --free-only --assume-tag rgr

Uses Substack's archive endpoint (unofficial, but it carries post tags, the
free/paid flag and the whole history). The public RSS feed has none of those
and stops at the latest 20 posts.
"""
import argparse
import json
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

UA = {'User-Agent': 'Mozilla/5.0 (RGR feed sample)'}
OUT = Path(__file__).parent / 'live' / 'substack.json'
HASHTAG = re.compile(r'(?:^|\s)#([\w-]+)')


def get_json(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
            return json.load(r)
    except urllib.error.URLError as e:
        # python.org installs on macOS often lack root certificates; curl uses the system ones
        if 'CERTIFICATE_VERIFY_FAILED' not in str(e):
            raise
        out = subprocess.run(['curl', '-sfL', '-A', UA['User-Agent'], url], capture_output=True, check=True)
        return json.loads(out.stdout)


def base_url(pub):
    pub = pub.strip().rstrip('/')
    if pub.startswith('http'):
        return pub
    return f'https://{pub}.substack.com'


def fetch_archive(base, limit, free_only):
    posts, offset = [], 0
    while len(posts) < limit:
        page = get_json(f'{base}/api/v1/archive?sort=new&offset={offset}&limit=50')
        if not page:
            break
        posts += [p for p in page if not free_only or p.get('audience') == 'everyone']
        offset += len(page)
    # The archive listing has no article bodies; each post's own endpoint does
    return [get_json(f"{base}/api/v1/posts/{p['slug']}") for p in posts[:limit]]


def tags_for(p, assume):
    """Substack's own post tags, plus any #hashtags written in the title, subtitle or body text."""
    tags = [t.get('name', '') for t in (p.get('postTags') or [])]
    text = ' '.join(filter(None, [p.get('title'), p.get('subtitle'), p.get('truncated_body_text')]))
    tags += HASHTAG.findall(text)
    tags += HASHTAG.findall(re.sub(r'<[^>]+>', ' ', p.get('body_html') or ''))
    tags = [t.strip().lstrip('#').lower().replace(' ', '-') for t in tags if t.strip()]
    if assume:
        tags.append(assume.lower())
    return list(dict.fromkeys(tags))


def to_post(p, assume):
    paid = p.get('audience') not in (None, 'everyone')
    cover = p.get('cover_image')
    return {
        'id': f"sub:{p['slug']}",
        'source': 'substack',
        'url': p.get('canonical_url'),
        'date': p.get('post_date'),
        'title': p.get('title') or '',
        'text': p.get('subtitle') or p.get('description') or '',
        'html': p.get('body_html') or '',
        'paid': paid,  # paid posts only come through as the free preview
        'tags': tags_for(p, assume),
        'media': [{'type': 'image', 'url': cover, 'alt': p.get('title') or ''}] if cover else [],
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('publication', help='Substack name (e.g. animationobsessive) or full URL')
    ap.add_argument('--limit', type=int, default=20)
    ap.add_argument('--free-only', action='store_true', help='skip paid posts (they only come through as a preview)')
    ap.add_argument('--assume-tag', help='testing only: pretend every post carries this tag, e.g. rgr or rgr-2d')
    a = ap.parse_args()

    base = base_url(a.publication)
    try:
        raw = fetch_archive(base, a.limit, a.free_only)
    except Exception as e:
        sys.exit(f'Could not read {base}: {e}')
    posts = [to_post(p, a.assume_tag) for p in raw]

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps({'publication': base, 'posts': posts}, indent=2, ensure_ascii=False))
    tagged = sum(any(t == 'rgr' or t.startswith('rgr-') for t in p['tags']) for p in posts)
    paid = sum(p['paid'] for p in posts)
    print(f'{len(posts)} posts from {base} -> {OUT.relative_to(Path.cwd()) if OUT.is_relative_to(Path.cwd()) else OUT}')
    print(f'{tagged} carry an #rgr tag, {paid} are paid (preview only)')


if __name__ == '__main__':
    main()
