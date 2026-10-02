import { createOpenFoodFactsClient } from '../electron/open-food-facts.mjs';
import { generate } from './domain.ts';
import type { Product, Project } from './types.ts';
export type { OpenFoodFactsProduct, OpenFoodFactsResult } from '../electron/open-food-facts.mjs';

const webSearch = createOpenFoodFactsClient();
export async function searchOpenFoodFacts(query: string, page = 1) {
  try {
    return await (window.plano ? window.plano.searchOpenFoodFacts({ query, page }) : webSearch({ query, page }));
  } catch (error) {
    const message = error instanceof Error ? error.message.replace(/^Error invoking remote method 'open-food-facts:search': (?:Error: )?/, '') : 'La recherche n’a pas pu aboutir. Réessayez.';
    throw new Error(message);
  }
}

export function appendOpenFoodFactsProduct(p: Project, product: Product): Project {
  if (p.products.some(existing => existing.sku === product.sku)) throw new Error('Cette référence est déjà dans l’assortiment.');
  const next = { ...p, products: [...p.products, product] };
  if (p.products.length) return next;
  return generate({ ...next, salesMetric: 'catalog', weightedBySales: false, groupBy: 'segment', targetSegment: '', sourceName: 'Open Food Facts', sourceSheet: '' });
}
