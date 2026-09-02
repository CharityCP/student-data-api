export function landingPage(url, datasets) {
  const origin = escapeHtml(url.origin);
  const exampleDataset = datasets[0]?.id ?? "your-dataset";
  const encodedDataset = encodeURIComponent(exampleDataset);
  const datasetsUrl = `${origin}/api/v1/datasets`;
  const recordsUrl = `${origin}/api/v1/datasets/${encodedDataset}/records?limit=10`;

  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="dark">
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><circle cx='8' cy='8' r='6' fill='%23b8f36b'/></svg>">
    <title>Student Data API · Deployment successful</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0d100c;
        --surface: #151a13;
        --line: #2c3428;
        --text: #f1f5ed;
        --muted: #9ba795;
        --accent: #b8f36b;
        --accent-ink: #17200e;
        --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        --sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        background: var(--bg);
        color: var(--text);
        font-family: var(--sans);
        -webkit-font-smoothing: antialiased;
      }

      body::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        background-image: linear-gradient(rgba(255,255,255,.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.018) 1px, transparent 1px);
        background-size: 48px 48px;
        mask-image: linear-gradient(to bottom, black, transparent 70%);
      }

      a { color: inherit; }

      .shell {
        width: min(1080px, calc(100% - 40px));
        margin: 0 auto;
      }

      header {
        height: 72px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid var(--line);
        font-family: var(--mono);
        font-size: 13px;
      }

      .brand { color: var(--text); text-decoration: none; }
      .online { color: var(--muted); display: flex; align-items: center; gap: 9px; }
      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--accent);
        box-shadow: 0 0 0 5px rgba(184, 243, 107, .08);
        animation: breathe 2.4s ease-in-out infinite;
      }

      main { padding-bottom: 72px; }

      .hero {
        min-height: 440px;
        display: grid;
        align-content: center;
        border-bottom: 1px solid var(--line);
        animation: arrive .65s cubic-bezier(.2,.8,.2,1) both;
      }

      .eyebrow {
        margin: 0 0 22px;
        color: var(--accent);
        font: 600 12px/1 var(--mono);
        letter-spacing: .13em;
        text-transform: uppercase;
      }

      h1 {
        max-width: 760px;
        margin: 0;
        font-size: clamp(50px, 8vw, 92px);
        line-height: .94;
        letter-spacing: -.065em;
      }

      .lede {
        max-width: 610px;
        margin: 28px 0 0;
        color: var(--muted);
        font-size: clamp(17px, 2vw, 20px);
        line-height: 1.55;
      }

      .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 34px; }
      .button {
        display: inline-flex;
        min-height: 44px;
        align-items: center;
        justify-content: center;
        padding: 0 18px;
        border: 1px solid var(--line);
        border-radius: 7px;
        color: var(--text);
        font: 600 13px/1 var(--mono);
        text-decoration: none;
        transition: border-color .18s ease, background .18s ease, transform .18s ease;
      }
      .button.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
      .button:hover { border-color: var(--accent); transform: translateY(-2px); }

      section { padding: 64px 0; border-bottom: 1px solid var(--line); }
      .section-head {
        display: grid;
        grid-template-columns: minmax(150px, 1fr) 2fr;
        gap: 32px;
        margin-bottom: 36px;
      }
      h2 { margin: 0; font-size: 24px; letter-spacing: -.025em; }
      .section-head p { max-width: 570px; margin: 0; color: var(--muted); line-height: 1.65; }

      .route {
        display: grid;
        grid-template-columns: 68px minmax(0, 1.5fr) 1fr;
        gap: 20px;
        align-items: center;
        padding: 22px 10px;
        margin: 0 -10px;
        border-top: 1px solid var(--line);
        text-decoration: none;
        transition: background .18s ease, padding .18s ease;
      }
      .route:last-child { border-bottom: 1px solid var(--line); }
      .route:hover { background: var(--surface); padding-left: 16px; }
      .method { color: var(--accent); font: 700 12px/1 var(--mono); }
      .path { overflow: hidden; color: var(--text); font: 14px/1.5 var(--mono); text-overflow: ellipsis; white-space: nowrap; }
      .purpose { color: var(--muted); font-size: 14px; }

      .examples { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
      .example { min-width: 0; padding: 28px 0; }
      .example + .example { margin-left: 32px; padding-left: 32px; border-left: 1px solid var(--line); }
      .example-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
      h3 { margin: 0; font-size: 15px; }
      .copy {
        border: 0;
        background: transparent;
        color: var(--muted);
        cursor: pointer;
        font: 12px/1 var(--mono);
      }
      .copy:hover { color: var(--accent); }
      pre {
        margin: 0;
        overflow-x: auto;
        color: #dce8d5;
        font: 13px/1.7 var(--mono);
        tab-size: 2;
      }
      .token { color: var(--accent); }

      footer {
        display: flex;
        justify-content: space-between;
        gap: 20px;
        padding: 28px 0;
        color: var(--muted);
        font: 12px/1.5 var(--mono);
      }
      footer a:hover { color: var(--accent); }

      @keyframes arrive { from { opacity: 0; transform: translateY(18px); } }
      @keyframes breathe { 50% { box-shadow: 0 0 0 9px rgba(184, 243, 107, 0); } }

      @media (max-width: 720px) {
        .shell { width: min(100% - 28px, 1080px); }
        .hero { min-height: 400px; }
        .section-head { grid-template-columns: 1fr; gap: 12px; }
        .route { grid-template-columns: 58px minmax(0, 1fr); }
        .purpose { display: none; }
        .examples { grid-template-columns: 1fr; }
        .example + .example { margin: 0; padding-left: 0; border-left: 0; border-top: 1px solid var(--line); }
        footer { flex-direction: column; }
      }

      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { animation: none !important; scroll-behavior: auto !important; transition: none !important; }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <header>
        <a class="brand" href="/">student-data-api</a>
        <span class="online"><span class="dot" aria-hidden="true"></span>Online</span>
      </header>

      <main>
        <div class="hero">
          <p class="eyebrow">Deployment successful</p>
          <h1>Your data API is live.</h1>
          <p class="lede">CSV datasets are ready as JSON. Use the routes below from Code.org or any browser-based frontend.</p>
          <div class="actions">
            <a class="button primary" href="${datasetsUrl}">View datasets →</a>
            <a class="button" href="https://github.com/rmccrear/my-data-api#use-from-a-frontend">Read the full guide</a>
          </div>
        </div>

        <section aria-labelledby="routes-title">
          <div class="section-head">
            <h2 id="routes-title">API routes</h2>
            <p>Start by discovering datasets, fetch records with optional <code>search</code>, <code>limit</code>, and <code>offset</code>, then ask grounded questions through chat.</p>
          </div>

          <a class="route" href="${datasetsUrl}">
            <span class="method">GET</span>
            <span class="path">/api/v1/datasets</span>
            <span class="purpose">List available datasets</span>
          </a>
          <a class="route" href="${recordsUrl}">
            <span class="method">GET</span>
            <span class="path">/api/v1/datasets/{dataset}/records</span>
            <span class="purpose">Search and fetch CSV records</span>
          </a>
          <div class="route">
            <span class="method">POST</span>
            <span class="path">/api/v1/datasets/{dataset}/chat</span>
            <span class="purpose">Ask a dataset-grounded question</span>
          </div>
        </section>

        <section aria-labelledby="start-title">
          <div class="section-head">
            <h2 id="start-title">Quick start</h2>
            <p>Copy one example into an async JavaScript function or module. The full README includes small reusable helpers for classroom projects.</p>
          </div>

          <div class="examples">
            <div class="example">
              <div class="example-head">
                <h3>Fetch records</h3>
                <button class="copy" type="button" data-copy="records-code">Copy</button>
              </div>
              <pre><code id="records-code"><span class="token">const</span> response = <span class="token">await</span> fetch(
  "${recordsUrl}"
);
<span class="token">const</span> data = <span class="token">await</span> response.json();
console.log(data.records);</code></pre>
            </div>

            <div class="example">
              <div class="example-head">
                <h3>Ask the dataset</h3>
                <button class="copy" type="button" data-copy="chat-code">Copy</button>
              </div>
              <pre><code id="chat-code"><span class="token">const</span> response = <span class="token">await</span> fetch(
  "${origin}/api/v1/datasets/${encodedDataset}/chat",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "What is in this dataset?" })
  }
);
<span class="token">const</span> data = <span class="token">await</span> response.json();
console.log(data.response);</code></pre>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <span>${datasets.length} dataset${datasets.length === 1 ? "" : "s"} configured · CORS enabled</span>
        <a href="https://github.com/rmccrear/my-data-api">GitHub documentation</a>
      </footer>
    </div>

    <script>
      document.querySelectorAll("[data-copy]").forEach((button) => {
        button.addEventListener("click", async () => {
          const code = document.getElementById(button.dataset.copy).innerText;
          await navigator.clipboard.writeText(code);
          button.textContent = "Copied";
          setTimeout(() => { button.textContent = "Copy"; }, 1400);
        });
      });
    </script>
  </body>
</html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character]);
}
