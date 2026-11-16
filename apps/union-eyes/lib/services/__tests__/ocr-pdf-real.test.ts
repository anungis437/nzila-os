/** Real installed PDF parser/renderer; image recognition is stubbed here to keep model downloads out of unit runs. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PDFDocument from 'pdfkit'
import { PDFParse } from 'pdf-parse'
const image = vi.hoisted(() => ({ recognize: vi.fn(), terminate: vi.fn() }))
vi.mock('tesseract.js', () => ({ createWorker: async () => ({ recognize: image.recognize, terminate: image.terminate }) }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }))
import { processPDFOCR } from '../ocr-service'
import { extractTextFromBytes } from '@/lib/documents/ocr-extract'
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAD0lEQVQImWP4jwMwDC0JALoev0GybL49AAAAAElFTkSuQmCC', 'base64')
async function makePdf(pages: Array<string | null>): Promise<Buffer> {
  const doc = new PDFDocument({ autoFirstPage: false }), chunks: Buffer[] = []
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })
  for (const text of pages) {
    doc.addPage()
    if (text === null) doc.image(PNG, 36, 90, { width: 540 })
    else doc.font('Helvetica').fontSize(16).text(text)
  }
  doc.end()
  return finished
}
beforeEach(() => {
  vi.clearAllMocks()
  image.recognize.mockImplementation(async (bytes: Buffer) => {
    expect(Buffer.isBuffer(bytes)).toBe(true)
    expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137,80,78,71,13,10,26,10]))
    expect(bytes.byteLength).toBeGreaterThan(50)
    return { data: { text: 'SYNTHETIC SCANNED PAGE', confidence: 92 } }
  })
  image.terminate.mockResolvedValue(undefined)
})
afterEach(() => vi.restoreAllMocks())
describe('PDF extraction against the actual installed dependency', () => {
  it('preserves two text pages and French characters through the real parser API', async () => {
    const bytes = await makePdf(['UNION EYES SYNTHETIC FIRST PAGE', 'Demande de révision du dossier témoin'])
    const result = await processPDFOCR(bytes)
    expect(result.pages).toHaveLength(2)
    expect(result.pages[0].text).toContain('UNION EYES SYNTHETIC FIRST PAGE')
    expect(result.pages[1].text).toContain('Demande de révision du dossier témoin')
    expect(image.recognize).not.toHaveBeenCalled()
    const extraction = await extractTextFromBytes(bytes, 'application/pdf', 'pdf')
    expect(extraction).toMatchObject({ engine: 'pdf-ocr', engineVersion: '2', metadata: { pages: 2 } })
    expect(extraction.text).toContain('Demande de révision du dossier témoin')
  })
  it('renders a scanned middle page instead of dropping it from a mixed document', async () => {
    const result = await processPDFOCR(await makePdf(['FIRST TEXT PAGE', null, 'LAST TEXT PAGE']))
    expect(result.pages).toHaveLength(3)
    expect(result.pages[0].text).toContain('FIRST TEXT PAGE')
    expect(result.pages[1].text).toBe('SYNTHETIC SCANNED PAGE')
    expect(result.pages[2].text).toContain('LAST TEXT PAGE')
    expect(image.recognize).toHaveBeenCalledOnce()
    expect(image.terminate).toHaveBeenCalledOnce()
  })
  it('rejects malformed PDF bytes and destroys the real parser on failure', async () => {
    const dispose = vi.spyOn(PDFParse.prototype, 'destroy')
    await expect(processPDFOCR(Buffer.from('%PDF-1.7\nnot a valid document'))).rejects.toThrow()
    expect(dispose).toHaveBeenCalledOnce()
    expect(image.recognize).not.toHaveBeenCalled()
  })
})
