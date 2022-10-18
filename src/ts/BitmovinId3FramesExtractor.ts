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

class Id3TagHeader {
  private _fileIdentifier: number;
  private _version: number;
  private _flags: number;
  private _syncSafeSize: number;

  set fileIdentifier(v: number) {
    this._fileIdentifier = v;
  }
  get fileIdentifier(): number {
    return this._fileIdentifier;
  }

  set version(v: number) {
    this._version = v;
  }
  get version(): number {
    return this._version;
  }

  set flags(v: number) {
    this._flags = v;
  }
  get flags(): number {
    return this._flags;
  }

  set syncSafeSize(v: number) {
    this._syncSafeSize = v;
  }
  get syncSafeSize(): number {
    return this._syncSafeSize;
  }
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
    this._header = new Id3TagHeader();
    this._frames = new Array<Frame>();
  }

  public pushFrame(frame: Frame) {
    this._frames.push(frame);
  }
}

export class Frame {
  private _key: string;
  private _data: number[];
  private _syncSafeSize: number;

  // private key : string;
  set key(v: string) {
    this._key = v;
  }
  get key(): string {
    return this._key;
  }

  set data(v: number[]) {
    this._data = v;
  }
  get data(): number[] {
    return this._data;
  }

  set syncSafeSize(v: number) {
    this._syncSafeSize = v;
  }
  get syncSafeSize(): number {
    return this._syncSafeSize;
  }
}

export class BitmovinId3FramesExtractor {
  private offset = 0;

  readBytes(buffer: Uint8Array, noOfBytes: number): Uint8Array {
    const data = new Uint8Array(noOfBytes);
    for (let i = 0; i < noOfBytes; i++) {
      data[i] = buffer[this.offset++];
    }

    return data;
  }

  private readBytesAsNumber(buffer: Uint8Array, noOfBytes: number): number {
    let value = 0;
    for (let i = 0; i < noOfBytes; i++) {
      value = value | (buffer[this.offset++] << (8 * (noOfBytes - i - 1)));
    }

    return value;
  }

  private readBytesAsSyncSafeNumber(buffer: Uint8Array, noOfBytes: number): number {
    let size = 0;
    for (let i = noOfBytes - 1; i >= 0; i--) {
      size += (this.readBytesAsNumber(buffer, 1) & SYNCSAFE_BIT) << (7 * i);
    }
    return size;
  }

  private readBytesAsNumberArray(buffer: Uint8Array, noOfBytes: number): Array<number> {
    const numberArray = new Array<number>(noOfBytes); //new Int8Array(noOfBytes);
    for (let i = 0; i < noOfBytes; i++) {
      numberArray.push(this.readBytesAsNumber(buffer, 1));
    }
    return numberArray;
  }

  private readBytesAsString(buffer: Uint8Array, noOfBytes: number): string {
    let value = '';
    for (let i = 0; i < noOfBytes; i++) {
      value += String.fromCharCode(this.readBytesAsNumber(buffer, 1));
    }
    return value;
  }

  extractId3FramesFromEmsg(source: Uint8Array): Frame[] {
    const id3Tag: Id3Tag = new Id3Tag();

    // file identifier; first 3 bytes.
    id3Tag.header.fileIdentifier = this.readBytesAsNumber(source, 3);

    if (id3Tag.header.fileIdentifier != ID3_HEADER) {
      throw 'No ID3 fileIdentifier found.';
    }

    // version; next two bytes
    id3Tag.header.version = this.readBytesAsNumber(source, 2);

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
    if ((id3Tag.header.flags & FLAG_CLEAR_BITS) != 0) {
      throw 'LSF 4 bit of Flag MUST be unset.';
    }

    id3Tag.header.syncSafeSize = this.readBytesAsSyncSafeNumber(source, 4);

    if (this.offset == id3Tag.header.syncSafeSize) {
      // No frames found
      return id3Tag.frames;
    }

    while (this.offset < id3Tag.header.syncSafeSize) {
      const frame = new Frame();

      frame.key = this.readBytesAsString(source, 4);
      frame.syncSafeSize = this.readBytesAsSyncSafeNumber(source, 4);

      // Frame is empty
      if (frame.syncSafeSize == 0) {
        throw 'Frame is empty.';
      }

      //Fastforward the Frame flags
      this.offset += 2;

      // We assume ASCII encoding
      frame.data = this.readBytesAsNumberArray(source, frame.syncSafeSize);

      id3Tag.pushFrame(frame);
    }

    return id3Tag.frames;
  }
}
