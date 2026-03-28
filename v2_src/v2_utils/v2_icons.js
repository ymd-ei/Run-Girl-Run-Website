/**
 * Icon Utilities
 * Detects social media URLs and returns appropriate Phosphor icon classes
 */

/**
 * Detect icon class from URL
 * @param {string} url - URL to detect
 * @returns {string} Phosphor icon class
 */
export function phosphorIcon(url) {
  if (url.startsWith('mailto:')) return 'ph-fill ph-envelope';
  if (url.includes('linkedin.com')) return 'ph-fill ph-linkedin-logo';
  if (url.includes('instagram.com')) return 'ph-fill ph-instagram-logo';
  if (url.includes('vimeo.com')) return 'ph-fill ph-vimeo-logo';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'ph-fill ph-youtube-logo';
  if (url.includes('twitter.com') || url.includes('x.com')) return 'ph-fill ph-x-logo';
  if (url.includes('github.com')) return 'ph-fill ph-github-logo';
  if (url.includes('behance.net')) return 'ph-fill ph-behance-logo';
  if (url.includes('dribbble.com')) return 'ph-fill ph-dribbble-logo';
  if (url.includes('tiktok.com')) return 'ph-fill ph-tiktok-logo';
  return 'ph-fill ph-link';
}
