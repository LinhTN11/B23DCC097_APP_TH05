export type LinkMetadata = {
  url: string;
  domain: string;
  title?: string;
  description?: string;
  image?: string;
  logo?: string;
};

export type TextSegment = {
  text: string;
  url?: string;
};

const URL_FINDER =
  /(https?:\/\/[^\s<>"{}|\\^`[\]]+|(?:www\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.(?:com|vn|net|org|io|edu|gov|co|me|app|dev|be|ly|gg|tv|info|xyz)(?:\/[^\s<>"{}|\\^`[\]]*)?)/gi;
const TRAILING_PUNCTUATION = /[.,;:!?)]+$/;
const DIRECT_TIMEOUT_MS = 5000;
const FALLBACK_TIMEOUT_MS = 6000;

const cache = new Map<string, LinkMetadata>();
const pending = new Map<string, Promise<LinkMetadata>>();

export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim().replace(TRAILING_PUNCTUATION, '');
  if (!trimmed) {
    return '';
  }
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function getDomain(url: string): string {
  const normalized = normalizeUrl(url);
  const match = normalized.match(/^https?:\/\/(?:[^@/\n]+@)?([^:/?#\n]+)/i);
  if (!match?.[1]) {
    return url;
  }
  return match[1].replace(/^www\./i, '');
}

export function splitTextWithUrls(text: string): TextSegment[] {
  if (!text) {
    return [{text: ''}];
  }
  const segments: TextSegment[] = [];
  let lastIndex = 0;
  URL_FINDER.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = URL_FINDER.exec(text)) !== null) {
    const start = match.index;
    const prevChar = start > 0 ? text[start - 1] : '';
    // Skip email addresses or mid-word matches when there is no explicit scheme
    if (
      !/^https?:\/\//i.test(match[0]) &&
      prevChar &&
      /[a-z0-9_@.-]/i.test(prevChar)
    ) {
      continue;
    }

    if (start > lastIndex) {
      segments.push({text: text.slice(lastIndex, start)});
    }

    const rawMatch = match[0];
    const cleanMatch = rawMatch.replace(TRAILING_PUNCTUATION, '');
    const trailing = rawMatch.slice(cleanMatch.length);

    if (cleanMatch) {
      segments.push({
        text: cleanMatch,
        url: normalizeUrl(cleanMatch),
      });
    }
    if (trailing) {
      segments.push({text: trailing});
    }

    lastIndex = start + rawMatch.length;
  }

  if (lastIndex < text.length) {
    segments.push({text: text.slice(lastIndex)});
  }

  return segments.length ? segments : [{text}];
}

export function extractUrls(text: string): string[] {
  const urls: string[] = [];
  for (const segment of splitTextWithUrls(text)) {
    if (segment.url) {
      urls.push(segment.url);
    }
  }
  return urls;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&#x0*27;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_, code: string) => {
      const num = Number.parseInt(code, 10);
      return Number.isFinite(num) ? String.fromCodePoint(num) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const num = Number.parseInt(hex, 16);
      return Number.isFinite(num) ? String.fromCodePoint(num) : '';
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function getOrigin(url: string): string {
  const match = url.match(/^(https?:\/\/[^/?#]+)/i);
  return match?.[1] ?? '';
}

function getProtocol(url: string): string {
  const match = url.match(/^(https?:)/i);
  return match?.[1]?.toLowerCase() ?? 'https:';
}

export function resolveUrl(
  candidate: string | undefined,
  baseUrl: string,
): string | undefined {
  if (!candidate) {
    return undefined;
  }
  const clean = candidate.trim();
  if (!clean || /^(?:data|javascript|mailto|tel):/i.test(clean)) {
    return undefined;
  }
  if (/^https?:\/\//i.test(clean)) {
    return clean;
  }
  if (clean.startsWith('//')) {
    return `${getProtocol(baseUrl)}${clean}`;
  }
  const origin = getOrigin(baseUrl);
  if (!origin) {
    return undefined;
  }
  if (clean.startsWith('/')) {
    return `${origin}${clean}`;
  }
  const basePath = baseUrl.split(/[?#]/)[0];
  const lastSlash = basePath.lastIndexOf('/');
  const dir =
    lastSlash > origin.length
      ? basePath.slice(0, lastSlash + 1)
      : `${origin}/`;
  return `${dir}${clean}`;
}

function extractMetaTags(html: string): Record<string, string> {
  const result: Record<string, string> = {};
  const metaRegex = /<meta\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = metaRegex.exec(html)) !== null) {
    const tag = match[0];
    const keyMatch = tag.match(
      /\b(?:property|name|itemprop)\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s/>]+))/i,
    );
    const contentMatch = tag.match(
      /\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s/>]+))/i,
    );
    const key = (
      keyMatch?.[1] ??
      keyMatch?.[2] ??
      keyMatch?.[3] ??
      ''
    ).toLowerCase();
    const content =
      contentMatch?.[1] ?? contentMatch?.[2] ?? contentMatch?.[3] ?? '';
    if (key && content && !result[key]) {
      result[key] = decodeHtml(content);
    }
  }
  return result;
}

function extractLinkTags(html: string): {icon?: string; imageSrc?: string} {
  let icon: string | undefined;
  let imageSrc: string | undefined;
  const linkRegex = /<link\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html)) !== null) {
    const tag = match[0];
    const relMatch = tag.match(
      /\brel\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s/>]+))/i,
    );
    const hrefMatch = tag.match(
      /\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s/>]+))/i,
    );
    const rel = (
      relMatch?.[1] ??
      relMatch?.[2] ??
      relMatch?.[3] ??
      ''
    ).toLowerCase();
    const href = hrefMatch?.[1] ?? hrefMatch?.[2] ?? hrefMatch?.[3];
    if (!href) {
      continue;
    }
    if (rel === 'image_src' && !imageSrc) {
      imageSrc = decodeHtml(href);
    } else if (
      /(?:apple-touch-icon|shortcut icon|icon)/i.test(rel) &&
      !icon
    ) {
      icon = decodeHtml(href);
    }
  }
  return {icon, imageSrc};
}

function readTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? decodeHtml(match[1]) : undefined;
}

function getYouTubeId(url: string): string | undefined {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
  );
  return match?.[1];
}

async function fetchDirectHtml(
  url: string,
): Promise<Partial<LinkMetadata> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DIRECT_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent':
          'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      },
    });
    if (!response.ok) {
      return null;
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType && !contentType.toLowerCase().includes('text/html')) {
      return null;
    }

    const html = (await response.text()).slice(0, 300_000);
    const meta = extractMetaTags(html);
    const links = extractLinkTags(html);
    const finalUrl = response.url || url;

    const title =
      meta['og:title'] ??
      meta['twitter:title'] ??
      meta.title ??
      readTitle(html);
    const description =
      meta['og:description'] ??
      meta['twitter:description'] ??
      meta.description;
    const image = resolveUrl(
      meta['og:image'] ??
        meta['og:image:secure_url'] ??
        meta['og:image:url'] ??
        meta['twitter:image'] ??
        meta['twitter:image:src'] ??
        links.imageSrc,
      finalUrl,
    );
    const logo = resolveUrl(links.icon, finalUrl);
    const domain = meta['og:site_name'] ?? getDomain(finalUrl);

    return {domain, title, description, image, logo};
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchMicrolink(
  url: string,
): Promise<Partial<LinkMetadata> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FALLBACK_TIMEOUT_MS);
  try {
    const response = await fetch(
      `https://api.microlink.io/?url=${encodeURIComponent(url)}`,
      {signal: controller.signal},
    );
    if (!response.ok) {
      return null;
    }
    const json = (await response.json()) as {
      status?: string;
      data?: {
        title?: string;
        description?: string;
        publisher?: string;
        image?: {url?: string};
        logo?: {url?: string};
      };
    };
    if (json.status !== 'success' || !json.data) {
      return null;
    }
    return {
      domain: json.data.publisher || undefined,
      title: json.data.title || undefined,
      description: json.data.description || undefined,
      image: resolveUrl(json.data.image?.url, url),
      logo: resolveUrl(json.data.logo?.url, url),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function getCachedLinkMetadata(url: string): LinkMetadata | undefined {
  const normalized = normalizeUrl(url);
  return cache.get(normalized);
}

export async function fetchLinkMetadata(rawUrl: string): Promise<LinkMetadata> {
  const url = normalizeUrl(rawUrl);
  const cached = cache.get(url);
  if (cached) {
    return cached;
  }
  const existing = pending.get(url);
  if (existing) {
    return existing;
  }

  const task = (async (): Promise<LinkMetadata> => {
    const baseDomain = getDomain(url);
    const ytId = getYouTubeId(url);
    const ytThumb = ytId
      ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`
      : undefined;

    try {
      const direct = await fetchDirectHtml(url);
      let title = direct?.title;
      let description = direct?.description;
      let image = direct?.image;
      let logo = direct?.logo;
      let domain = direct?.domain || baseDomain;

      if (!title || !image) {
        const fallback = await fetchMicrolink(url);
        if (fallback) {
          title = title || fallback.title;
          description = description || fallback.description;
          image = image || fallback.image;
          logo = logo || fallback.logo;
          domain =
            domain !== baseDomain
              ? domain
              : fallback.domain || baseDomain;
        }
      }

      const resolvedImage = image || ytThumb;
      const resolvedLogo =
        logo ||
        `https://www.google.com/s2/favicons?domain=${encodeURIComponent(baseDomain)}&sz=128`;

      const result: LinkMetadata = {
        url,
        domain,
        title: title || baseDomain,
        description,
        image: resolvedImage,
        logo: resolvedLogo,
      };

      if (title || resolvedImage) {
        cache.set(url, result);
      }
      return result;
    } finally {
      pending.delete(url);
    }
  })();

  pending.set(url, task);
  return task;
}
