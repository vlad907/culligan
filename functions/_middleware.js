// Injects live SEO (title, meta description, JSON-LD) from the shared D1 database
// into the HTML on every request — so edits published from Culligan Tools go live
// instantly, no redeploy. Falls back to the page's own tags if the DB is unavailable.
export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);
  const htmlLikely = url.pathname === "/" || url.pathname.endsWith("/") || url.pathname.endsWith(".html");

  const response = await next();
  if (!htmlLikely) return response;
  const ct = response.headers.get("content-type") || "";
  if (!ct.includes("text/html")) return response;

  let seo = null;
  try {
    if (env.DB) seo = await env.DB.prepare("SELECT title, description, jsonld FROM site_seo WHERE id='home'").first();
  } catch (e) { /* fall back to the original page */ }
  if (!seo) return response;

  const rw = new HTMLRewriter()
    .on("title", { element(el) { if (seo.title) el.setInnerContent(seo.title); } })
    .on('meta[name="description"]', { element(el) { if (seo.description) el.setAttribute("content", seo.description); } })
    .on("head", { element(el) { if (seo.jsonld) el.append("\n" + seo.jsonld + "\n", { html: true }); } });

  const transformed = rw.transform(response);
  const headers = new Headers(transformed.headers);
  headers.set("cache-control", "public, max-age=60"); // let published changes propagate quickly
  return new Response(transformed.body, { status: transformed.status, headers });
}
