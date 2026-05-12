import { TemplateRenderer, ActivityStats } from '../Generator';
import { JSDOM } from 'jsdom';

export class ArtisticTemplate implements TemplateRenderer {
  render(stats: ActivityStats, dom: JSDOM): string {
    return '<!-- Artistic template rendered via Rough.js in Generator -->';
  }
}
