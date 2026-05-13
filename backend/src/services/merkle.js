/**
 * Merkle Tree — exact port of processor.py build_merkle_root().
 *
 * Python original:
 *   def build_merkle_root(hashes):
 *       if not hashes: return None
 *       if len(hashes) == 1: return hashes[0]
 *       new_level = []
 *       for i in range(0, len(hashes), 2):
 *           left = hashes[i]
 *           right = hashes[i+1] if i+1 < len(hashes) else hashes[i]
 *           combined = hashlib.sha256((left + right).encode()).hexdigest()
 *           new_level.append(combined)
 *       return build_merkle_root(new_level)
 *
 * The Node.js version below produces byte-for-byte identical output.
 * Key: we concatenate the two hex strings as plain text (left + right),
 * then SHA-256 hash that UTF-8 string — matching Python's .encode() default.
 */

import crypto from 'crypto';

export function buildMerkleRoot(hashes) {
    if (!hashes || hashes.length === 0) return null;
    if (hashes.length === 1) return hashes[0];

    const newLevel = [];
    for (let i = 0; i < hashes.length; i += 2) {
        const left = hashes[i];
        const right = (i + 1 < hashes.length) ? hashes[i + 1] : hashes[i];

        const combined = crypto
            .createHash('sha256')
            .update(left + right)   // plain string concat, same as Python
            .digest('hex');
        newLevel.push(combined);
    }

    return buildMerkleRoot(newLevel);
}
