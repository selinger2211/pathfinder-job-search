/* ====================================================================
 * UNIT TESTS — claude-api.js (Shared Claude API Utility)
 * ====================================================================
 * Tests API key management, error mapping, generate/stream/converse,
 * HTML generation with markdown sanitization, and bridge integration.
 *
 * Run: npm test -- --testPathPatterns=claude-api
 * Coverage: npm test -- --coverage --testPathPatterns=claude-api
 * ==================================================================== */

const path = require('path');
const { TextEncoder, TextDecoder } = require('util');

/* jsdom doesn't provide TextEncoder/TextDecoder — polyfill for streaming tests */
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

/* ── Setup ── */
beforeEach(() => {
  // Clean localStorage and globals before each test
  localStorage.clear();
  delete window.PF;

  // Reset fetch mock
  global.fetch = jest.fn();

  // Reset prompt mock
  global.prompt = jest.fn();

  // Re-require the module fresh (clears cached module)
  jest.resetModules();
  require(path.join(__dirname, '..', 'claude-api.js'));
});

afterEach(() => {
  jest.restoreAllMocks();
});

/* Helper: get the API module */
function api() {
  return window.PF.claude;
}

/* Helper: mock a successful Messages API response */
function mockApiResponse(text, model = 'claude-sonnet-4-20250514') {
  return {
    ok: true,
    json: () => Promise.resolve({
      content: [{ type: 'text', text }],
      model,
      usage: { input_tokens: 10, output_tokens: 20 },
    }),
  };
}

/* Helper: mock an error API response */
function mockApiError(status, message = '') {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ error: { message } }),
  };
}

/* ====== Module Loading ====== */
describe('Module loading', () => {
  test('creates window.PF.claude namespace', () => {
    expect(window.PF).toBeDefined();
    expect(window.PF.claude).toBeDefined();
  });

  test('exposes all public methods', () => {
    const methods = [
      'generate', 'generateHTML', 'stream', 'converse',
      'getApiKey', 'setApiKey', 'hasApiKey', 'ensureApiKey',
      'getModel', 'isBridgeAvailable', 'callBridge', 'renderApiKeyUI',
    ];
    methods.forEach(m => {
      expect(typeof api()[m]).toBe('function');
    });
  });

  test('exposes BRIDGE_URL constant', () => {
    expect(api().BRIDGE_URL).toBe('http://localhost:3456');
  });
});

/* ====== API Key Management ====== */
describe('API Key Management', () => {
  test('getApiKey returns null when no key stored', () => {
    expect(api().getApiKey()).toBeNull();
  });

  test('setApiKey stores key in localStorage', () => {
    api().setApiKey('sk-ant-api03-test123');
    expect(localStorage.getItem('pf_anthropic_key')).toBe('sk-ant-api03-test123');
  });

  test('setApiKey trims whitespace', () => {
    api().setApiKey('  sk-ant-api03-test123  ');
    expect(localStorage.getItem('pf_anthropic_key')).toBe('sk-ant-api03-test123');
  });

  test('getApiKey retrieves stored key', () => {
    localStorage.setItem('pf_anthropic_key', 'sk-ant-api03-abc');
    // Re-require to pick up localStorage
    jest.resetModules();
    require(path.join(__dirname, '..', 'claude-api.js'));
    expect(api().getApiKey()).toBe('sk-ant-api03-abc');
  });

  test('hasApiKey returns false when no key stored', () => {
    expect(api().hasApiKey()).toBe(false);
  });

  test('hasApiKey returns false for non-sk key', () => {
    localStorage.setItem('pf_anthropic_key', 'bad-key');
    jest.resetModules();
    require(path.join(__dirname, '..', 'claude-api.js'));
    expect(api().hasApiKey()).toBe(false);
  });

  test('hasApiKey returns true for valid sk- prefixed key', () => {
    api().setApiKey('sk-ant-api03-valid');
    expect(api().hasApiKey()).toBe(true);
  });

  test('getModel returns default model when none stored', () => {
    expect(api().getModel()).toBe('claude-sonnet-4-20250514');
  });

  test('getModel returns stored model preference', () => {
    localStorage.setItem('pf_claude_model', 'claude-opus-4-20250514');
    jest.resetModules();
    require(path.join(__dirname, '..', 'claude-api.js'));
    expect(api().getModel()).toBe('claude-opus-4-20250514');
  });
});

/* ====== ensureApiKey ====== */
describe('ensureApiKey', () => {
  test('returns true when key already exists', () => {
    api().setApiKey('sk-ant-api03-existing');
    expect(api().ensureApiKey()).toBe(true);
  });

  test('prompts user and stores valid key', () => {
    global.prompt = jest.fn().mockReturnValue('sk-ant-api03-fromuser');
    expect(api().ensureApiKey()).toBe(true);
    expect(api().getApiKey()).toBe('sk-ant-api03-fromuser');
    expect(global.prompt).toHaveBeenCalledTimes(1);
  });

  test('returns false when user cancels prompt', () => {
    global.prompt = jest.fn().mockReturnValue(null);
    expect(api().ensureApiKey()).toBe(false);
  });

  test('returns false when user enters invalid key', () => {
    global.prompt = jest.fn().mockReturnValue('not-a-valid-key');
    expect(api().ensureApiKey()).toBe(false);
  });
});

/* ====== generate() ====== */
describe('generate', () => {
  beforeEach(() => {
    api().setApiKey('sk-ant-api03-test');
  });

  test('calls Anthropic API with correct parameters', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockApiResponse('Hello!'));

    await api().generate('You are helpful.', 'Say hello');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(opts.method).toBe('POST');

    const body = JSON.parse(opts.body);
    expect(body.system).toBe('You are helpful.');
    expect(body.messages).toEqual([{ role: 'user', content: 'Say hello' }]);
    expect(body.model).toBe('claude-sonnet-4-20250514');
    expect(body.max_tokens).toBe(4096);
  });

  test('sends required headers including dangerous-direct-browser-access', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockApiResponse('Hi'));

    await api().generate('sys', 'user');

    const headers = global.fetch.mock.calls[0][1].headers;
    expect(headers['x-api-key']).toBe('sk-ant-api03-test');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(headers['Content-Type']).toBe('application/json');
  });

  test('returns content, model, and usage', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockApiResponse('Response text', 'claude-test'));

    const result = await api().generate('sys', 'user');

    expect(result.content).toBe('Response text');
    expect(result.model).toBe('claude-test');
    expect(result.usage).toEqual({ input_tokens: 10, output_tokens: 20 });
  });

  test('uses custom model and temperature from options', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockApiResponse('ok'));

    await api().generate('sys', 'user', {
      model: 'claude-opus-4-20250514',
      maxTokens: 8192,
      temperature: 0.5,
    });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.model).toBe('claude-opus-4-20250514');
    expect(body.max_tokens).toBe(8192);
    expect(body.temperature).toBe(0.5);
  });

  test('returns empty string when no text block in response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        content: [{ type: 'tool_use', id: 'abc' }],
        model: 'test',
        usage: {},
      }),
    });

    const result = await api().generate('sys', 'user');
    expect(result.content).toBe('');
  });

  test('throws when no API key configured', async () => {
    localStorage.clear();
    jest.resetModules();
    require(path.join(__dirname, '..', 'claude-api.js'));
    global.prompt = jest.fn().mockReturnValue(null);

    await expect(api().generate('sys', 'user'))
      .rejects.toThrow('No API key configured');
  });
});

/* ====== Error Status Code Mapping ====== */
describe('generate — error handling', () => {
  beforeEach(() => {
    api().setApiKey('sk-ant-api03-test');
  });

  test('401 → invalid API key message', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockApiError(401));
    await expect(api().generate('sys', 'user'))
      .rejects.toThrow(/Invalid API key/);
  });

  test('429 → rate limit message', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockApiError(429));
    await expect(api().generate('sys', 'user'))
      .rejects.toThrow(/Rate limit exceeded/);
  });

  test('529 → overloaded message', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockApiError(529));
    await expect(api().generate('sys', 'user'))
      .rejects.toThrow(/temporarily overloaded/);
  });

  test('503 → overloaded message', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockApiError(503));
    await expect(api().generate('sys', 'user'))
      .rejects.toThrow(/temporarily overloaded/);
  });

  test('400 with credit message → out of credits', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockApiError(400, 'insufficient credit balance'));
    await expect(api().generate('sys', 'user'))
      .rejects.toThrow(/Out of API credits/);
  });

  test('400 without credit → bad request with API message', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockApiError(400, 'invalid model'));
    await expect(api().generate('sys', 'user'))
      .rejects.toThrow(/Bad request: invalid model/);
  });

  test('500 → generic error with status code', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockApiError(500, 'internal'));
    await expect(api().generate('sys', 'user'))
      .rejects.toThrow(/API error \(HTTP 500\)/);
  });

  test('error includes status and apiMessage properties', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockApiError(401, 'bad key'));
    try {
      await api().generate('sys', 'user');
      throw new Error('Should have thrown');
    } catch (err) {
      expect(err.status).toBe(401);
      expect(err.apiMessage).toBe('bad key');
    }
  });

  test('handles non-JSON error response body', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('not json')),
    });
    await expect(api().generate('sys', 'user'))
      .rejects.toThrow(/API error \(HTTP 500\)/);
  });
});

/* ====== generateHTML ====== */
describe('generateHTML', () => {
  beforeEach(() => {
    api().setApiKey('sk-ant-api03-test');
  });

  test('appends HTML format instructions to system prompt', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockApiResponse('<p>Hello</p>'));

    await api().generateHTML('Be helpful.', 'Generate content');

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.system).toContain('Be helpful.');
    expect(body.system).toContain('CRITICAL OUTPUT FORMAT RULES');
    expect(body.system).toContain('No markdown');
  });

  test('returns clean HTML string', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockApiResponse('<p>Clean HTML</p>'));

    const html = await api().generateHTML('sys', 'user');
    expect(html).toBe('<p>Clean HTML</p>');
  });

  test('strips markdown code fences', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockApiResponse('```html\n<p>Code</p>\n```')
    );

    const html = await api().generateHTML('sys', 'user');
    expect(html).not.toContain('```');
  });

  test('converts **bold** to <strong>', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockApiResponse('**important text**')
    );

    const html = await api().generateHTML('sys', 'user');
    expect(html).toContain('<strong>important text</strong>');
    expect(html).not.toContain('**');
  });

  test('converts *italic* to <em>', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockApiResponse('*emphasized*')
    );

    const html = await api().generateHTML('sys', 'user');
    expect(html).toContain('<em>emphasized</em>');
  });

  test('converts markdown headings to HTML tags', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockApiResponse('# Heading 1\n## Heading 2\n### Heading 3')
    );

    const html = await api().generateHTML('sys', 'user');
    expect(html).toContain('<h3>Heading 1</h3>');
    expect(html).toContain('<h3>Heading 2</h3>');
    expect(html).toContain('<h4>Heading 3</h4>');
  });

  test('converts markdown list items to <li>', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockApiResponse('- Item one\n- Item two')
    );

    const html = await api().generateHTML('sys', 'user');
    expect(html).toContain('<li>Item one</li>');
    expect(html).toContain('<li>Item two</li>');
  });
});

/* ====== converse ====== */
describe('converse', () => {
  beforeEach(() => {
    api().setApiKey('sk-ant-api03-test');
  });

  test('sends multi-turn messages array', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockApiResponse('Reply'));

    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
      { role: 'user', content: 'How are you?' },
    ];

    await api().converse('System prompt', messages);

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.messages).toEqual(messages);
    expect(body.system).toBe('System prompt');
  });

  test('returns content, model, usage', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockApiResponse('Fine thanks'));

    const result = await api().converse('sys', [{ role: 'user', content: 'hi' }]);
    expect(result.content).toBe('Fine thanks');
    expect(result.model).toBeDefined();
  });

  test('throws on API error', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockApiError(500, 'boom'));

    await expect(
      api().converse('sys', [{ role: 'user', content: 'hi' }])
    ).rejects.toThrow(/Claude API error/);
  });
});

/* ====== stream ====== */
describe('stream', () => {
  beforeEach(() => {
    api().setApiKey('sk-ant-api03-test');
  });

  test('parses SSE events and calls onChunk', async () => {
    const sseData = [
      'event: message_start\ndata: {"type":"message_start","message":{"model":"claude-test"}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"text":"Hello"}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"text":" World"}}\n\n',
      'data: [DONE]\n\n',
    ].join('');

    const encoder = new TextEncoder();
    let readCount = 0;
    const chunks = [encoder.encode(sseData)];

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: () => {
            if (readCount < chunks.length) {
              return Promise.resolve({ done: false, value: chunks[readCount++] });
            }
            return Promise.resolve({ done: true });
          },
        }),
      },
    });

    const receivedChunks = [];
    const result = await api().stream('sys', 'user', (delta, full) => {
      receivedChunks.push({ delta, full });
    });

    expect(receivedChunks).toHaveLength(2);
    expect(receivedChunks[0].delta).toBe('Hello');
    expect(receivedChunks[0].full).toBe('Hello');
    expect(receivedChunks[1].delta).toBe(' World');
    expect(receivedChunks[1].full).toBe('Hello World');
    expect(result.content).toBe('Hello World');
    expect(result.model).toBe('claude-test');
  });

  test('sends stream: true in request body', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: () => Promise.resolve({ done: true }),
        }),
      },
    });

    await api().stream('sys', 'user', () => {});

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.stream).toBe(true);
  });

  test('throws with mapped error on HTTP failure', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockApiError(429));

    await expect(api().stream('sys', 'user', () => {}))
      .rejects.toThrow(/Rate limit exceeded/);
  });

  test('skips malformed SSE events gracefully', async () => {
    const sseData = [
      'data: {"type":"content_block_delta","delta":{"text":"OK"}}\n\n',
      'data: {BROKEN JSON}\n\n',
      'data: {"type":"content_block_delta","delta":{"text":"!"}}\n\n',
    ].join('');

    const encoder = new TextEncoder();
    let readCount = 0;
    const chunks = [encoder.encode(sseData)];

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: () => {
            if (readCount < chunks.length) {
              return Promise.resolve({ done: false, value: chunks[readCount++] });
            }
            return Promise.resolve({ done: true });
          },
        }),
      },
    });

    const result = await api().stream('sys', 'user', () => {});
    expect(result.content).toBe('OK!');
  });
});

/* ====== isBridgeAvailable ====== */
describe('isBridgeAvailable', () => {
  test('returns true when bridge responds OK', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    const result = await api().isBridgeAvailable();
    expect(result).toBe(true);
  });

  test('returns false when bridge is down', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await api().isBridgeAvailable();
    expect(result).toBe(false);
  });

  test('returns false when bridge responds with error', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    const result = await api().isBridgeAvailable();
    expect(result).toBe(false);
  });
});

/* ====== callBridge ====== */
describe('callBridge', () => {
  test('sends POST to bridge endpoint with payload', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: 'success' }),
    });

    const result = await api().callBridge('/api/test', { data: 'value' });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3456/api/test',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
    expect(result).toEqual({ result: 'success' });
  });

  test('throws on bridge error response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Something broke' }),
    });

    await expect(api().callBridge('/api/test', {}))
      .rejects.toThrow('Something broke');
  });
});

/* ====== renderApiKeyUI ====== */
describe('renderApiKeyUI', () => {
  test('renders input and save button into container element', () => {
    const container = document.createElement('div');
    api().renderApiKeyUI(container);

    expect(container.querySelector('#pf-api-key-input')).not.toBeNull();
    expect(container.querySelector('button')).not.toBeNull();
    expect(container.innerHTML).toContain('Claude API Key');
  });

  test('renders into element found by selector', () => {
    const container = document.createElement('div');
    container.id = 'settings-panel';
    document.body.appendChild(container);

    api().renderApiKeyUI('#settings-panel');

    expect(container.querySelector('#pf-api-key-input')).not.toBeNull();
    document.body.removeChild(container);
  });

  test('shows masked key when key is configured', () => {
    api().setApiKey('sk-ant-api03-longkeyhere');
    const container = document.createElement('div');
    api().renderApiKeyUI(container);

    expect(container.innerHTML).toContain('Key configured');
    expect(container.innerHTML).toContain('sk-ant-api');
  });

  test('shows setup instructions when no key configured', () => {
    const container = document.createElement('div');
    api().renderApiKeyUI(container);

    expect(container.innerHTML).toContain('Required for AI features');
    expect(container.innerHTML).toContain('console.anthropic.com');
  });

  test('handles null selector gracefully', () => {
    expect(() => api().renderApiKeyUI('#nonexistent')).not.toThrow();
  });
});

/* ====== stream — additional coverage ====== */
describe('stream — additional branches', () => {
  test('throws when no API key configured', async () => {
    localStorage.clear();
    jest.resetModules();
    require(path.join(__dirname, '..', 'claude-api.js'));
    global.prompt = jest.fn().mockReturnValue(null);
    await expect(api().stream('sys', 'user', () => {}))
      .rejects.toThrow('No API key configured');
  });

  test('passes temperature option in request body', async () => {
    api().setApiKey('sk-ant-api03-test');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: { getReader: () => ({ read: () => Promise.resolve({ done: true }) }) },
    });
    await api().stream('sys', 'user', () => {}, { temperature: 0.7 });
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.temperature).toBe(0.7);
  });

  test('maps 401 error in stream', async () => {
    api().setApiKey('sk-ant-api03-test');
    global.fetch = jest.fn().mockResolvedValue(mockApiError(401));
    await expect(api().stream('sys', 'user', () => {}))
      .rejects.toThrow(/Invalid API key/);
  });

  test('maps 429 error in stream', async () => {
    api().setApiKey('sk-ant-api03-test');
    global.fetch = jest.fn().mockResolvedValue(mockApiError(429));
    await expect(api().stream('sys', 'user', () => {}))
      .rejects.toThrow(/Rate limit exceeded/);
  });

  test('maps 529 error in stream', async () => {
    api().setApiKey('sk-ant-api03-test');
    global.fetch = jest.fn().mockResolvedValue(mockApiError(529));
    await expect(api().stream('sys', 'user', () => {}))
      .rejects.toThrow(/temporarily overloaded/);
  });

  test('maps 400 with credit error in stream', async () => {
    api().setApiKey('sk-ant-api03-test');
    global.fetch = jest.fn().mockResolvedValue(mockApiError(400, 'insufficient credit balance'));
    await expect(api().stream('sys', 'user', () => {}))
      .rejects.toThrow(/Out of API credits/);
  });

  test('maps generic 400 error in stream', async () => {
    api().setApiKey('sk-ant-api03-test');
    global.fetch = jest.fn().mockResolvedValue(mockApiError(400, 'bad request'));
    await expect(api().stream('sys', 'user', () => {}))
      .rejects.toThrow(/Bad request/);
  });

  test('maps other status codes in stream', async () => {
    api().setApiKey('sk-ant-api03-test');
    global.fetch = jest.fn().mockResolvedValue(mockApiError(500));
    await expect(api().stream('sys', 'user', () => {}))
      .rejects.toThrow(/API error \(HTTP 500\)/);
  });
});

/* ====== converse — additional coverage ====== */
describe('converse — additional branches', () => {
  test('throws when no API key configured', async () => {
    localStorage.clear();
    jest.resetModules();
    require(path.join(__dirname, '..', 'claude-api.js'));
    global.prompt = jest.fn().mockReturnValue(null);
    await expect(api().converse('sys', [{ role: 'user', content: 'hi' }]))
      .rejects.toThrow('No API key configured');
  });

  test('passes temperature option in request body', async () => {
    api().setApiKey('sk-ant-api03-test');
    global.fetch = jest.fn().mockResolvedValue(mockApiResponse('ok'));
    await api().converse('sys', [{ role: 'user', content: 'hi' }], { temperature: 0.3 });
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.temperature).toBe(0.3);
  });
});
