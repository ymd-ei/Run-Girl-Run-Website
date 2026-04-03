/**
 * Validation & Parsing Utilities
 * Handles URL parsing, video URL detection, markdown parsing
 */

/**
 * Generate unique ID for blocks
 * @returns {string} Unique ID (e.g., "b1627894123abc")
 */
export function uid() {
  return 'b' + Date.now() + Math.random().toString(36).slice(2, 6);
}

/**
 * Parse reel/video URL (YouTube, Vimeo, or local video)
 * Returns null if parsing fails; modifies reel object if successful
 * @param {string} raw - Raw user input
 * @returns {{type: string, url: string}|null} Parsed reel object or null
 */
export function parseReelInput(raw) {
  const val = raw.trim();
  if (!val) {
    return { type: 'placeholder', url: '' };
  }

  const srcMatch = val.match(/src=["']([^"']+)["']/);
  const url = srcMatch ? srcMatch[1] : val;

  // YouTube detection
  const ytEmbed = url.match(/youtube\.com\/embed\/([\w-]+)/);
  const ytShort = url.match(/youtu\.be\/([\w-]+)/);
  const ytWatch = url.match(/youtube\.com\/watch\?v=([\w-]+)/);
  const ytId = (ytEmbed && ytEmbed[1]) || (ytShort && ytShort[1]) || (ytWatch && ytWatch[1]);

  if (ytId) {
    return {
      type: 'youtube',
      url: `https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&loop=1&playlist=${ytId}&controls=0&rel=0`
    };
  }

  // Vimeo detection
  const vimeoEmbed = url.match(/player\.vimeo\.com\/video\/([\d]+)/);
  const vimeoWatch = url.match(/vimeo\.com\/([\d]+)/);
  const vimeoId = (vimeoEmbed && vimeoEmbed[1]) || (vimeoWatch && vimeoWatch[1]);

  if (vimeoId) {
    return {
      type: 'vimeo',
      url: `https://player.vimeo.com/video/${vimeoId}?autoplay=1&loop=1&background=1&muted=1`
    };
  }

  // Local video detection
  if (url.match(/\.(mp4|webm|ogg)$/i)) {
    return { type: 'video', url };
  }

  // Default: could not parse
  return null;
}

/**
 * Parse contact video URL
 * @param {string} raw - Raw user input
 * @returns {{type: string, url: string}|null} Parsed video object or null
 */
export function parseContactVideo(raw) {
  const val = raw.trim();
  if (!val) {
    return { type: 'placeholder', url: '' };
  }

  const srcMatch = val.match(/src=["']([^"']+)["']/);
  const url = srcMatch ? srcMatch[1] : val;

  // YouTube detection
  const ytEmbed = url.match(/youtube\.com\/embed\/([\w-]+)/);
  const ytShort = url.match(/youtu\.be\/([\w-]+)/);
  const ytWatch = url.match(/youtube\.com\/watch\?v=([\w-]+)/);
  const ytId = (ytEmbed && ytEmbed[1]) || (ytShort && ytShort[1]) || (ytWatch && ytWatch[1]);

  if (ytId) {
    return {
      type: 'youtube',
      url: `https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&loop=1&playlist=${ytId}&controls=0&rel=0`
    };
  }

  // Vimeo detection
  const vimeoEmbed = url.match(/player\.vimeo\.com\/video\/([\d]+)/);
  const vimeoWatch = url.match(/vimeo\.com\/([\d]+)/);
  const vimeoId = (vimeoEmbed && vimeoEmbed[1]) || (vimeoWatch && vimeoWatch[1]);

  if (vimeoId) {
    return {
      type: 'vimeo',
      url: `https://player.vimeo.com/video/${vimeoId}?autoplay=1&loop=1&background=1&muted=1`
    };
  }

  return null;
}

/**
 * Parse markdown text into content blocks
 * Supports: headings, quotes, dividers, images, stats, paragraphs
 * @param {string} md - Markdown text
 * @returns {Array} Array of block objects
 */
export function parseMarkdownToBlocks(md) {
  const lines = md.split('\n');
  const blocks = [];
  let i = 0;

  function inlineFormat(text) {
    // Convert **bold** → <b>, *italic* → <i>, `code` → <b>
    return text
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/\*([^*]+)\*/g, '<i>$1</i>')
      .replace(/`([^`]+)`/g, '<b>$1</b>');
  }

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trimEnd();

    // Skip blank lines
    if (!line.trim()) {
      i++;
      continue;
    }

    // H1 → text-lg (accent large heading)
    if (/^# /.test(line)) {
      blocks.push({
        id: uid(),
        type: 'text-lg',
        content: inlineFormat(line.slice(2).trim()),
        align: 'left'
      });
      i++;
      continue;
    }

    // H2 → text-md bold
    if (/^## /.test(line)) {
      blocks.push({
        id: uid(),
        type: 'text-md',
        content: '<b>' + inlineFormat(line.slice(3).trim()) + '</b>',
        align: 'left'
      });
      i++;
      continue;
    }

    // H3+ → text-sm uppercase label
    if (/^#{3,} /.test(line)) {
      blocks.push({
        id: uid(),
        type: 'text-sm',
        content: inlineFormat(line.replace(/^#+\s/, '')).toUpperCase(),
        align: 'left'
      });
      i++;
      continue;
    }

    // Blockquote — collect consecutive lines
    if (/^> /.test(line)) {
      const quoteLines = [];
      while (i < lines.length && /^> /.test(lines[i])) {
        quoteLines.push(lines[i].slice(2).trim());
        i++;
      }
      blocks.push({
        id: uid(),
        type: 'quote',
        content: inlineFormat(quoteLines.join(' ')),
        align: 'left'
      });
      continue;
    }

    // Divider
    if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
      blocks.push({ id: uid(), type: 'divider' });
      i++;
      continue;
    }

    // Image: ![alt](src)
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (imgMatch) {
      blocks.push({
        id: uid(),
        type: 'image',
        src: imgMatch[2],
        alt: imgMatch[1]
      });
      i++;
      continue;
    }

    // Alpha art block
    if (/^:::alpha\s*$/i.test(line)) {
      const block = {
        id: uid(),
        type: 'alpha-art',
        src: '',
        alt: '',
        color: '#5e30eb',
        bg: 'transparent',
        scale: 1,
        fit: 'contain',
        ratio: '16/9'
      };
      i++;
      while (i < lines.length && !/^:::\s*$/.test(lines[i].trim())) {
        const current = lines[i].trim();
        const pair = current.match(/^([a-z]+)\s*:\s*(.+)$/i);
        if (pair) {
          const key = pair[1].toLowerCase();
          const value = pair[2].trim();
          if (key === 'src') block.src = value;
          else if (key === 'alt') block.alt = value;
          else if (key === 'color') block.color = value;
          else if (key === 'bg') block.bg = value;
          else if (key === 'scale') {
            const parsed = parseFloat(value);
            block.scale = Number.isFinite(parsed) ? parsed : 1;
          }
          else if (key === 'fit') block.fit = value.toLowerCase() === 'cover' ? 'cover' : 'contain';
          else if (key === 'ratio') block.ratio = value;
        }
        i++;
      }
      if (i < lines.length && /^:::\s*$/.test(lines[i].trim())) i++;
      blocks.push(block);
      continue;
    }

    // Stats shorthand: lines like "148,000 | Combined Views"
    const statMatch = line.match(/^([\d,]+\+?)\s*\|\s*(.+)$/);
    if (statMatch) {
      // Collect consecutive stat lines into one stats block
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

    // Regular paragraph — collect until blank line or block-level marker
    const paraLines = [];
    while (i < lines.length) {
      const l = lines[i];
      if (!l.trim()) break; // blank line ends paragraph
      if (/^[#>!]/.test(l)) break; // block marker
      if (/^---+$/.test(l.trim()) || /^\*\*\*+$/.test(l.trim())) break;
      paraLines.push(l.trim());
      i++;
    }
    if (paraLines.length) {
      const content = inlineFormat(paraLines.join(' '));
      blocks.push({
        id: uid(),
        type: 'text-md',
        content,
        align: 'left'
      });
      continue;
    }

    // Fallback for unrecognized block-like lines so malformed markdown cannot stall parsing.
    blocks.push({
      id: uid(),
      type: 'text-md',
      content: inlineFormat(line.trim()),
      align: 'left'
    });
    i++;
  }

  return blocks;
}
