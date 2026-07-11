/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, runWithUserContext } from '@docsync/db';
import { getDocumentRole, SnapshotCreateSchema } from '@docsync/shared';
import * as Y from 'yjs';

// GET: List all snapshots for a document
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: documentId } = await params;
  const userId = session.user.id;

  const role = await getDocumentRole(userId, documentId);
  if (!role) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  try {
    const snapshots = await runWithUserContext(userId, async (tx) => {
      return tx.documentSnapshot.findMany({
        where: { documentId },
        include: {
          creator: {
            select: { name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    return NextResponse.json(snapshots);
  } catch (e: any) {
    console.error('[SnapshotsRoute] Failed to fetch snapshots:', e.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create a new collapse checkpoint (snapshot) of the document
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: documentId } = await params;
  const userId = session.user.id;

  const role = await getDocumentRole(userId, documentId);
  if (!role || (role !== 'OWNER' && role !== 'EDITOR')) {
    return NextResponse.json(
      { error: 'Unauthorized: Only Owners or Editors can save versions' },
      { status: 403 },
    );
  }

  // ─── Zod validation ────────────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch (e) {
    rawBody = {};
  }

  const parseResult = SnapshotCreateSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid payload', details: parseResult.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { label, state: clientStateBase64 } = parseResult.data;

  try {
    let compressedState: Uint8Array;

    if (clientStateBase64) {
      // Client provided its authoritative Y.Doc state — use it directly.
      // This avoids race conditions where the WS relay has already persisted
      // future edits to the DB by the time this POST is processed.
      const clientStateBytes = new Uint8Array(Buffer.from(clientStateBase64, 'base64'));
      // Validate the state is a valid Yjs update
      const tempDoc = new Y.Doc();
      try {
        Y.applyUpdate(tempDoc, clientStateBytes);
      } catch (yErr: any) {
        tempDoc.destroy();
        console.error(`[SnapshotsRoute] Invalid client-provided state: ${yErr.message}`);
        return NextResponse.json({ error: 'Invalid document state' }, { status: 400 });
      }
      compressedState = Y.encodeStateAsUpdate(tempDoc);
      tempDoc.destroy();
    } else {
      // Fallback: reconstruct state from DB update logs
      const updateLogs = await runWithUserContext(userId, async (tx) => {
        return tx.documentUpdateLog.findMany({
          where: { documentId },
          orderBy: { createdAt: 'asc' },
        });
      });

      const tempDoc = new Y.Doc();
      let corruptCount = 0;
      for (const log of updateLogs) {
        try {
          Y.applyUpdate(tempDoc, new Uint8Array(log.update));
        } catch (yErr: any) {
          corruptCount++;
          console.warn(`[SnapshotsRoute] Skipped corrupt update log ${log.id}: ${yErr.message}`);
        }
      }
      if (corruptCount > 0) {
        console.warn(
          `[SnapshotsRoute] ${corruptCount}/${updateLogs.length} update logs were corrupt during snapshot creation for doc: ${documentId}`,
        );
      }

      compressedState = Y.encodeStateAsUpdate(tempDoc);
      tempDoc.destroy();
    }

    // Parse text and headings for full text search indexing
    const searchDoc = new Y.Doc();
    const parseResult = { headings: [], paragraphs: [], lists: [], tables: [], text: [] };
    try {
      Y.applyUpdate(searchDoc, compressedState);
      const contentFragment = searchDoc.getXmlFragment('default');

      const parseXml = (node: any, res: any) => {
        if (node instanceof Y.XmlText) {
          const txt = node.toString().trim();
          if (txt) res.text.push(txt);
        } else if (node instanceof Y.XmlElement) {
          const nodeName = node.nodeName.toLowerCase();
          const localTextList: string[] = [];
          for (const child of node.toArray()) {
            if (child instanceof Y.XmlText) {
              localTextList.push(child.toString());
            } else {
              const subResult = { headings: [], paragraphs: [], lists: [], tables: [], text: [] };
              parseXml(child, subResult);
              localTextList.push(...subResult.text);
              res.headings.push(...subResult.headings);
              res.paragraphs.push(...subResult.paragraphs);
              res.lists.push(...subResult.lists);
              res.tables.push(...subResult.tables);
            }
          }
          const combinedText = localTextList.join('').trim();
          if (combinedText) {
            if (nodeName.includes('heading') || nodeName.match(/^h[1-6]$/)) {
              res.headings.push(combinedText);
            } else if (nodeName.includes('paragraph') || nodeName === 'p') {
              res.paragraphs.push(combinedText);
            } else if (nodeName.includes('listitem') || nodeName === 'li') {
              res.lists.push(combinedText);
            } else if (nodeName.includes('tablecell') || nodeName === 'td' || nodeName === 'th') {
              res.tables.push(combinedText);
            } else {
              res.text.push(combinedText);
            }
          }
        } else if (node instanceof Y.XmlFragment) {
          for (const child of node.toArray()) {
            parseXml(child, res);
          }
        }
      };
      parseXml(contentFragment, parseResult);
    } catch (parseErr: any) {
      console.warn(`[SnapshotsRoute] Text extraction failed: ${parseErr.message}`);
    } finally {
      searchDoc.destroy();
    }

    const allText = [
      ...parseResult.headings,
      ...parseResult.paragraphs,
      ...parseResult.lists,
      ...parseResult.tables,
      ...parseResult.text,
    ]
      .join(' ')
      .trim();

    // 4. Save snapshot row in database and update document search fields
    const snapshot = await runWithUserContext(userId, async (tx) => {
      const snap = await tx.documentSnapshot.create({
        data: {
          documentId,
          state: Buffer.from(compressedState),
          createdBy: userId,
          label: label || `Manual checkpoint (${new Date().toLocaleDateString()})`,
        },
        include: {
          creator: {
            select: { name: true, email: true },
          },
        },
      });

      await tx.document.update({
        where: { id: documentId },
        data: {
          latestSnapshot: Buffer.from(compressedState),
          snapshotVersion: {
            increment: 1,
          },
          content: allText || null,
          headings: parseResult.headings.join(' ') || null,
          paragraphs: parseResult.paragraphs.join(' ') || null,
          tables: parseResult.tables.join(' ') || null,
          lists: parseResult.lists.join(' ') || null,
        },
      });

      return snap;
    });

    console.log(
      `[SnapshotsRoute] Created snapshot "${snapshot.label}" (ID: ${snapshot.id}) for doc: ${documentId}`,
    );
    return NextResponse.json(snapshot);
  } catch (e: any) {
    console.error('[SnapshotsRoute] Failed to save snapshot:', e.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
