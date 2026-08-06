export function getProductImageSrc(imageUrl?: string | null, sku?: string | number): string {
  if (imageUrl && imageUrl.trim()) {
    return imageUrl;
  }

  const fallbackCode = (sku || 'product').toString().toUpperCase();
  const encoded = encodeURIComponent(fallbackCode);
  return `/placeholder.svg?code=${encoded}`;
}
