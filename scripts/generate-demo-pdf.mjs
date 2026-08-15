import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const outputUrl = new URL("../demo/known-good-source.pdf", import.meta.url);
const lines = [
  "Margin ingestion smoke-test fixture",
  "",
  "A trustworthy answer should distinguish evidence from inference.",
  "Citations let a reader inspect the exact evidence behind a claim.",
  "Retryable processing makes temporary provider failures recoverable.",
];

const escapePdfText = (value) =>
  value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
const stream = [
  "BT",
  "/F1 14 Tf",
  "72 720 Td",
  ...lines.flatMap((line, index) => [
    index === 0 ? "" : "0 -24 Td",
    `(${escapePdfText(line)}) Tj`,
  ]),
  "ET",
]
  .filter(Boolean)
  .join("\n");
const objects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
  `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
];

let pdf = "%PDF-1.4\n";
const offsets = [0];
for (const [index, object] of objects.entries()) {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
}
const xrefOffset = Buffer.byteLength(pdf);
pdf += `xref\n0 ${objects.length + 1}\n`;
pdf += "0000000000 65535 f \n";
pdf += offsets
  .slice(1)
  .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
  .join("");
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

const outputPath = fileURLToPath(outputUrl);
await mkdir(new URL("../demo/", import.meta.url), { recursive: true });
await writeFile(outputPath, pdf, "ascii");
process.stdout.write(`Wrote ${outputPath}\n`);
