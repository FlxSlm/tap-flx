// Isolated subprocess protocol. Never print PDF/text/passwords or library errors.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { pageText } from '../src/lib/document-processing/PdfLayout.js';
import { parseDocument } from '../src/lib/document-processing/DocumentPipeline.js';
import { buildSourceImport } from '../src/lib/document-processing/SourceContract.js';
let chunks = []; let total = 0; let task;
try {
  for await (const chunk of process.stdin) { total += chunk.length; if (total > 29 * 1024 * 1024) throw { code: 'DOCUMENT_LIMIT' }; chunks.push(chunk); }
  const input = JSON.parse(Buffer.concat(chunks).toString('utf8')); chunks = [];
  const bytes = Uint8Array.from(Buffer.from(input.pdf, 'base64')); input.pdf = null;
  if (bytes.length > 20 * 1024 * 1024) throw { code: 'DOCUMENT_LIMIT' };
  task = pdfjs.getDocument({ data: bytes, ...(input.password ? { password: input.password } : {}), verbosity: 0, isEvalSupported: false, enableXfa: false, disableFontFace: true }); input.password = null;
  const pdf = await task.promise; if (pdf.numPages > 100) throw { code: 'DOCUMENT_LIMIT' };
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) text += pageText((await (await pdf.getPage(i)).getTextContent()).items) + '\n';
  const parsed = parseDocument(text); text = null;
  if (parsed.detection.provider !== input.provider) throw { code: 'PROVIDER_MISMATCH' };
  if (parsed.previewData.some(row => !row.isHardValidationPass)) throw { code: 'VALIDATION_REQUIRED' };
  const payload = buildSourceImport({ accountId: input.account_id, detection: parsed.detection, documentHash: input.document_hash, batchKey: input.batch_key, previewData: parsed.previewData, selectedRows: new Set(parsed.previewData.map(row => row.id)) });
  process.stdout.write(JSON.stringify({ status: 'READY_FOR_REVIEW', payload }));
} catch (error) {
  const allowed = ['DOCUMENT_LIMIT','PROVIDER_MISMATCH','VALIDATION_REQUIRED','UNKNOWN_PROVIDER','UNSUPPORTED_DOCUMENT','NO_MATCHING_ROWS','SOURCE_FORMAT_INVALID'];
  const code = error.name === 'PasswordException' ? (error.code === 2 ? 'WRONG_PASSWORD' : 'PASSWORD_REQUIRED') : allowed.includes(error.code) ? error.code : error.name === 'InvalidPDFException' ? 'UNSUPPORTED_DOCUMENT' : 'DECRYPTION_FAILED';
  process.stdout.write(JSON.stringify({ status: code }));
} finally { await task?.destroy().catch(() => {}); }
