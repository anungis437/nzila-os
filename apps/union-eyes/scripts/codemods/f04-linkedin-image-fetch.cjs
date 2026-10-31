const fs = require('fs')
const f = 'lib/social-media/linkedin-api-client.ts'
let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
const a = `    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
`
if (!s.includes(a)) throw new Error('anchor')
s = s.replace(a, `    // A redirect could leave the host that was just checked, so none is followed; only a bounded image is taken.
    const imageResponse = await fetch(imageUrl, { redirect: 'error' });
    if (!imageResponse.ok) throw new Error(\`Image fetch failed with status \${imageResponse.status}\`);
    const imageType = imageResponse.headers?.get?.('content-type') ?? '';
    if (imageType && !imageType.toLowerCase().startsWith('image/')) throw new Error('Blocked image URL: not an image');
    const imageBuffer = await imageResponse.arrayBuffer();
    if (imageBuffer.byteLength > 8 * 1024 * 1024) throw new Error('Blocked image URL: image larger than 8 MB');
`)
fs.writeFileSync(f, s)
console.log('ok')
