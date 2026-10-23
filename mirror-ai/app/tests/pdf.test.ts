import assert from "node:assert/strict";
import { test } from "node:test";
import { findChrome, renderReportPdf, reportDocument } from "../src/pdf.ts";
import { startServer } from "../src/server.ts";

test("the print document loads the page's stylesheet from the server and runs no script", () => {
  const html = reportDocument("<h1>Audit</h1>", "Audit <Shop>", "http://127.0.0.1:4173/");
  assert.match(html, /<base href="http:\/\/127\.0\.0\.1:4173\/" \/>/);
  assert.match(html, /<link rel="stylesheet" href="app\.css" \/>/);
  assert.match(html, /Content-Security-Policy" content="script-src 'none'"/);
  assert.match(html, /<title>Audit &lt;Shop&gt;<\/title>/);
  assert.match(html, /<article id="report"><h1>Audit<\/h1><\/article>/);
});

test("the pdf route refuses an empty report and points at print when Chrome is missing", async () => {
  const prior = process.env.MIRROR_AI_CHROME;
  process.env.MIRROR_AI_CHROME = "/nonexistent/chrome";
  const server = await startServer(0);
  try {
    const post = (body: unknown) =>
      fetch(new URL("api/pdf", server.url), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    const empty = await post({ html: "  " });
    assert.equal(empty.status, 400);
    const missing = await post({ html: "<h1>Audit</h1>" });
    assert.equal(missing.status, 501);
    assert.equal((await missing.json()).fallback, "print");
  } finally {
    await server.close();
    if (prior === undefined) delete process.env.MIRROR_AI_CHROME;
    else process.env.MIRROR_AI_CHROME = prior;
  }
});

const chrome = findChrome();

test("Chrome prints the report as a real PDF", { skip: chrome ? false : "no Chrome on this machine" }, async () => {
  const pdf = await renderReportPdf(chrome, reportDocument("<h1>Audit</h1><p>Body text.</p>", "Audit", "http://127.0.0.1:9/"));
  assert.equal(pdf.subarray(0, 5).toString("latin1"), "%PDF-");
});
