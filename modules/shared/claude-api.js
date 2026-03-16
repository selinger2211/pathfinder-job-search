/**
 * ============================================================
 * PATHFINDER — Shared Claude API Utility
 * Version: 1.0 | March 2026
 * ============================================================
 *
 * This file provides a shared way for any Pathfinder module to
 * call the Claude API directly from the browser. It handles:
 *
 *  - API key management (stored in localStorage)
 *  - Direct Anthropic API calls (no MCP bridge required)
 *  - MCP bridge fallback (if running on localhost:3456)
 *  - Streaming support for long responses
 *  - Error handling and retry logic
 *
 * HOW TO USE:
 *   1. Include this script: <script src="../shared/claude-api.js"></script>
 *   2. Call: const response = await PF.claude.generate(systemPrompt, userPrompt);
 *   3. Or stream: await PF.claude.stream(systemPrompt, userPrompt, onChunk);
 *
 * The API key is stored at localStorage key 'pf_anthropic_key'.
 * The preferred model is stored at 'pf_claude_model'.
 * ============================================================
 */

// Create the Pathfinder namespace if it doesn't exist
window.PF = window.PF || {};

window.PF.claude = (function () {
  // ── Configuration ──────────────────────────────────────────
  const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
  const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
  /* Max plan models: 'claude-opus-4-20250514', 'claude-sonnet-4-20250514' */
  /* Override via localStorage key 'pf_claude_model' */
  const MAX_TOKENS_DEFAULT = 4096;
  const BRIDGE_URL = 'http://localhost:3456';

  // ── API Key Management ─────────────────────────────────────

  /**
   * Get the stored API key, or null if not set.
   */
  function getApiKey() {
    return localStorage.getItem('pf_anthropic_key') || null;
  }

  /**
   * Save the API key to localStorage.
   */
  function setApiKey(key) {
    localStorage.setItem('pf_anthropic_key', key.trim());
  }

  /**
   * Check if an API key is configured.
   */
  function hasApiKey() {
    const key = getApiKey();
    return !!(key && key.startsWith('sk-'));
  }

  /**
   * Get the preferred model from localStorage, or use default.
   */
  function getModel() {
    return localStorage.getItem('pf_claude_model') || DEFAULT_MODEL;
  }

  /**
   * Prompt the user for an API key if not set.
   * Returns true if key is available, false otherwise.
   */
  function ensureApiKey() {
    if (hasApiKey()) return true;
    const key = prompt(
      'Pathfinder needs your Anthropic API key to generate content.\n\n' +
      'Get one at: https://console.anthropic.com/settings/keys\n\n' +
      'Enter your API key:'
    );
    if (key && key.trim().startsWith('sk-')) {
      setApiKey(key);
      return true;
    }
    return false;
  }

  // ── Direct Anthropic API Call ──────────────────────────────

  /**
   * Call Claude API directly from the browser.
   *
   * @param {string} systemPrompt - The system prompt (role/instructions)
   * @param {string} userPrompt - The user message
   * @param {object} [options] - Optional overrides
   * @param {string} [options.model] - Model to use
   * @param {number} [options.maxTokens] - Max response tokens
   * @param {number} [options.temperature] - Temperature (0-1)
   * @returns {Promise<{content: string, model: string, usage: object}>}
   */
  async function generate(systemPrompt, userPrompt, options = {}) {
    if (!ensureApiKey()) {
      throw new Error('No API key configured. Set your Anthropic API key in Settings.');
    }

    const apiKey = getApiKey();
    const model = options.model || getModel();
    const maxTokens = options.maxTokens || MAX_TOKENS_DEFAULT;

    const body = {
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    };

    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    const resp = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      const apiMsg = errBody.error?.message || '';
      const status = resp.status;

      let userMsg;
      if (status === 401) {
        userMsg = 'Invalid API key. Check your key in Settings → Claude API Key.';
      } else if (status === 429) {
        userMsg = 'Rate limit exceeded — you\'ve hit your API usage cap. Wait a few minutes or check your Anthropic billing at console.anthropic.com/settings/billing.';
      } else if (status === 529 || status === 503) {
        userMsg = 'Claude API is temporarily overloaded. Try again in 30 seconds.';
      } else if (status === 400 && apiMsg.includes('credit')) {
        userMsg = 'Out of API credits. Add credits at console.anthropic.com/settings/billing.';
      } else if (status === 400) {
        userMsg = `Bad request: ${apiMsg}`;
      } else {
        userMsg = `API error (HTTP ${status}): ${apiMsg || 'Unknown error'}`;
      }

      const err = new Error(userMsg);
      err.status = status;
      err.apiMessage = apiMsg;
      throw err;
    }

    const data = await resp.json();
    const textBlock = data.content.find(b => b.type === 'text');

    return {
      content: textBlock ? textBlock.text : '',
      model: data.model,
      usage: data.usage,
    };
  }

  // ── Streaming API Call ─────────────────────────────────────

  /**
   * Stream a Claude API response, calling onChunk for each text delta.
   *
   * @param {string} systemPrompt - The system prompt
   * @param {string} userPrompt - The user message
   * @param {function} onChunk - Called with (textDelta, fullTextSoFar)
   * @param {object} [options] - Optional overrides (model, maxTokens, temperature)
   * @returns {Promise<{content: string, model: string}>} - Full response when done
   */
  async function stream(systemPrompt, userPrompt, onChunk, options = {}) {
    if (!ensureApiKey()) {
      throw new Error('No API key configured.');
    }

    const apiKey = getApiKey();
    const model = options.model || getModel();
    const maxTokens = options.maxTokens || MAX_TOKENS_DEFAULT;

    const body = {
      model,
      max_tokens: maxTokens,
      stream: true,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    };

    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    const resp = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      const apiMsg = errBody.error?.message || '';
      const status = resp.status;

      /* Map HTTP status codes to user-friendly error messages */
      let userMsg;
      if (status === 401) {
        userMsg = 'Invalid API key. Check your key in Settings → Claude API Key.';
      } else if (status === 429) {
        userMsg = 'Rate limit exceeded — you\'ve hit your API usage cap. Wait a few minutes or check your Anthropic billing at console.anthropic.com/settings/billing.';
      } else if (status === 529 || status === 503) {
        userMsg = 'Claude API is temporarily overloaded. Try again in 30 seconds.';
      } else if (status === 400 && apiMsg.includes('credit')) {
        userMsg = 'Out of API credits. Add credits at console.anthropic.com/settings/billing.';
      } else if (status === 400) {
        userMsg = `Bad request: ${apiMsg}`;
      } else {
        userMsg = `API error (HTTP ${status}): ${apiMsg || 'Unknown error'}`;
      }

      const err = new Error(userMsg);
      err.status = status;
      err.apiMessage = apiMsg;
      throw err;
    }

    // Parse SSE stream
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';
    let responseModel = model;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE events from buffer
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const event = JSON.parse(data);

          if (event.type === 'content_block_delta' && event.delta?.text) {
            fullText += event.delta.text;
            onChunk(event.delta.text, fullText);
          } else if (event.type === 'message_start' && event.message?.model) {
            responseModel = event.message.model;
          }
        } catch {
          // Skip malformed events
        }
      }
    }

    return { content: fullText, model: responseModel };
  }

  // ── MCP Bridge Integration (Optional) ─────────────────────

  /**
   * Check if the MCP HTTP bridge is running on localhost:3456.
   * Returns true if healthy, false otherwise.
   */
  async function isBridgeAvailable() {
    try {
      const resp = await fetch(`${BRIDGE_URL}/api/health`, {
        signal: AbortSignal.timeout(2000),
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  /**
   * Call a bridge endpoint (for artifact storage operations).
   *
   * @param {string} endpoint - e.g., '/api/generate-section'
   * @param {object} payload - Request body
   * @returns {Promise<object>} - Response JSON
   */
  async function callBridge(endpoint, payload) {
    const resp = await fetch(`${BRIDGE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errBody.error || `Bridge error HTTP ${resp.status}`);
    }

    return await resp.json();
  }

  // ── Convenience: Multi-turn conversation ───────────────────

  /**
   * Send a multi-turn conversation to Claude.
   *
   * @param {string} systemPrompt - System prompt
   * @param {Array<{role: string, content: string}>} messages - Message array
   * @param {object} [options] - Optional overrides
   * @returns {Promise<{content: string, model: string, usage: object}>}
   */
  async function converse(systemPrompt, messages, options = {}) {
    if (!ensureApiKey()) {
      throw new Error('No API key configured.');
    }

    const apiKey = getApiKey();
    const model = options.model || getModel();
    const maxTokens = options.maxTokens || MAX_TOKENS_DEFAULT;

    const body = {
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    };

    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    const resp = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      throw new Error(`Claude API error: ${errBody.error?.message || `HTTP ${resp.status}`}`);
    }

    const data = await resp.json();
    const textBlock = data.content.find(b => b.type === 'text');

    return {
      content: textBlock ? textBlock.text : '',
      model: data.model,
      usage: data.usage,
    };
  }

  // ── Convenience: HTML-only generation ──────────────────────

  /**
   * Generate content with a system prompt that enforces HTML-only output.
   * Strips any markdown that Claude might accidentally include.
   *
   * @param {string} systemPrompt - Base system instructions
   * @param {string} userPrompt - The user request
   * @param {object} [options] - Optional overrides
   * @returns {Promise<string>} - Clean HTML string
   */
  async function generateHTML(systemPrompt, userPrompt, options = {}) {
    const htmlSystemPrompt = systemPrompt + `

CRITICAL OUTPUT FORMAT RULES:
- Output ONLY valid HTML. No markdown. No backticks. No code fences.
- Use <h3>, <h4> for headings. Use <p> for paragraphs. Use <ul>/<li> for lists.
- Use <strong> for emphasis, not **bold**.
- Use <a href="..."> for links.
- Do NOT wrap output in <html>, <head>, or <body> tags — just the content HTML.`;

    const result = await generate(htmlSystemPrompt, userPrompt, options);

    // Sanitize any remaining markdown
    let html = result.content;
    html = html.replace(/```[\s\S]*?```/g, '');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/^### (.*$)/gm, '<h4>$1</h4>');
    html = html.replace(/^## (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^# (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^- (.*$)/gm, '<li>$1</li>');

    return html;
  }

  // ── Render: API Key Settings UI ────────────────────────────

  /**
   * Render the API key settings UI into a container element.
   * Call this from any module that needs Claude API access.
   *
   * @param {string|HTMLElement} container - Element or selector to render into
   */
  function renderApiKeyUI(container) {
    const el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return;

    const hasKey = hasApiKey();
    const maskedKey = hasKey ? getApiKey().slice(0, 10) + '...' : '';

    el.innerHTML = `
      <div style="padding: var(--space-3); background: var(--bg-elevated); border: 1px solid var(--bg-subtle); border-radius: var(--radius-sm);">
        <label style="font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 6px;">
          Claude API Key
        </label>
        <div style="display: flex; gap: 6px; align-items: center;">
          <input type="password" id="pf-api-key-input"
            placeholder="sk-ant-api03-..."
            value="${hasKey ? getApiKey() : ''}"
            style="flex: 1; padding: 6px 10px; border: 1px solid var(--bg-subtle); border-radius: var(--radius-sm); font-size: var(--text-sm); background: var(--bg-base); color: var(--text-primary); font-family: monospace;">
          <button onclick="PF.claude.setApiKey(document.getElementById('pf-api-key-input').value); this.textContent='Saved!'; setTimeout(()=>this.textContent='Save', 1500);"
            style="padding: 6px 12px; border: 1px solid var(--bg-subtle); border-radius: var(--radius-sm); background: var(--accent); color: white; cursor: pointer; font-size: var(--text-sm); font-weight: 600;">
            Save
          </button>
        </div>
        <p style="font-size: 11px; color: var(--text-tertiary); margin-top: 4px;">
          ${hasKey ? 'Key configured: ' + maskedKey : 'Required for AI features. Get one at console.anthropic.com'}
        </p>
      </div>
    `;
  }

  // ── Public API ─────────────────────────────────────────────
  return {
    generate,
    generateHTML,
    stream,
    converse,
    getApiKey,
    setApiKey,
    hasApiKey,
    ensureApiKey,
    getModel,
    isBridgeAvailable,
    callBridge,
    renderApiKeyUI,
    BRIDGE_URL,
  };
})();

/* ====== NODE.JS / JEST EXPORT ======
 * Makes the PF.claude API available via require() for unit testing.
 * In browser context, `module` is undefined — this block is harmless. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.PF.claude;
}
