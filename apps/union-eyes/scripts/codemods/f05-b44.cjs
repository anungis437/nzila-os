const fs=require('fs');
function edit(p,pairs){let s=fs.readFileSync(p,'utf8');for(const [a,b] of pairs){if(!s.includes(a))throw new Error('missing in '+p+': '+a.slice(0,60));s=s.split(a).join(b);}fs.writeFileSync(p,s);}
const idr='app/api/signatures/documents/[id]/route.ts';
edit(idr,[
["import { projectSignaturePayload } from \"@/lib/documents/signature-projection\";","import { projectSignaturePayload } from \"@/lib/documents/signature-projection\";\nimport { signatureViewForViewer } from \"@/lib/signature/signer-privacy\";"],
["    return NextResponse.json(projectSignaturePayload(document));","    return NextResponse.json(signatureViewForViewer(projectSignaturePayload(document), user.id, document.sentBy));"],
["const _signaturesDocumentsSchema = z.object({\n  action: z.unknown().optional(),\n  reason: z.string().min(1, 'reason is required'),\n});","const signaturesDocumentsSchema = z.object({\n  action: z.literal('void'),\n  reason: z.string().trim().min(1, 'reason is required').max(1000),\n}).strict();"],
["    const body = await req.json();\n    const { action, reason } = body;\n\n    if (action === \"void\") {\n      if (!reason) {\n        return standardErrorResponse(\n      ErrorCode.MISSING_REQUIRED_FIELD,\n      'Void reason required'\n    );\n      }\n\n      await SignatureService.voidDocument(documentId, userId, reason);\n\n      return NextResponse.json({\n        success: true,\n        message: \"Document voided successfully\",\n      });\n    }\n\n    return standardErrorResponse(\n      ErrorCode.VALIDATION_ERROR,\n      'Invalid action'\n    );",
"    const body = await req.json().catch(() => null);\n    const parsed = signaturesDocumentsSchema.safeParse(body);\n    if (!parsed.success) {\n      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'A void action with a reason of at most 1000 characters is required');\n    }\n\n    await SignatureService.voidDocument(documentId, userId, parsed.data.reason);\n\n    return NextResponse.json({\n      success: true,\n      message: \"Document voided successfully\",\n    });"],
]);
const au='app/api/signatures/audit/[documentId]/route.ts';
edit(au,[
["import { AuditTrailService, SignatureService } from \"@/lib/signature/signature-service\";","import { AuditTrailService, SignatureService } from \"@/lib/signature/signature-service\";\nimport { signatureViewForViewer } from \"@/lib/signature/signer-privacy\";"],
["    // Get query params","    const senderId = await SignatureService.getDocumentSender(documentId);\n\n    // Get query params"],
["      return NextResponse.json({\n        report,\n","      return NextResponse.json({\n        report: signatureViewForViewer(report, user.id, senderId),\n"],
["        events: auditTrail,","        events: signatureViewForViewer(auditTrail, user.id, senderId),"],
]);
