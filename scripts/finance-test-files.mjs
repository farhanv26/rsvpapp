/** Real, deterministic document/image fixtures for private-file operation tests. */
import sharp from 'sharp';
export function contractPdf(){
 const text='BT /F1 20 Tf 50 760 Td (VowPal synthetic contract) Tj /F1 12 Tf 0 -32 Td (Fixture only - no legal agreement) Tj ET';
 const objects=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
 ];
 let pdf='%PDF-1.4\n';const offsets=[0];
 objects.forEach((object,index)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${index+1} 0 obj\n${object}\nendobj\n`;});
 const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 return Buffer.from(pdf);
}
export async function contractImages(){
 const image=sharp({create:{width:160,height:100,channels:3,background:{r:250,g:250,b:250}}});
 return {png:await image.clone().png().toBuffer(),jpg:await image.clone().jpeg().toBuffer()};
}
