import { useEffect, type FC } from 'react';

const SITE_URL = 'https://aquadealers.in';

type JsonLd = Record<string, unknown> | Record<string, unknown>[];

interface SeoProps {
  title: string;
  description: string;
  path?: string;
  jsonLd?: JsonLd;
}

const setMeta = (selector: string, attribute: 'content' | 'href', value: string) => {
  const element = document.head.querySelector<HTMLMetaElement | HTMLLinkElement>(selector);
  if (element) {
    element.setAttribute(attribute, value);
  }
};

const ensureCanonical = (href: string) => {
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = href;
};

const upsertJsonLd = (jsonLd?: JsonLd) => {
  const id = 'route-json-ld';
  const existing = document.getElementById(id) as HTMLScriptElement | null;

  if (!jsonLd) {
    existing?.remove();
    return;
  }

  const script: HTMLScriptElement = existing || document.createElement('script');
  script.id = id;
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(jsonLd);

  if (!existing) {
    document.head.appendChild(script);
  }
};

export const buildUrl = (path = '/') => `${SITE_URL}${path === '/' ? '/' : path}`;

export const Seo: FC<SeoProps> = ({ title, description, path = '/', jsonLd }) => {
  useEffect(() => {
    const url = buildUrl(path);

    document.title = title;
    setMeta('meta[name="description"]', 'content', description);
    ensureCanonical(url);
    setMeta('meta[property="og:url"]', 'content', url);
    setMeta('meta[property="og:title"]', 'content', title);
    setMeta('meta[property="og:description"]', 'content', description);
    setMeta('meta[property="twitter:url"]', 'content', url);
    setMeta('meta[property="twitter:title"]', 'content', title);
    setMeta('meta[property="twitter:description"]', 'content', description);
    upsertJsonLd(jsonLd);
  }, [title, description, path, jsonLd]);

  return null;
};

export default Seo;
