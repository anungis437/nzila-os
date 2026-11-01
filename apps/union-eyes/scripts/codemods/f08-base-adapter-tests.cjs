const fs = require('fs')
const f = 'lib/services/cba-intelligence/adapters/__tests__/base-adapter.test.ts'
let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
const a = `  it("retries on 5xx responses and preserves custom headers", async () => {`
if (!s.includes(a)) throw new Error('anchor')
s = s.replace(a, `  // DEF-0B4-CBA-INGESTION-FETCHES-UNRESTRICTED-URLS
  it.each(["http://169.254.169.254/latest/meta-data", "http://localhost:5432/", "file:///etc/passwd", "http://10.0.0.1/admin"])(
    "refuses to fetch %s and makes no request",
    async (url) => {
      const adapter = new TestAdapter();
      await expect(adapter.fetchWithRetryPublic(url)).rejects.toMatchObject({ code: "OUTBOUND_URL_REFUSED" });
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("follows a redirect by hand and checks the next address again", async () => {
    const adapter = new TestAdapter();
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } }));

    await expect(adapter.fetchWithRetryPublic("https://example.com/start")).rejects.toMatchObject({ code: "OUTBOUND_URL_REFUSED" });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0]![1]).toMatchObject({ redirect: "manual" });
  });

  it("follows a redirect to another public address, resolving a relative location", async () => {
    const adapter = new TestAdapter();
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: "/final.pdf" } }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const response = await adapter.fetchWithRetryPublic("https://example.com/start");

    expect(response.status).toBe(200);
    expect(vi.mocked(fetch).mock.calls[1]![0]).toBe("https://example.com/final.pdf");
  });

  it("stops after three redirects", async () => {
    const adapter = new TestAdapter();
    vi.mocked(fetch).mockImplementation(async () => new Response(null, { status: 302, headers: { location: "https://example.com/again" } }));
    await expect(adapter.fetchWithRetryPublic("https://example.com/start")).rejects.toThrow("redirects");
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("refuses a source document larger than the allowed size", async () => {
    const adapter = new TestAdapter();
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, headers: { get: () => null }, text: async () => "x".repeat(10_000_001) } as Response);
    await expect(adapter.fetch("https://example.com", {})).rejects.toThrow("larger than the allowed size");
  });

` + a)
fs.writeFileSync(f, s)
console.log('ok')
