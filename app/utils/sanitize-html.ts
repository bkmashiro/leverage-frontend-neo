import DOMPurify from 'dompurify'

const markdownHtmlPolicy = {
  // KaTeX radicals/stretchy accents use SVG paths; DOMPurify still strips
  // executable attributes and unsafe URLs in all enabled namespaces.
  USE_PROFILES: { html: true, mathMl: true, svg: true },
  FORBID_TAGS: ['iframe', 'script', 'style', 'object', 'embed', 'base', 'meta', 'link', 'form', 'input', 'button', 'textarea', 'select', 'foreignobject', 'animate', 'animatemotion', 'animatetransform', 'set', 'use'],
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  SANITIZE_NAMED_PROPS: true,
}

/** Sanitize untrusted rich HTML while retaining HTML, MathML and KaTeX output. */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, markdownHtmlPolicy)
}
