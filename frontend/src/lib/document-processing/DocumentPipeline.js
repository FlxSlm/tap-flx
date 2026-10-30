import { ProviderDetection } from './ProviderDetection.js';
import { sourceParser } from './SourceContract.js';
import { ValidationAndConfidence } from './ValidationAndConfidence.js';

export class DocumentParseError extends Error {
  constructor(code) { super(code); this.code = code; }
}

export function parseDocument(text) {
  const detection = ProviderDetection.detect(text);
  if (detection.provider === 'UNKNOWN') throw new DocumentParseError('UNKNOWN_PROVIDER');
  if (detection.type === 'UNKNOWN') throw new DocumentParseError('UNSUPPORTED_DOCUMENT');
  try {
    const { parser, version } = sourceParser(detection.provider, detection.type);
    const normalized = parser.normalize(parser.parse(text));
    if (!normalized.length) throw new DocumentParseError('NO_MATCHING_ROWS');
    const previewData = normalized.map((data, id) => ({ id, data, ...ValidationAndConfidence.evaluate(data, detection.type === 'SOA' ? 'snapshot' : 'transaction') }));
    return { detection, previewData, parserVersion: version };
  } catch (error) {
    if (error instanceof DocumentParseError) throw error;
    throw new DocumentParseError('SOURCE_FORMAT_INVALID');
  }
}
