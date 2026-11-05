const fs = require('fs')
const f = 'lib/social-media/__tests__/social-media-clients-full.test.ts'
let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
const a = `  it('createOrganizationPostWithLink with and without optional fields', async () => {`
if (!s.includes(a)) throw new Error('anchor')
s = s.replace(a, `  // DEF-0B11-SOC-X-MEDIA-URL-IS-FETCHED-BY-THE-SERVER-WITH-ONLY-A-SCHEME-CHECK: the same class on the LinkedIn path.
  describe('LinkedIn image fetch from a caller-supplied URL', () => {
    const registered = () =>
      ok({
        value: {
          asset: 'urn:li:asset:1',
          uploadMechanism: { 'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': { uploadUrl: 'https://upload.linkedin.com/x' } },
        },
      });

    it('follows no redirect when it fetches the image', async () => {
      mockFetch.mockResolvedValueOnce(registered()).mockResolvedValueOnce(ok({}, { 'content-type': 'image/jpeg' })).mockResolvedValueOnce(ok({})).mockResolvedValueOnce(ok({ id: 'shareImg' }));
      await client.createOrganizationPostWithImage('o1', { text: 'caption', imageUrl: 'https://cdn.example.com/img.jpg' });
      expect(mockFetch).toHaveBeenNthCalledWith(2, 'https://cdn.example.com/img.jpg', { redirect: 'error' });
    });

    it('refuses a response that is not an image, and uploads nothing', async () => {
      mockFetch.mockResolvedValueOnce(registered()).mockResolvedValueOnce(ok({}, { 'content-type': 'text/html' }));
      await expect(
        client.createOrganizationPostWithImage('o1', { text: 't', imageUrl: 'https://cdn.example.com/page' }),
      ).rejects.toThrow('not an image');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('refuses an image larger than 8 MB', async () => {
      mockFetch.mockResolvedValueOnce(registered()).mockResolvedValueOnce({ ...ok({}, { 'content-type': 'image/png' }), arrayBuffer: async () => new ArrayBuffer(8 * 1024 * 1024 + 1) });
      await expect(
        client.createOrganizationPostWithImage('o1', { text: 't', imageUrl: 'https://cdn.example.com/big.png' }),
      ).rejects.toThrow('larger than 8 MB');
    });

    it('refuses a failed image fetch', async () => {
      mockFetch.mockResolvedValueOnce(registered()).mockResolvedValueOnce(fail({}, 404));
      await expect(
        client.createOrganizationPostWithImage('o1', { text: 't', imageUrl: 'https://cdn.example.com/gone.png' }),
      ).rejects.toThrow('status 404');
    });
  });

` + a)
fs.writeFileSync(f, s)
console.log('ok')
