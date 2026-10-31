/**
 * Fail-closed legal-document download gate. A JSON 501 or a successful-looking
 * non-PDF response must never become a file named *.pdf on the user's device.
 */
export async function readVerifiedPdfResponse(response: Response): Promise<Blob> {
  if (!response.ok) {
    if (response.status === 501) {
      throw new Error('Labour board PDF generation is not yet available. Your entered values remain on this page; no file was generated.');
    }
    throw new Error('The form service could not generate a PDF. No file was downloaded.');
  }
  const mediaType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (mediaType !== 'application/pdf') {
    throw new Error('The form service returned a non-PDF response. No file was downloaded.');
  }
  const blob = await response.blob();
  if (blob.size < 5 || blob.size > 20 * 1024 * 1024) {
    throw new Error('The generated file is empty or exceeds the supported PDF size.');
  }
  const header = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...header) !== '%PDF-') {
    throw new Error('The form service returned an invalid PDF. No file was downloaded.');
  }
  return blob;
}
