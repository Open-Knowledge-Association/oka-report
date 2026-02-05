/**
 * Normalize language + project to wikiProject format
 * Example: normalizeWikiProject("en", "wikipedia") => "en.wikipedia.org"
 */
export function normalizeWikiProject(language: string, project: string): string {
  return `${language}.${project}.org`;
}

/**
 * Parse wikiProject into language and project components
 * Example: parseWikiProject("en.wikipedia.org") => { language: "en", project: "wikipedia" }
 */
export function parseWikiProject(wikiProject: string): { language: string; project: string } {
  const match = wikiProject.match(/^([^.]+)\.([^.]+)\.org$/);
  if (!match) {
    throw new Error(`Invalid wikiProject format: ${wikiProject}`);
  }
  return { language: match[1], project: match[2] };
}

/**
 * Extract wikiProject and title from a Wikipedia URL
 * Example: extractFromUrl("https://en.wikipedia.org/wiki/Test_Article")
 *          => { wikiProject: "en.wikipedia.org", title: "Test_Article" }
 */
export function extractFromUrl(url: string): { wikiProject: string; title: string } {
  const match = url.match(/^https?:\/\/([^/]+)\/wiki\/(.+)$/);
  if (!match) {
    throw new Error(`Invalid Wikipedia URL format: ${url}`);
  }
  return { wikiProject: match[1], title: decodeURIComponent(match[2]) };
}
