import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outputDir = path.join(root, "_site");
const siteUrl = "https://elforatpharma.com";
const supabaseUrl = process.env.SUPABASE_URL || "https://sidtdxchiqiogfkwbdui.supabase.co";

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);
}
function cleanText(value = "") {
  return String(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ").trim().slice(0, 5000);
}
function imageList(product) {
  const candidates = [];
  for (const value of [product.img, product.images, product.gallery]) {
    if (Array.isArray(value)) candidates.push(...value);
    else if (typeof value === "string" && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        candidates.push(...(Array.isArray(parsed) ? parsed : [parsed]));
      } catch { candidates.push(value); }
    }
  }
  const urls = candidates.map((item) => {
    if (typeof item === "string") return item.trim();
    if (item && typeof item === "object") return String(item.url || item.src || item.image || "").trim();
    return "";
  }).filter(Boolean).map((url) => {
    try {
      const parsed = new URL(url, siteUrl);
      return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : "";
    } catch { return ""; }
  }).filter(Boolean);
  return [...new Set(urls)].slice(0, 8);
}
function jsonForHtml(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}
function productPage(product) {
  const name = cleanText(product.name);
  const description = cleanText(product.desc) || (name + " من متجر الفرات فارما للعناية بالبشرة والشعر.");
  const price = Number(product.price);
  const oldPrice = Number(product.oldPrice);
  const images = imageList(product);
  const id = String(product.id);
  const url = siteUrl + "/products/" + encodeURIComponent(id) + "/";
  const appUrl = siteUrl + "/#product?item=" + encodeURIComponent(id);
  const inStock = product.stock == null || Number(product.stock) > 0;
  const schema = {
    "@context": "https://schema.org", "@type": "Product", name, description,
    sku: id, category: cleanText(product.category || ""),
    brand: { "@type": "Brand", name: "ELFORAT PHARMA" }, url,
    ...(images.length ? { image: images } : {}),
    offers: {
      "@type": "Offer", url, priceCurrency: "EGP", price: price.toFixed(2),
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: "الفرات فارما", url: siteUrl }
    }
  };
  const image = images[0] || (siteUrl + "/logo.png");
  const oldPriceHtml = Number.isFinite(oldPrice) && oldPrice > price && oldPrice > 0
    ? "<del>" + oldPrice.toFixed(2) + " ج.م</del>" : "";
  const sizeHtml = product.size ? "<p><strong>الحجم:</strong> " + escapeHtml(cleanText(product.size)) + "</p>" : "";
  return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + escapeHtml(name) + ' | الفرات فارما</title>' +
    '<meta name="description" content="' + escapeHtml(description.slice(0, 300)) + '">' +
    '<meta name="robots" content="index,follow,max-image-preview:large">' +
    '<link rel="canonical" href="' + escapeHtml(url) + '">' +
    '<meta property="og:type" content="product"><meta property="og:locale" content="ar_EG">' +
    '<meta property="og:site_name" content="الفرات فارما"><meta property="og:title" content="' + escapeHtml(name) + ' | الفرات فارما">' +
    '<meta property="og:description" content="' + escapeHtml(description.slice(0, 300)) + '">' +
    '<meta property="og:url" content="' + escapeHtml(url) + '"><meta property="og:image" content="' + escapeHtml(image) + '">' +
    '<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="' + escapeHtml(name) + ' | الفرات فارما">' +
    '<meta name="twitter:description" content="' + escapeHtml(description.slice(0, 300)) + '"><meta name="twitter:image" content="' + escapeHtml(image) + '">' +
    '<script type="application/ld+json">' + jsonForHtml(schema) + '</scr' + 'ipt>' +
    '<style>*{box-sizing:border-box}body{margin:0;background:#f8faf9;color:#173b2d;font-family:Tahoma,Arial,sans-serif;line-height:1.8}' +
    'main{max-width:1050px;margin:32px auto;padding:24px;background:#fff;border-radius:20px;box-shadow:0 8px 30px #173b2d12}' +
    'header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}a{color:#176044}.brand{font-weight:800;text-decoration:none}' +
    '.product{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:32px;align-items:center;margin-top:24px}' +
    '.product img{display:block;width:100%;height:auto;max-height:560px;object-fit:contain;border-radius:16px;background:#f7f8f6}' +
    'h1{font-size:clamp(26px,4vw,40px);line-height:1.35;margin:0 0 14px}.price{font-size:26px;font-weight:800;color:#176044}' +
    '.price del{font-size:17px;color:#8b9290;margin-inline-start:10px;font-weight:500}.cta{display:inline-block;margin-top:20px;padding:12px 26px;border-radius:999px;background:#176044;color:white;text-decoration:none;font-weight:700}' +
    '.muted{color:#64736c}footer{margin-top:24px;border-top:1px solid #e5ece8;padding-top:16px}@media(max-width:700px){main{margin:12px;padding:16px}.product{grid-template-columns:1fr;gap:20px}.product img{max-height:380px}}</style>' +
    '</head><body><main><header><a class="brand" href="' + siteUrl + '/">الفرات فارما | ELFORAT PHARMA</a><a href="' + siteUrl + '/">العودة إلى المتجر</a></header>' +
    '<article class="product"><div><img src="' + escapeHtml(image) + '" alt="' + escapeHtml(name) + '" width="600" height="600" loading="eager"></div>' +
    '<div><p class="muted">' + escapeHtml(cleanText(product.category || "منتجات العناية")) + '</p><h1>' + escapeHtml(name) + '</h1>' +
    '<p class="price">' + price.toFixed(2) + ' ج.م ' + oldPriceHtml + '</p><p>' + escapeHtml(description) + '</p>' + sizeHtml +
    '<a class="cta" href="' + escapeHtml(appUrl) + '">اطلب المنتج من المتجر</a><p class="muted">لإتمام الطلب، انتقل إلى متجر الفرات فارما.</p></div></article>' +
    '<footer><a href="' + siteUrl + '/">ELFORAT PHARMA</a> — متجر الفرات فارما الإلكتروني</footer></main></body></html>';
}

async function main() {
  const html = await fs.readFile(path.join(root, "index.html"), "utf8");
  const keyMatch = html.match(/var\s+key\s*=\s*['"]([^'"]+)['"]/);
  const anonKey = process.env.SUPABASE_ANON_KEY || (keyMatch && keyMatch[1]);
  if (!anonKey) throw new Error("Supabase anon key was not found.");
  const endpoint = new URL(supabaseUrl + "/rest/v1/products");
  endpoint.searchParams.set("select", "id,name,category,price,oldPrice,img,desc,size,images,gallery,is_active,stock");
  endpoint.searchParams.set("order", "priority.desc,id.asc");
  const response = await fetch(endpoint, { headers: { apikey: anonKey, Authorization: "Bearer " + anonKey } });
  if (!response.ok) throw new Error("Supabase products feed returned HTTP " + response.status);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error("Products feed did not return an array.");
  const active = rows.filter((p) => p && p.id != null && cleanText(p.name) &&
    p.is_active !== false && Number.isFinite(Number(p.price)) && Number(p.price) > 0);
  if (!active.length) throw new Error("No active priced products were returned; preserving the existing sitemap.");
  for (const product of active) {
    const directory = path.join(outputDir, "products", String(product.id));
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, "index.html"), productPage(product), "utf8");
  }
  const urls = [siteUrl + "/", ...active.map((p) => siteUrl + "/products/" + encodeURIComponent(String(p.id)) + "/")];
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((url) => "  <url><loc>" + escapeHtml(url) + "</loc></url>").join("\n") +
    "\n</urlset>\n";
  await fs.writeFile(path.join(outputDir, "sitemap.xml"), xml, "utf8");
  console.log("Generated " + active.length + " active product SEO pages and sitemap entries.");
}

main().catch((error) => {
  console.error("Product SEO page generation failed; the regular storefront deployment will continue:", error);
});
