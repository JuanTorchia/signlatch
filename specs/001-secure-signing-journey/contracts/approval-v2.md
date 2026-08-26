# Approval Envelope v2 Contract

The approval digest is:

```text
SHA-256("signlatch:approval:v2\n" + canonical-json(envelope))
```

The canonical object contains only the following required fields, in contract order:

```text
version, tenantId, workflowId, reviewSnapshotId, artifactSha256,
agreementIntentDigest, recipientSetDigest, fieldSetDigest, findingSetDigest,
dispatchIntentDigest, foxitAccountId, approverPrincipalId, approvalIdentity,
issuedAt, expiresAt, nonce
```

Rules:

- Strings use UTF-8 and Unicode NFC; identifiers are lowercase canonical UUID text.
- Timestamps use UTC RFC 3339 with millisecond precision.
- No optional, unknown, null, floating-point, or locale-formatted values are allowed.
- Set digests are computed from their own versioned canonical contracts.
- Recipient sets sort by signing order then stable recipient id; identities use NFC,
  preserve case for delivery, and also carry a lowercase comparison key. Duplicate
  comparison keys are invalid. Field sets sort by stable field id; rectangles contain
  four integer thousandths-of-page values in `[0, 1000]`, with positive area and a
  one-based page. Empty strings, invisible-only strings, and duplicate field ids fail.
- `approvalIdentity` states the exact UI ceremony and human confirmation version.
- A nonce is unique per approval; restoring old values cannot restore old approval.
- Consumption compares this object to the current database snapshot atomically.
- v1 golden vectors remain valid historical evidence and are never silently rewritten.
