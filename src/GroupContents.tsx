import { useId, useMemo, useState } from 'react';
import { ChevronDown, Layers } from 'lucide-react';
import { groupKey } from './domain';
import { percent, salesText } from './format';
import type { CustomGroup, Group, Product, SalesMetric } from './types';

type ContentItem = { id: string; label: string; detail?: string; sales: number; references?: number };
const levels = { segment: ['segment', 'segments'], subsegment: ['sous-segment', 'sous-segments'], brand: ['marque', 'marques'], sku: ['référence', 'références'] };

function referenceItems(products: Product[]): ContentItem[] {
  const items = new Map<string, ContentItem>();
  for (const product of products) {
    const id = product.sku || product.id, existing = items.get(id);
    if (existing) existing.sales += product.sales;
    else items.set(id, { id, label: product.name, detail: [product.brand, product.packaging, product.sku].filter(Boolean).join(' · '), sales: product.sales });
  }
  return [...items.values()];
}

export function GroupContents({ group, custom, metric }: { group: Group; custom?: CustomGroup; metric: SalesMetric }) {
  const references = useMemo(() => referenceItems(group.products), [group.products]);
  const members = useMemo(() => {
    if (!custom) return [];
    const products = new Map<string, Product[]>();
    for (const product of group.products) {
      const value = product[custom.groupingLevel] || 'Non renseigné', id = groupKey(custom.groupingLevel, value);
      if (!products.has(id)) products.set(id, []);
      products.get(id)!.push(product);
    }
    return custom.members.flatMap(id => {
      const xs = products.get(id);
      if (!xs?.length) return [];
      return [{ id, label: custom.groupingLevel === 'sku' ? xs[0].name : id.slice(custom.groupingLevel.length + 1), sales: xs.reduce((sum, product) => sum + product.sales, 0), references: new Set(xs.map(product => product.sku || product.id)).size }];
    });
  }, [group.products, custom]);
  const level = custom ? levels[custom.groupingLevel][members.length === 1 ? 0 : 1] : '';
  return <div className="group-contents" onClick={event => event.stopPropagation()}>
    {custom ? <>
      <div className="group-contents-heading"><Layers size={13}/><strong>Regroupement de {members.length} {level}</strong></div>
      <ContentsList items={members} metric={metric} sales={group.sales} labels={levels[custom.groupingLevel]}/>
      {custom.groupingLevel !== 'sku' && <details className="group-reference-details">
        <summary>Voir {references.length === 1 ? 'la référence' : `les ${references.length} références`}<ChevronDown size={13}/></summary>
        <ContentsList items={references} metric={metric} sales={group.sales} labels={levels.sku}/>
      </details>}
    </> : <>
      <div className="group-contents-heading"><strong>Références incluses</strong><span>{references.length}</span></div>
      <ContentsList items={references} metric={metric} sales={group.sales} labels={levels.sku}/>
    </>}
  </div>;
}

function ContentsList({ items, metric, sales, labels }: { items: ContentItem[]; metric: SalesMetric; sales: number; labels: string[] }) {
  const [expanded, setExpanded] = useState(false), id = useId();
  const remaining = items.length - 3;
  return <>
    <ul className="group-content-list" id={id}>
      {(expanded ? items : items.slice(0, 3)).map(item => <li key={item.id}>
        <strong>{item.label}</strong>
        {item.detail && <span className="group-content-detail">{item.detail}</span>}
        {item.references !== undefined && <span className="group-content-detail">{item.references} référence{item.references > 1 ? 's' : ''}</span>}
        {metric !== 'catalog' && <div className="group-content-stats"><span>{salesText(item.sales, metric)}</span><span>{percent(sales > 0 ? item.sales / sales : 0)} des ventes du groupe</span></div>}
      </li>)}
    </ul>
    {items.length > 3 && <button type="button" className="group-content-toggle" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(!expanded)}>{expanded ? 'Réduire la liste' : `Voir ${remaining} autre${remaining > 1 ? 's' : ''} ${labels[remaining === 1 ? 0 : 1]}`}<ChevronDown size={13} className={expanded ? 'contents-expanded' : ''}/></button>}
  </>;
}
