/**
 * Block <-> Markdown conversion (shared)
 *
 * Ported from the v1 editor so block content can round-trip through a portable
 * markdown dialect (headings, quotes, images, plus fenced :::blocks for the
 * richer types). Used by editor v3; v1 keeps its own inline copy.
 */

import { uid } from '../../utils/validation.js';

// ── HTML inline -> markdown inline ──
function markdownInlineFromHtml(text) {
  return String(text || '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<b>(.*?)<\/b>/gi, '**$1**')
    .replace(/<i>(.*?)<\/i>/gi, '*$1*')
    .replace(/<u>(.*?)<\/u>/gi, '$1')
    .replace(/<rgr>(.*?)<\/rgr>/gi, '`$1`')
    .replace(/<[^>]+>/g, '')
    .trim();
}

// ── markdown inline -> HTML inline ──
function inlineFormat(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\*([^*]+)\*/g, '<i>$1</i>')
    .replace(/`([^`]+)`/g, '<b>$1</b>');
}

export function blocksToMarkdown(blocks) {
  const out = [];
  (blocks || []).forEach(b => {
    if (b.type === 'text-lg') { out.push(`# ${markdownInlineFromHtml(b.content)}`); return; }
    if (b.type === 'text-sm') { out.push(`### ${markdownInlineFromHtml(b.content)}`); return; }
    if (b.type === 'text-md') { out.push(markdownInlineFromHtml(b.content)); return; }
    if (b.type === 'quote') {
      const lines = markdownInlineFromHtml(b.content).split('\n').filter(Boolean);
      out.push(lines.map(l => `> ${l}`).join('\n'));
      return;
    }
    if (b.type === 'image') { out.push(`![${b.alt || ''}](${b.src || ''})`); return; }
    if (b.type === 'alpha-art') {
      out.push(':::alpha');
      out.push(`src: ${(b.src || '').trim()}`);
      if ((b.alt || '').trim()) out.push(`alt: ${(b.alt || '').trim()}`);
      out.push(`color: ${(b.color || '#5e30eb').trim()}`);
      out.push(`bg: ${(b.bg || 'transparent').trim()}`);
      out.push(`scale: ${Number.isFinite(Number(b.scale)) ? Number(b.scale) : 1}`);
      out.push(`fit: ${((b.fit || 'contain') === 'cover' ? 'cover' : 'contain')}`);
      out.push(`ratio: ${(b.ratio || '16/9').trim()}`);
      out.push(':::');
      return;
    }
    if (b.type === 'video') { out.push(`!video(${b.src || ''})`); return; }
    if (b.type === 'stats') {
      out.push((b.items || []).map(s => `${s.num || ''} | ${s.label || ''}`).join('\n'));
      return;
    }
    if (b.type === 'skills') {
      out.push((b.items || []).map(s => `- ${s.name || ''} | ${s.pct || 0}%`).join('\n'));
      return;
    }
    if (b.type === 'callout') {
      out.push(`!!! ${(b.tone || 'note')} ${markdownInlineFromHtml(b.title || '').trim()}`.trim());
      if ((b.content || '').trim()) out.push(markdownInlineFromHtml(b.content));
      return;
    }
    if (b.type === 'cta') {
      out.push(':::cta');
      out.push(`${markdownInlineFromHtml(b.headline || '').trim()} | ${markdownInlineFromHtml(b.body || '').trim()} | ${(b.buttonLabel || '').trim()} | ${(b.buttonUrl || '').trim()}`);
      out.push(':::');
      return;
    }
    if (b.type === 'beforeafter') {
      out.push(':::beforeafter');
      out.push(`before: ![${b.beforeAlt || ''}](${b.beforeSrc || ''})`);
      out.push(`after: ![${b.afterAlt || ''}](${b.afterSrc || ''})`);
      if ((b.caption || '').trim()) out.push(`caption: ${markdownInlineFromHtml(b.caption).trim()}`);
      out.push(':::');
      return;
    }
    if (b.type === 'faq') {
      out.push(':::faq');
      (b.items || []).forEach(item => {
        out.push(`- ${(item.question || '').trim()} | ${markdownInlineFromHtml(item.answer || '').trim()}${item.open ? ' | open' : ''}`);
      });
      out.push(':::');
      return;
    }
    if (b.type === 'gallery') {
      out.push(`:::gallery cols=${b.columns || 2}`);
      (b.items || []).forEach(it => {
        const cap = (it.caption || '').trim();
        out.push(`- ![${it.alt || ''}](${it.src || ''})${cap ? ' | ' + cap : ''}`);
      });
      out.push(':::');
      return;
    }
    if (b.type === 'process') {
      out.push(':::process');
      (b.steps || []).forEach((s, idx) => {
        const date = (s.date || '').trim();
        const title = (s.title || '').trim();
        const content = markdownInlineFromHtml(s.content || '').trim();
        const img = (s.image || '').trim();
        const alt = (s.imageAlt || '').trim();
        const lead = date ? `@${date} :: ${title}` : title;
        if (img) out.push(`${idx + 1}. ${lead} | ${content} | ![${alt}](${img})`.trim());
        else out.push(`${idx + 1}. ${lead} | ${content}`.trim());
      });
      out.push(':::');
      return;
    }
    if (b.type === 'divider') { out.push('---'); }
  });
  return out.join('\n\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

export function parseMarkdownToBlocks(md) {
  const lines = String(md || '').split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trimEnd();

    if (!line.trim()) { i++; continue; }

    const galleryStart = line.match(/^:::gallery(?:\s+cols=(2|3))?\s*$/i);
    if (galleryStart) {
      const cols = parseInt(galleryStart[1] || '2', 10);
      const items = [];
      i++;
      while (i < lines.length && !/^:::\s*$/.test(lines[i].trim())) {
        const gm = lines[i].trim().match(/^-\s*!\[([^\]]*)\]\(([^)]+)\)(?:\s*\|\s*(.+))?$/);
        if (gm) items.push({ alt: gm[1] || '', src: gm[2] || '', caption: (gm[3] || '').trim() });
        i++;
      }
      if (i < lines.length && /^:::\s*$/.test(lines[i].trim())) i++;
      blocks.push({ id: uid(), type: 'gallery', columns: (cols === 3 ? 3 : 2), items: items.length ? items : [{ src: '', alt: '', caption: '' }] });
      continue;
    }

    if (/^:::alpha\s*$/i.test(line)) {
      const block = { id: uid(), type: 'alpha-art', src: '', alt: '', color: '#5e30eb', bg: 'transparent', scale: 1, fit: 'contain', ratio: '16/9' };
      i++;
      while (i < lines.length && !/^:::\s*$/.test(lines[i].trim())) {
        const pair = lines[i].trim().match(/^([a-z]+)\s*:\s*(.+)$/i);
        if (pair) {
          const key = pair[1].toLowerCase();
          const value = pair[2].trim();
          if (key === 'src') block.src = value;
          else if (key === 'alt') block.alt = value;
          else if (key === 'color') block.color = value;
          else if (key === 'bg') block.bg = value;
          else if (key === 'scale') { const p = parseFloat(value); block.scale = Number.isFinite(p) ? p : 1; }
          else if (key === 'fit') block.fit = value.toLowerCase() === 'cover' ? 'cover' : 'contain';
          else if (key === 'ratio') block.ratio = value;
        }
        i++;
      }
      if (i < lines.length && /^:::\s*$/.test(lines[i].trim())) i++;
      blocks.push(block);
      continue;
    }

    if (/^:::cta\s*$/i.test(line)) {
      i++;
      const payload = (i < lines.length ? lines[i].trim() : '');
      const parts = payload.split('|').map(p => p.trim());
      while (i < lines.length && !/^:::\s*$/.test(lines[i].trim())) i++;
      if (i < lines.length && /^:::\s*$/.test(lines[i].trim())) i++;
      blocks.push({ id: uid(), type: 'cta', headline: inlineFormat(parts[0] || ''), body: inlineFormat(parts[1] || ''), buttonLabel: parts[2] || '', buttonUrl: parts[3] || '', tone: 'default' });
      continue;
    }

    if (/^:::beforeafter\s*$/i.test(line)) {
      const block = { id: uid(), type: 'beforeafter', beforeSrc: '', beforeAlt: '', afterSrc: '', afterAlt: '', caption: '', position: 67 };
      i++;
      while (i < lines.length && !/^:::\s*$/.test(lines[i].trim())) {
        const current = lines[i].trim();
        const beforeMatch = current.match(/^before:\s*!\[([^\]]*)\]\(([^)]+)\)\s*$/i);
        const afterMatch = current.match(/^after:\s*!\[([^\]]*)\]\(([^)]+)\)\s*$/i);
        const captionMatch = current.match(/^caption:\s*(.+)$/i);
        if (beforeMatch) { block.beforeAlt = beforeMatch[1] || ''; block.beforeSrc = beforeMatch[2] || ''; }
        else if (afterMatch) { block.afterAlt = afterMatch[1] || ''; block.afterSrc = afterMatch[2] || ''; }
        else if (captionMatch) { block.caption = inlineFormat((captionMatch[1] || '').trim()); }
        i++;
      }
      if (i < lines.length && /^:::\s*$/.test(lines[i].trim())) i++;
      blocks.push(block);
      continue;
    }

    if (/^:::faq\s*$/i.test(line)) {
      const items = [];
      i++;
      while (i < lines.length && !/^:::\s*$/.test(lines[i].trim())) {
        const faqMatch = lines[i].trim().match(/^-\s*(.*?)\s*\|\s*(.*?)(?:\s*\|\s*(open))?\s*$/i);
        if (faqMatch) items.push({ question: faqMatch[1] || '', answer: inlineFormat(faqMatch[2] || ''), open: Boolean(faqMatch[3]) });
        i++;
      }
      if (i < lines.length && /^:::\s*$/.test(lines[i].trim())) i++;
      if (items.length && !items.some(item => item.open)) items[0].open = true;
      blocks.push({ id: uid(), type: 'faq', items: items.length ? items : [{ question: '', answer: '', open: true }] });
      continue;
    }

    if (/^:::process\s*$/i.test(line)) {
      const steps = [];
      i++;
      while (i < lines.length && !/^:::\s*$/.test(lines[i].trim())) {
        const pm = lines[i].trim().match(/^\d+\.\s*(.*?)\s*(?:\|\s*(.*?))?\s*(?:\|\s*!\[([^\]]*)\]\(([^)]+)\))?\s*$/);
        if (pm) {
          const lead = (pm[1] || '').trim();
          const datedLead = lead.match(/^@(.+?)\s*::\s*(.+)$/);
          steps.push({ title: datedLead ? datedLead[2].trim() : lead, date: datedLead ? datedLead[1].trim() : '', content: inlineFormat((pm[2] || '').trim()), imageAlt: (pm[3] || '').trim(), image: (pm[4] || '').trim() });
        }
        i++;
      }
      if (i < lines.length && /^:::\s*$/.test(lines[i].trim())) i++;
      blocks.push({ id: uid(), type: 'process', steps: steps.length ? steps : [{ title: '', date: '', content: '', image: '', imageAlt: '' }] });
      continue;
    }

    const calloutMatch = line.match(/^!!!\s*(note|highlight|warning)?\s*(.*)$/i);
    if (calloutMatch) {
      const tone = (calloutMatch[1] || 'note').toLowerCase();
      const title = inlineFormat((calloutMatch[2] || '').trim());
      i++;
      const bodyLines = [];
      while (i < lines.length && lines[i].trim()) { bodyLines.push(lines[i].trim()); i++; }
      blocks.push({ id: uid(), type: 'callout', tone, title, content: inlineFormat(bodyLines.join('<br>')) });
      continue;
    }

    if (/^# /.test(line)) { blocks.push({ id: uid(), type: 'text-lg', content: inlineFormat(line.slice(2).trim()), align: 'left' }); i++; continue; }
    if (/^## /.test(line)) { blocks.push({ id: uid(), type: 'text-md', content: '<b>' + inlineFormat(line.slice(3).trim()) + '</b>', align: 'left' }); i++; continue; }
    if (/^#{3,} /.test(line)) { blocks.push({ id: uid(), type: 'text-sm', content: inlineFormat(line.replace(/^#+\s/, '')).toUpperCase(), align: 'left' }); i++; continue; }

    if (/^> /.test(line)) {
      const quoteLines = [];
      while (i < lines.length && /^> /.test(lines[i])) { quoteLines.push(lines[i].slice(2).trim()); i++; }
      blocks.push({ id: uid(), type: 'quote', content: inlineFormat(quoteLines.join(' ')), align: 'left' });
      continue;
    }

    if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) { blocks.push({ id: uid(), type: 'divider' }); i++; continue; }

    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (imgMatch) { blocks.push({ id: uid(), type: 'image', src: imgMatch[2], alt: imgMatch[1] }); i++; continue; }

    const videoMatch = line.match(/^!video\(([^)]+)\)$/i);
    if (videoMatch) { blocks.push({ id: uid(), type: 'video', src: videoMatch[1].trim() }); i++; continue; }

    const statMatch = line.match(/^([\d,]+\+?)\s*\|\s*(.+)$/);
    if (statMatch) {
      const items = [];
      while (i < lines.length) {
        const sm = lines[i].match(/^([\d,]+[^|]*?)\s*\|\s*(.+)$/);
        if (!sm) break;
        items.push({ num: sm[1].trim(), label: sm[2].trim() });
        i++;
      }
      blocks.push({ id: uid(), type: 'stats', items });
      continue;
    }

    const paraLines = [];
    while (i < lines.length) {
      const l = lines[i];
      if (!l.trim()) break;
      if (/^[#>!]/.test(l)) break;
      if (/^---+$/.test(l.trim()) || /^\*\*\*+$/.test(l.trim())) break;
      paraLines.push(l.trim());
      i++;
    }
    if (paraLines.length) {
      const isList = paraLines.every(x => /^[-*]\s+/.test(x));
      const content = isList
        ? inlineFormat(paraLines.map(x => '• ' + x.replace(/^[-*]\s+/, '')).join('<br>'))
        : inlineFormat(paraLines.join('<br>'));
      blocks.push({ id: uid(), type: 'text-md', content, align: 'left' });
      continue;
    }

    blocks.push({ id: uid(), type: 'text-md', content: inlineFormat(line.trim()), align: 'left' });
    i++;
  }

  return blocks;
}
