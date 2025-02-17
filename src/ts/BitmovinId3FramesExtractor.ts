const ID3_HEADER = 0x494433;
const MAX_ID3_VERSION = 0x0400;
const FLAG_UNSYNC_APPLIED = 0x80; //i.e 0b10000000
const FLAG_EXTENDED_HEADER = 0x40; // i.e 0b01000000
const FLAG_CLEAR_BITS = 0x0f; //i.e 0b0001111
const SYNCSAFE_BIT = 0x7f; //i.e 0b01111111

/*
 *  Helper class to extract ID3 frames.
 *  Per https://id3.org/id3v2.4.0-structure
 */

enum FrameTextEncoding {
  Iso88591 = 0x00, // ISO-8859-1.
  Utf16 = 0x01, // UTF-16 encoded Unicode BOM
  Utf16be = 0x02, // UTF-16BE encoded Unicode
  Utf8 = 0x03, // UTF-8 encoded Unicode
}

interface Id3TagHeader {
  fileIdentifier: number;
  version: number;
  flags: number;
  syncSafeSize: number;
}

export interface Frame {
  key: string;
  data: number[];
  syncSafeSize: number;
}

class Id3Tag {
  private _header: Id3TagHeader;
  private _frames: Frame[];

  get header(): Id3TagHeader {
    return this._header;
  }
  get frames(): Frame[] {
    return this._frames;
  }

  constructor() {
    this._header = { fileIdentifier: 0, version: 0, flags: 0, syncSafeSize: 0 };
    this._frames = new Array<Frame>();
  }

  public pushFrame(frame: Frame) {
    this._frames.push(frame);
  }
}

export class BitmovinId3FramesExtractor {
  private offset = 0;

  private readBytes(buffer: Uint8Array, noOfBytes: number): Uint8Array {
    const data = new Uint8Array(noOfBytes);
    for (var i = 0; i < noOfBytes; i++) {
      data[i] = buffer[this.offset++];
    }
    return data;
  }

  private readBytesAsNumber(buffer: Uint8Array, noOfBytes: number): number {
    var value = 0;
    for (var i = 0; i < noOfBytes; i++) {
      value = value | (buffer[this.offset++] << (8 * (noOfBytes - i - 1)));
    }

    return value;
  }

  private readBytesAsSyncSafeNumber(buffer: Uint8Array, noOfBytes: number): number {
    var size = 0;
    for (var i = noOfBytes - 1; i >= 0; i--) {
      size += (this.readBytesAsNumber(buffer, 1) & SYNCSAFE_BIT) << (7 * i);
    }
    return size;
  }

  private readBytesAsNumberArray(buffer: Uint8Array, noOfBytes: number): number[] {
    const numberArray: number[] = [];

    for (var i = 0; i < noOfBytes; i++) {
      numberArray.push(this.readBytesAsNumber(buffer, 1));
    }

    return numberArray;
  }

  private readBytesAsString(buffer: Uint8Array, noOfBytes: number): string {
    var value = '';
    for (var i = 0; i < noOfBytes; i++) {
      value += String.fromCharCode(this.readBytesAsNumber(buffer, 1));
    }
    return value;
  }

  extractId3FramesFromEmsg(source: Uint8Array): Frame[] {
    const id3Tag: Id3Tag = new Id3Tag();

    // file identifier; first 3 bytes.
    id3Tag.header.fileIdentifier = this.readBytesAsNumber(source, 3);

    /* Excerpt from spec:
     * ID3v2/file identifier      "ID3"
       The first three bytes of the tag are always "ID3", to indicate that
       this is an ID3v2 tag.
    */
    if (id3Tag.header.fileIdentifier != ID3_HEADER) {
      throw 'No ID3 fileIdentifier found.';
    }

    // version; next two bytes
    id3Tag.header.version = this.readBytesAsNumber(source, 2);

    /* Excerpt from spec:
     * ID3v2 version              $04 00
       If software with ID3v2.4.0 and below support should encounter version
       five or higher it should simply ignore the whole tag.
    */
    if (id3Tag.header.version > MAX_ID3_VERSION) {
      throw 'ID3 version > 0x400.';
    }

    // flags; UNSYNC and EXTENDED HEADER are NOT required for Yospace implementation
    id3Tag.header.flags = this.readBytesAsNumber(source, 1);

    // TODO: Yospace doesn't require them; hence we're not parsing them.
    if (id3Tag.header.flags & FLAG_UNSYNC_APPLIED || id3Tag.header.flags & FLAG_EXTENDED_HEADER) {
      throw 'FLAG_UNSYNC_APPLIED & FLAG_EXTENDED_HEADER parsing are not supported.';
    }

    // LSF 4 bits MUST be unset
    /* Excerpt from spec:
     * ID3v2 flags                %abcd0000
       All the other flags MUST be cleared. If one of these undefined flags
       are set, the tag might not be readable for a parser that does not
       know the flags function.
    */
    if ((id3Tag.header.flags & FLAG_CLEAR_BITS) != 0) {
      throw 'LSF 4 bit of Flag MUST be unset.';
    }

    id3Tag.header.syncSafeSize = this.readBytesAsSyncSafeNumber(source, 4);

    // No frames found
    /* Excerpt from spec:
     * A tag MUST contain at least one frame.
     */
    if (this.offset == id3Tag.header.syncSafeSize) {
      throw 'A tag MUST contain at least one frame.';
    }

    while (this.offset < id3Tag.header.syncSafeSize) {
      const key = this.readBytesAsString(source, 4);
      const syncSafeSize = this.readBytesAsSyncSafeNumber(source, 4);

      // Frame is empty
      /* Excerpt from spec:
       * A frame must be at least 1 byte big, excluding the header.
       */

      if (syncSafeSize < 0) {
        throw 'A frame must be at least 1 byte big, excluding the header.';
      }

      //Fastforward the Frame flags
      this.offset += 2;

      // Read the data
      const data = this.readBytesAsNumberArray(source, syncSafeSize);

      // Parse frames that are ONLY UTF8
      if (data[0] == FrameTextEncoding.Utf8) {
        id3Tag.pushFrame({ key: key, syncSafeSize: syncSafeSize, data: data });
      }
    }

    return id3Tag.frames;
  }
}
