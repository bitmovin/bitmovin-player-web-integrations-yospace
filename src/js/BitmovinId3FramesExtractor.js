const ID3_HEADER = 0x494433;
const MAX_ID3_VERSION = 0x0400;
const FLAG_UNSYNC_APPLIED = 0x80; //i.e 0b10000000
const FLAG_EXTENDED_HEADER = 0x40; // i.e 0b01000000
const FLAG_CLEAR_BITS = 0x0f; //i.e 0b0001111
const SYNCSAFE_BIT = 0x7f; //i.e 0b01111111

/*
 *  Helper class to extract ID3 frames.
 */
export class BitmovinId3FramesExtractor {
  static ReadUint(buffer, offset, size) {
    switch (size) {
      case 8:
        return buffer[offset];
      case 16:
        return (buffer[offset] << 8) | buffer[offset + 1];
      case 24:
        return (buffer[offset] << 16) | (buffer[offset + 1] << 8) | buffer[offset + 2];
      case 32:
        return (buffer[offset] << 24) | (buffer[offset + 1] << 16) | (buffer[offset + 2] << 8) | buffer[offset + 3];
    }
  }

  static extractId3FramesFromEmsg(source) {
    let offset = 0;
    let header = {};
    let tags = [];

    // file identifier; first 3 bytes.
    header['fileIdentifier'] = BitmovinId3FramesExtractor.ReadUint(source, offset, 24);
    offset += 3;

    if (header['fileIdentifier'] != ID3_HEADER) {
      throw 'No ID3 fileIdentifier found.';
    }

    // version; next two bytes
    header['version'] = BitmovinId3FramesExtractor.ReadUint(source, offset, 16);
    offset += 2;
    if (header.version > MAX_ID3_VERSION) {
      throw 'ID3 version > 0x400.';
    }

    console.log(header['version']);

    // flags; UNSYNC and EXTENDED HEADER are NOT required for Yospace implementation
    header['flags'] = BitmovinId3FramesExtractor.ReadUint(source, offset, 8);
    offset += 1;

    // TODO: Yospace doesn't require them; hence we're not parsing them.
    if (header.flags & FLAG_UNSYNC_APPLIED || header.flags & FLAG_EXTENDED_HEADER) {
      throw 'FLAG_UNSYNC_APPLIED & FLAG_EXTENDED_HEADER are not supported.';
    }

    // LSF 4 bits MUST be unset
    if (header.flags & (FLAG_CLEAR_BITS != 0)) {
      throw 'LSF 4 bit of Flag MUST be unset.';
    }

    // get the sync safe-d size
    header['syncSafeSize'] = 0;
    for (let i = 3; i >= 0; i--) {
      header['syncSafeSize'] += (BitmovinId3FramesExtractor.ReadUint(source, offset++, 8) & SYNCSAFE_BIT) << (7 * i);
    }

    // No frames found
    if (offset == header.syncSafeSize) {
      throw 'No frames found.';
    }

    while (offset < header.syncSafeSize) {
      let frameHeader = {};
      let frameValue = [];

      frameHeader['id'] = '';
      for (let i = 0; i < 4; i++) {
        frameHeader['id'] += String.fromCharCode(BitmovinId3FramesExtractor.ReadUint(source, offset++, 8));
      }

      frameHeader['size'] = 0;
      for (let i = 3; i >= 0; i--) {
        frameHeader['size'] += (BitmovinId3FramesExtractor.ReadUint(source, offset++, 8) & SYNCSAFE_BIT) << (7 * i);
      }

      // Frame is empty
      if (frameHeader.size == 0) {
        throw 'Frame is empty.';
      }

      //Fastforward the Frame flags
      offset += 2;

      for (let i = 0; i < frameHeader.size; i++) {
        frameValue.push(BitmovinId3FramesExtractor.ReadUint(source, offset++, 8));
      }

      tags.push({ key: frameHeader['id'], data: frameValue });
    }

    return tags;
  }
}
