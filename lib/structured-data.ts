export function serializeStructuredData(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
