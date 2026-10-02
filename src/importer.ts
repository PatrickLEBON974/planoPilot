import Papa from 'papaparse';
import { generate, parseNumber, uid } from './domain.ts';
import type { Product, Project, SalesMetric } from './types.ts';
export type Field = 'sku' | 'name' | 'brand' | 'segment' | 'subsegment' | 'sales' | 'quantity' | 'ours' | 'packaging' | 'sourceUrl' | 'supplier' | 'notes';
export type ImportMode = 'sales' | 'catalog';
export function projectWithImport(project: Project, products: Product[], sourceName: string, sourceSheet: string, salesMetric: SalesMetric): Project {
  const catalog = salesMetric === 'catalog';
  return generate({ ...project, products, sourceName, sourceSheet, salesMetric,
    weightedBySales: !catalog && project.weightedBySales,
    groupBy: catalog ? 'segment' : project.groupBy,
    targetSegment: catalog ? '' : [...new Set(products.map(x => x.segment))].sort()[0] || '',
    massUnits: {}, massOrder: [], blockPlacements: [], articlePlacements: [], customGroups: [], groupColors: {},
  });
}
export type Mapping = Record<Field, number>;
export interface Sheet { name: string; rows: string[][]; }
export const fields: { key: Field; label: string; required?: boolean; aliases: string[] }[] = [
  { key: 'sku', label: 'Référence', aliases: ['reference', 'ref', 'sku', 'ean', 'code produit'] },
  { key: 'name', label: 'Produit / désignation', required: true, aliases: ['produit', 'designation', 'libelle', 'product', 'name', 'article'] },
  { key: 'brand', label: 'Marque', required: true, aliases: ['marque', 'brand', 'fabricant'] },
  { key: 'segment', label: 'Segment', required: true, aliases: ['segment', 'marche', 'categorie', 'category'] },
  { key: 'subsegment', label: 'Sous-segment', aliases: ['sous segment', 'subsegment', 'sous categorie'] },
  { key: 'sales', label: 'Chiffre d’affaires / ventes', required: true, aliases: ['ca', 'chiffre d affaires', 'ventes', 'sales', 'revenue', 'valeur'] },
  { key: 'quantity', label: 'Quantité', aliases: ['quantite', 'quantity', 'volume', 'unites'] },
  { key: 'ours', label: 'Référence interne', aliases: ['reference interne', 'notre reference', 'ours', 'interne', 'appartenance', 'concurrent'] },
  { key: 'packaging', label: 'Conditionnement', aliases: ['conditionnement', 'format', 'packaging'] },
  { key: 'sourceUrl', label: 'Source du produit', aliases: ['source', 'source url', 'url source', 'url produit'] },
  { key: 'supplier', label: 'Fournisseur', aliases: ['fournisseur', 'supplier'] },
  { key: 'notes', label: 'Notes', aliases: ['notes', 'note', 'observations', 'commentaire'] },
];
const plain = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
export function suggestMapping(headers: string[]): Mapping {
  const mapping = Object.fromEntries(fields.map(f => [f.key, -1])) as Mapping;
  const used = new Set<number>();
  for (const f of [...fields].sort((a, b) => Number(Boolean(b.required)) - Number(Boolean(a.required)))) {
    const exact = headers.findIndex((h, i) => !used.has(i) && f.aliases.includes(plain(h)));
    const index = exact >= 0 ? exact : headers.findIndex((h, i) => !used.has(i) && f.aliases.some(a => a.length > 3 && plain(h).includes(a)));
    mapping[f.key] = index; if (index >= 0) used.add(index);
  }
  return mapping;
}
export async function readWorkbook(file: File): Promise<Sheet[]> {
  if (file.size > 50 * 1024 * 1024) throw new Error('Le fichier dépasse 50 Mo. Réduisez-le avant de l’importer.');
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'csv' || ext === 'txt') {
    const bytes = await file.arrayBuffer();
    let text = new TextDecoder('utf-8').decode(bytes);
    if (text.includes('\ufffd')) text = new TextDecoder('windows-1252').decode(bytes);
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy' });
    if (parsed.errors.some(x => x.code === 'MissingQuotes')) throw new Error('Le CSV contient des guillemets non fermés.');
    return [{ name: 'CSV', rows: parsed.data }];
  }
  if (ext !== 'xlsx') throw new Error('Format accepté : CSV ou XLSX. Pour un ancien fichier XLS, enregistrez-le au format XLSX.');
  const { default: readExcelFile } = await import('read-excel-file/browser');
  const sheets = await readExcelFile(file);
  return sheets.map(sheet => ({ name: sheet.sheet, rows: sheet.data.map(row => row.map(cell => cell instanceof Date ? cell.toLocaleDateString('fr-FR') : String(cell ?? ''))) })).filter(sheet => sheet.rows.some(row => row.some(Boolean)));
}
export function mapProducts(rows: string[][], headerIndex: number, mapping: Mapping, headers: string[], mode: ImportMode = 'sales'): { products: Product[]; errors: string[]; duplicates: number } {
  const errors: string[] = [], products: Product[] = [];
  const seen = new Set<string>(); let duplicates = 0;
  rows.slice(headerIndex + 1).forEach((row, index) => {
    if (!row.some(x => String(x).trim())) return;
    const get = (field: Field) => String(row[mapping[field]] ?? '').trim();
    const sales = mode === 'catalog' ? 0 : parseNumber(get('sales')), quantity = mode === 'catalog' ? null : parseNumber(get('quantity'));
    if (!get('name') || !get('brand') || !get('segment') || sales === null || sales < 0) { errors.push(`Ligne ${headerIndex + index + 2} : produit, marque, segment${mode === 'sales' ? ' ou chiffre d’affaires' : ''} invalide.`); return; }
    const sku = get('sku') || `LIGNE-${headerIndex + index + 2}`;
    if (seen.has(sku)) { duplicates++; if (mode === 'catalog') return; } seen.add(sku);
    const oursValue = plain(get('ours'));
    const competitorColumn = plain(headers[mapping.ours] || '') === 'concurrent';
    const isTrue = ['true', 'vrai', 'oui', 'yes', '1', 'reference interne', 'notre reference', 'interne', 'notre marque', 'nous'].includes(oursValue);
    const isFalse = ['false', 'faux', 'non', 'no', '0', 'concurrent', 'externe', 'competitor'].includes(oursValue);
    const ours = mapping.ours < 0 || (!isTrue && !isFalse) ? null : competitorColumn ? !isTrue : isTrue;
    products.push({ id: uid(), sku, name: get('name'), brand: get('brand'), segment: get('segment'), subsegment: get('subsegment') || 'Non renseigné', sales, ...(quantity !== null ? { quantity } : {}), ours, ...(get('packaging') ? { packaging: get('packaging') } : {}), ...(get('sourceUrl') ? { sourceUrl: get('sourceUrl') } : {}), ...(get('supplier') ? { supplier: get('supplier') } : {}), ...(get('notes') ? { notes: get('notes') } : {}) });
  });
  return { products, errors, duplicates };
}
