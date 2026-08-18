import { readFileSync } from "fs";
import { join } from "path";

import { PrismaClient } from "@prisma/client";

import { parseOrderDocumentText } from "../lib/ocr/service";

const prisma = new PrismaClient();

const files = [
  "kanal-a-pastorinho-form.txt",
  "kanal-b-avolta-proposta.txt",
  "kanal-c-carrefour-portal.txt",
];

async function main() {
  for (const f of files) {
    const text = readFileSync(join("Dokuman", f), "utf8");
    const draft = await parseOrderDocumentText(prisma, text);
    console.log(f, draft.channel, draft.lines.length, draft.customerId, draft.totalCents);
    for (const l of draft.lines) {
      console.log(
        " ",
        l.externalSku,
        l.internalSku,
        l.quantityInput,
        l.skuResolved,
      );
    }
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
