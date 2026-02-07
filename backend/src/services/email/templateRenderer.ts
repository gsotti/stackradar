import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const templateCache = new Map<string, string>();

/**
 * Render an email template by replacing {{variable}} placeholders
 * @param templateName - Name of the template file (without .html extension)
 * @param variables - Object containing variable values to replace
 * @returns Object with both HTML and plain text versions
 */
export function renderTemplate(templateName: string, variables: Record<string, string>): { html: string; text: string } {
  // Get template from cache or read from file
  let template = templateCache.get(templateName);

  if (!template) {
    const templatePath = path.join(__dirname, 'templates', templateName + '.html');
    try {
      template = fs.readFileSync(templatePath, 'utf-8');
      templateCache.set(templateName, template);
    } catch (error) {
      throw new Error(`Failed to load email template "${templateName}": ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Replace all {{key}} placeholders with values
  let html = template;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    html = html.replace(placeholder, value);
  }

  // Generate plain text version by stripping HTML tags
  let text = html
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
    .replace(/&amp;/g, '&') // Replace &amp; with &
    .replace(/&lt;/g, '<') // Replace &lt; with <
    .replace(/&gt;/g, '>') // Replace &gt; with >
    .replace(/&quot;/g, '"') // Replace &quot; with "
    .replace(/&#39;/g, "'") // Replace &#39; with '
    .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove excessive newlines
    .trim();

  return { html, text };
}
