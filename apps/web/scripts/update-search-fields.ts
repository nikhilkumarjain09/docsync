import * as Y from 'yjs';
import { db } from '@docsync/db';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from the root .env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

function parseXmlContent(
  node: Y.XmlText | Y.XmlElement | Y.XmlFragment,
  result: {
    headings: string[];
    paragraphs: string[];
    lists: string[];
    tables: string[];
    text: string[];
  },
) {
  if (node instanceof Y.XmlText) {
    const txt = node.toString().trim();
    if (txt) {
      result.text.push(txt);
    }
  } else if (node instanceof Y.XmlElement) {
    const nodeName = node.nodeName.toLowerCase();
    const localTextList: string[] = [];
    const children = node.toArray() as (Y.XmlText | Y.XmlElement | Y.XmlFragment)[];

    for (const child of children) {
      if (child instanceof Y.XmlText) {
        localTextList.push(child.toString());
      } else {
        const subResult = { headings: [], paragraphs: [], lists: [], tables: [], text: [] };
        parseXmlContent(child, subResult);
        localTextList.push(...subResult.text);
        result.headings.push(...subResult.headings);
        result.paragraphs.push(...subResult.paragraphs);
        result.lists.push(...subResult.lists);
        result.tables.push(...subResult.tables);
      }
    }

    const combinedText = localTextList.join('').trim();
    if (combinedText) {
      if (nodeName.includes('heading') || nodeName.match(/^h[1-6]$/)) {
        result.headings.push(combinedText);
      } else if (nodeName.includes('paragraph') || nodeName === 'p') {
        result.paragraphs.push(combinedText);
      } else if (nodeName.includes('listitem') || nodeName === 'li') {
        result.lists.push(combinedText);
      } else if (nodeName.includes('tablecell') || nodeName === 'td' || nodeName === 'th') {
        result.tables.push(combinedText);
      } else {
        result.text.push(combinedText);
      }
    }
  } else if (node instanceof Y.XmlFragment) {
    const children = node.toArray() as (Y.XmlText | Y.XmlElement | Y.XmlFragment)[];
    for (const child of children) {
      parseXmlContent(child, result);
    }
  }
}

async function main() {
  console.log('[Migration] Starting search index backfill...');

  const documents = await db.document.findMany({
    include: {
      updateLogs: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  console.log(`[Migration] Found ${documents.length} documents to process.`);

  for (const doc of documents) {
    try {
      const yDoc = new Y.Doc();

      // 1. Hydrate Yjs document state
      if (doc.latestSnapshot) {
        Y.applyUpdate(yDoc, new Uint8Array(doc.latestSnapshot));
      } else if (doc.updateLogs.length > 0) {
        for (const log of doc.updateLogs) {
          try {
            Y.applyUpdate(yDoc, new Uint8Array(log.update));
          } catch {
            // Skip corrupt entries
          }
        }
      }

      // 2. Parse XML Fragment content
      const contentFragment = yDoc.getXmlFragment('default');
      const parseResult = { headings: [], paragraphs: [], lists: [], tables: [], text: [] };
      parseXmlContent(contentFragment, parseResult);

      const allText = [
        ...parseResult.headings,
        ...parseResult.paragraphs,
        ...parseResult.lists,
        ...parseResult.tables,
        ...parseResult.text,
      ]
        .join(' ')
        .trim();

      // 3. Save updates back to database
      await db.document.update({
        where: { id: doc.id },
        data: {
          content: allText || null,
          headings: parseResult.headings.join(' ') || null,
          paragraphs: parseResult.paragraphs.join(' ') || null,
          tables: parseResult.tables.join(' ') || null,
          lists: parseResult.lists.join(' ') || null,
        },
      });

      console.log(`[Migration] Successfully indexed document: "${doc.title}" (ID: ${doc.id})`);
      yDoc.destroy();
    } catch (err: unknown) {
      console.error(`[Migration] Failed to index document ${doc.id}:`, (err as Error).message);
    }
  }

  console.log('[Migration] Search index backfill complete.');
}

main()
  .catch((e: unknown) => {
    console.error('[Migration] Critical failure:', e);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
