import * as hsluv from "hsluv";

import * as consts from "./consts";

export type XYCoord = number;
export type IdCoord = number;

export function wrap(x: number): XYCoord {
    return ((x % consts.SIZE) + consts.SIZE) % consts.SIZE;
}

export function hash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash *= 31;
        hash += str.charCodeAt(i);
        hash |= 0;
    }
    return hash;
}

export function cidToColor(cid: string): [ number, number, number ] {
    const cidHash = hash(cid);
    const rgb = hsluv.hsluvToRgb([ cidHash % 360, 80, 60 ]);
    return rgb.map(x => 255 * x) as [ number, number, number ];
}

export function xy2id(x: XYCoord, y: XYCoord): IdCoord {
    return 9 * y + x;
}
export function id2xy(id: IdCoord): [ XYCoord, XYCoord ] {
    return [ id % 9, (id / 9) | 0 ];
}
export function bx2id(box: number, idx: number): number {
    const boxId = 27 * ((box / 3) | 0) + 3 * (box % 3);
    const idxId =    9 * ((idx / 3) | 0) +         (idx % 3);
    return boxId + idxId;
}

export function cornerMarkPos(i: number, len: number): [ number, number ] {
    let dx: number, dy: number;
    if (len <= 4) {
        dx = (i % 2) * 60 - 30;
        dy = ((i / 2) | 0) * 60 - 30;
    }
    else {
        const half = (len / 2) | 0;
        if (i < half) {
            const d = 60 / (half - 1);
            dx = i * d - 30;
            dy = -30;
        }
        else {
            const d = 60 / (len - half - 1);
            dx = (i - half) * d - 30;
            dy = 30;
        }
    }
    return [ dx, dy ];
}

export function formatSecs(secs: number): string {
    const nums: number[] = [];
    // Seconds.
    nums.unshift(secs % 60);
    secs = (secs / 60) | 0;
    // Minutes.
    nums.unshift(secs % 60);
    secs = (secs / 60) | 0;
    // Hours.
    if (secs) nums.unshift(secs);

    return nums
        .map(n => n.toString())
        .map((s, i) => i ? s.padStart(2, '0') : s)
        .join(':');
}

export function checkGrid(filled: Record<IdCoord, number>): Set<IdCoord> {
    const bad = new Set<number>();
    const coordFns = [
        xy2id, // Rows.
        (i: number, j: number) => xy2id(j, i), // Cols.
        bx2id, // Boxes.
    ];
    for (const coordFn of coordFns) {
        for (let i = 0; i < consts.SIZE; i++) {
            const valToId: Record<number, IdCoord> = {};
            for (let j = 0; j < consts.SIZE; j++) {
                const id = coordFn(i, j);
                const val = filled[id];
                if (!val) bad.add(id);
                else if (val in valToId) {
                    bad.add(valToId[val]);
                    bad.add(id);
                }
                else valToId[val] = id;
            }
        }
    }
    return bad;
}

export const stringifyNums = (nums: Record<number, boolean>) => Object.entries(nums)
    .filter(([ _, flag ]) => flag)
    .map(([ num ]) => num)
    .join('');

export function rleEncode(grid: number[]): string {
    if (!Array.isArray(grid))
        throw Error(`Attempted to encode non-array grid: ${grid}.`);
    if (81 !== grid.length)
        throw Error(`Attempted to encode invalid grid (length ${grid.length}): [${grid.join(', ')}].`);

    const out = [];
    let zeros = 0;
    for (const x of grid) {
        if (x || zeros >= 27) {
            if (1 === zeros) out.push(0);
            else if (1 < zeros) out.push(String.fromCharCode(63 + zeros));
            zeros = 0;
        }
        if (x) {
            out.push(x);
        }
        else zeros++;
    }
    return out.join('');
}

export function rleDecode(rle: string): (number | null)[] {
    const grid: (number | null)[] = [];
    for (let i = 0; i < rle.length; i++) {
        const c = rle.charCodeAt(i);
        if (65 <= c && c <= 90) {
            grid.push(...new Array<null>(c - 63).fill(null));
        }
        else if (48 <= c && c <= 57) {
            grid.push((c - 48) || null);
        }
        else {
            throw Error(`Invalid RLE character: ${rle[i]}, code: ${c}.`);
        }
    }

    if (81 !== grid.length)
        throw Error(`Decoded grid has invalid length: ${grid.length}.`);

    return grid;
}
