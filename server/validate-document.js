import yauzl from 'yauzl';
import CFB from 'cfb';
import { crc32 } from 'node:zlib';

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
const allowed = new Set(['pdf', 'doc', 'docx', 'ppt', 'pptx']);
const oleSignature = Buffer.from('d0cf11e0a1b11ae1', 'hex');

export async function validateDocument(buffer, filename) {
  const extension = filename.split('.').pop()?.toLowerCase();
  if (!allowed.has(extension)) throw new Error('Solo se admiten PDF, Word (.doc, .docx) y PowerPoint (.ppt, .pptx).');
  if (!buffer.length || buffer.length > MAX_FILE_BYTES) throw new Error('El documento debe pesar entre 1 byte y 20 MB.');
  if (extension === 'pdf') {
    if (!/^%PDF-[12]\.\d/.test(buffer.subarray(0, 8).toString('ascii')) ||
        !buffer.subarray(Math.max(0, buffer.length - 1024)).includes(Buffer.from('%%EOF'))) {
      throw new Error('El contenido no corresponde a un PDF válido.');
    }
  } else if (extension === 'doc' || extension === 'ppt') {
    if (!buffer.subarray(0, 8).equals(oleSignature)) throw new Error('El contenido no corresponde al formato de Office indicado.');
    try {
      const container = CFB.read(buffer, { type: 'buffer' });
      const names = container.FileIndex.filter(x => x.type === 2).map(x => x.name);
      const expected = extension === 'doc' ? 'WordDocument' : 'PowerPoint Document';
      const other = extension === 'doc' ? 'PowerPoint Document' : 'WordDocument';
      if (!names.includes(expected) || names.includes(other) || names.some(x => /vba|macros|encryptedpackage/i.test(x))) {
        throw new Error('wrong type');
      }
    } catch { throw new Error('El documento Office está dañado, contiene macros o no corresponde a su extensión.'); }
  } else {
    await validateOfficeZip(buffer, extension);
  }
  return extension;
}

function validateOfficeZip(buffer, extension) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true }, (error, zip) => {
      if (error) return reject(new Error('El documento Office no es un archivo válido.'));
      let finished = false;
      let expanded = 0;
      let entries = 0;
      const found = new Map();
      const required = extension === 'docx' ? 'word/document.xml' : 'ppt/presentation.xml';
      const fail = () => {
        if (finished) return;
        finished = true;
        zip.close();
        reject(new Error('El documento Office está dañado, contiene contenido activo o no corresponde a su extensión.'));
      };
      zip.on('error', fail);
      zip.on('entry', entry => {
        const name = entry.fileName;
        const unixType = (entry.externalFileAttributes >>> 16) & 0xf000;
        if (++entries > 2000 || entry.uncompressedSize > 80 * 1024 * 1024 ||
            (entry.generalPurposeBitFlag & 1) || unixType === 0xa000 ||
            name.split('/').some(p => p === '..' || p === '.') ||
            /(?:vba|activex|embeddings\/|macros|encryptedpackage)/i.test(name) || found.has(name)) return fail();
        found.set(name, null);
        if (name.endsWith('/')) return zip.readEntry();
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError) return fail();
          let checksum = 0;
          let size = 0;
          const capture = name === '[Content_Types].xml' || name === required;
          const chunks = [];
          stream.on('error', fail);
          stream.on('data', chunk => {
            size += chunk.length;
            expanded += chunk.length;
            if (expanded > 80 * 1024 * 1024 || (capture && size > 2 * 1024 * 1024)) {
              stream.destroy();
              return fail();
            }
            checksum = crc32(chunk, checksum);
            if (capture) chunks.push(chunk);
          });
          stream.on('end', () => {
            if (finished) return;
            if (size !== entry.uncompressedSize || checksum !== entry.crc32) return fail();
            if (capture) found.set(name, Buffer.concat(chunks).toString('utf8'));
            zip.readEntry();
          });
        });
      });
      zip.on('end', () => {
        if (finished) return;
        const types = found.get('[Content_Types].xml') || '';
        const main = found.get(required) || '';
        const expectedType = extension === 'docx' ?
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml' :
          'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml';
        const root = extension === 'docx' ? /<(?:\w+:)?document(?:\s|>)/ : /<(?:\w+:)?presentation(?:\s|>)/;
        if (!types.includes(expectedType) || !root.test(main) || /macroEnabled|vbaProject/i.test(types)) return fail();
        finished = true;
        resolve();
      });
      zip.readEntry();
    });
  });
}
