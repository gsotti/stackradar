// MD5 hash function for Gravatar
export function md5(str) {
  function rotateLeft(value, amount) {
    return (value << amount) | (value >>> (32 - amount));
  }

  function addUnsigned(x, y) {
    const lsw = (x & 0xFFFF) + (y & 0xFFFF);
    const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xFFFF);
  }

  // Convert string to UTF-8 encoded array
  const utf8 = unescape(encodeURIComponent(str));
  const len = utf8.length;
  const words = [];

  for (let i = 0; i < len; i++) {
    words[i >> 2] |= (utf8.charCodeAt(i) & 0xFF) << ((i % 4) << 3);
  }

  // Append padding
  words[len >> 2] |= 0x80 << ((len % 4) << 3);
  words[(((len + 8) >> 6) << 4) + 14] = len << 3;

  // MD5 constants
  const T = new Array(64);
  for (let i = 0; i < 64; i++) {
    T[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000);
  }

  // Initialize state
  let a = 0x67452301;
  let b = 0xEFCDAB89;
  let c = 0x98BADCFE;
  let d = 0x10325476;

  // Process each 16-word block
  for (let i = 0; i < words.length; i += 16) {
    const aa = a, bb = b, cc = c, dd = d;

    // Round 1
    const s1 = [7, 12, 17, 22];
    for (let j = 0; j < 16; j++) {
      const f = (b & c) | (~b & d);
      const temp = d;
      d = c;
      c = b;
      b = addUnsigned(b, rotateLeft(addUnsigned(addUnsigned(a, f), addUnsigned(T[j], words[i + j] || 0)), s1[j % 4]));
      a = temp;
    }

    // Round 2
    const s2 = [5, 9, 14, 20];
    for (let j = 16; j < 32; j++) {
      const f = (d & b) | (~d & c);
      const k = (5 * (j - 16) + 1) % 16;
      const temp = d;
      d = c;
      c = b;
      b = addUnsigned(b, rotateLeft(addUnsigned(addUnsigned(a, f), addUnsigned(T[j], words[i + k] || 0)), s2[(j - 16) % 4]));
      a = temp;
    }

    // Round 3
    const s3 = [4, 11, 16, 23];
    for (let j = 32; j < 48; j++) {
      const f = b ^ c ^ d;
      const k = (3 * (j - 32) + 5) % 16;
      const temp = d;
      d = c;
      c = b;
      b = addUnsigned(b, rotateLeft(addUnsigned(addUnsigned(a, f), addUnsigned(T[j], words[i + k] || 0)), s3[(j - 32) % 4]));
      a = temp;
    }

    // Round 4
    const s4 = [6, 10, 15, 21];
    for (let j = 48; j < 64; j++) {
      const f = c ^ (b | ~d);
      const k = (7 * (j - 48)) % 16;
      const temp = d;
      d = c;
      c = b;
      b = addUnsigned(b, rotateLeft(addUnsigned(addUnsigned(a, f), addUnsigned(T[j], words[i + k] || 0)), s4[(j - 48) % 4]));
      a = temp;
    }

    a = addUnsigned(a, aa);
    b = addUnsigned(b, bb);
    c = addUnsigned(c, cc);
    d = addUnsigned(d, dd);
  }

  // Convert to hex string
  const toHex = (n) => {
    let s = '';
    for (let i = 0; i < 4; i++) {
      s += ((n >> (i * 8)) & 0xFF).toString(16).padStart(2, '0');
    }
    return s;
  };

  return toHex(a) + toHex(b) + toHex(c) + toHex(d);
}

export function getGravatarUrl(email, size = 40) {
  if (!email) return null;
  const hash = md5(email.trim().toLowerCase());
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=identicon`;
}
