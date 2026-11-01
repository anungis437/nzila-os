const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.split(a).join(b)
  }
  fs.writeFileSync(f, s)
}
edit('app/api/external/grievances/[id]/documents/upload/route.ts', [
  [`      if (!derived.ok) return { forbidden: true as const };
`, `      if (!derived.ok) return { forbidden: true as const };

      // The representative names a stored object; nothing shows it is theirs. An object another record already holds (a document
      // or a version of one) is some other matter's file, so it is never attached here through an upload.
      const [heldByDocument] = await db
        .select({ id: documents.id })
        .from(documents)
        .where(and(eq(documents.organizationId, context.organizationId), eq(documents.blobPath, resolvedBlob.blobPath)))
        .limit(1);
      const [heldByVersion] = heldByDocument
        ? []
        : await db
            .select({ id: documentVersions.id })
            .from(documentVersions)
            .where(and(eq(documentVersions.organizationId, context.organizationId), eq(documentVersions.storageKey, resolvedBlob.blobPath)))
            .limit(1);
      if (heldByDocument || heldByVersion) return { conflict: true as const };
`],
  [`      return { forbidden: false as const, document: insertedDocument };
    }, context.organizationId);

    if (created.forbidden) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }`, `      return { forbidden: false as const, conflict: false as const, document: insertedDocument };
    }, context.organizationId);

    if ('conflict' in created && created.conflict) {
      return NextResponse.json({ error: 'The file is already attached to another record' }, { status: 409 });
    }
    if (created.forbidden) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }`],
])
edit('app/api/external/__tests__/external-routes.test.ts', [
  [`  it('rejects a privilege label before any external upload insert', async () => {`, `  // DEF-0B8-FED-EXTERNAL-UPLOAD-ATTACHES-ANY-ORGANIZATION-BLOB-TO-GRIEVANCE
  it('refuses a stored object another document already holds, and inserts nothing', async () => {
    seedMatterGrant();
    mocks.selectQueue.push([{ id: 'existing-document' }]);

    const response = await postUpload(uploadBody);

    expect(response.status).toBe(409);
    expect(mocks.db.insert).not.toHaveBeenCalled();
  });

  it('refuses a stored object that is already a version of another document', async () => {
    seedMatterGrant();
    mocks.selectQueue.push([], [{ id: 'existing-version' }]);

    const response = await postUpload(uploadBody);

    expect(response.status).toBe(409);
    expect(mocks.db.insert).not.toHaveBeenCalled();
  });

  it('rejects a privilege label before any external upload insert', async () => {`],
])
console.log('ok')
