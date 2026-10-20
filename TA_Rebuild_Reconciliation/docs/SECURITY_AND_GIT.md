# Security, Privacy, Git

- The six PDFs in `docs/aset_parser/` may contain PII and financial account details. **Assume sensitive until independently verified sanitized**.
- Keep originals outside repository and outside agent-readable workspace where possible. If originals are inside, exclude via `.gitignore` and do not open/share them with an external agent until sanitized.
- True PDF redaction must remove underlying text, annotations, metadata, attachments, hidden layers, and sensitive filenames; visual black boxes are insufficient.
- Never log entire PDF text, email body, tokens, PDF password, bank/RDN ID, addresses or phone numbers.
- Do not include actual user emails in fixture expectations or documentation.
- `.gitignore` does not remove previously committed files or history; inspect `git ls-files`, history and remotes before first push. If secrets entered history, rotate credentials and plan history remediation with user approval.
- Keep `.env`, OAuth tokens, DB dumps, private documents and secrets out of Git; use `.env.example` with dummy values.
- Preserve existing git identity, no AI co-author; no force push, hard reset, destructive migration or deletion without explicit user consent.
- Prefer private GitHub repo but do not treat private visibility as permission to upload sensitive originals.
- Automatic Mode: encrypted token storage, minimum OAuth scopes, consent, revocation, retry/backoff and source allowlists.
- Privacy Mode: verify via network inspection that raw PDF/password never leave browser; Laravel validates structured JSON.
