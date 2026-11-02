import { CONTRACT_MAX_BYTES } from './contract-limits';
export { CONTRACT_MAX_BYTES } from './contract-limits';
export function validateContract(name: string, type: string, bytes: Uint8Array) {
  if (!bytes.length || bytes.length > CONTRACT_MAX_BYTES) return 'Choose a file up to 10 MB.';
  const signature = [...bytes.subarray(0, 8)];
  const pdf = Buffer.from(bytes.subarray(0, 5)).toString('ascii') === '%PDF-';
  const png = signature.join(',') === '137,80,78,71,13,10,26,10';
  const jpg = signature[0] === 255 && signature[1] === 216 && signature[2] === 255;
  const valid = (type === 'application/pdf' && /\.pdf$/i.test(name) && pdf)
    || (type === 'image/png' && /\.png$/i.test(name) && png)
    || (type === 'image/jpeg' && /\.jpe?g$/i.test(name) && jpg);
  return valid ? null : 'Choose a PDF, PNG or JPEG with a matching file extension.';
}
export function safeContractName(name: string) {
  const clean = name.split(/[\\/]/).pop()!.replace(/[\x00-\x1f\x7f";]/g, '_') || 'contract';
  const extension = clean.match(/\.[a-z0-9]{1,8}$/i)?.[0] ?? '';
  const characters = Array.from(clean);
  return characters.length <= 160 ? clean : characters.slice(0, 160 - extension.length).join('') + extension;
}
