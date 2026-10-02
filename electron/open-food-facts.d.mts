export interface OpenFoodFactsProduct {
  code: string; name: string; brands: string; quantity: string; categories: string[]; imageUrl: string; sourceUrl: string; nutriscore: string;
}
export interface OpenFoodFactsRequest { query: string; page?: number; }
export interface OpenFoodFactsResult { products: OpenFoodFactsProduct[]; count: number; countExact: boolean; page: number; pageSize: number; }
export function productURL(code: string): string;
export function searchURL(request: OpenFoodFactsRequest): URL;
export function createOpenFoodFactsClient(options?: { fetcher?: typeof fetch; now?: () => number; userAgent?: string; timeoutMs?: number }): (request: OpenFoodFactsRequest) => Promise<OpenFoodFactsResult>;
