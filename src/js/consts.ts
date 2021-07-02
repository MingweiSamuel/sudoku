import * as hsluv from "hsluv";

export const NS_SVG = 'http://www.w3.org/2000/svg';

export enum Mode {
  GIVENS = 'givens',
  FILLED = 'filled',
  CORNER = 'corner',
  CENTER = 'center',
  COLORS = 'colors',
  DRAWING = 'drawing',
  ERASING = 'erasing',
}

export const MODE_CYCLE = [ Mode.FILLED, Mode.CORNER, Mode.CENTER, Mode.COLORS ];

export const DELETE_ORDER = [
  Mode.FILLED,
  Mode.CORNER,
  Mode.CENTER,
  Mode.COLORS,
  Mode.DRAWING, // Ignored.
  Mode.DRAWING, // Ignored.
] as const;

export const BLOCKED_BY_GIVENS = {
  [Mode.GIVENS]: false,
  [Mode.FILLED]: true,
  [Mode.CORNER]: true,
  [Mode.CENTER]: true,
  [Mode.COLORS]: false,
  [Mode.DRAWING]: false, // Ignored.
  [Mode.ERASING]: false, // Ignored.
} as const;

export const BLOCKED_BY_FILLED = {
  [Mode.GIVENS]: false,
  [Mode.FILLED]: false,
  [Mode.CORNER]: true,
  [Mode.CENTER]: true,
  [Mode.COLORS]: false,
  [Mode.DRAWING]: false, // Ignored.
  [Mode.ERASING]: false, // Ignored.
} as const;

export const SIZE = 9;

export const CODES = {
  Delete: null,
  Backspace: null,
  Backquote: 0,
  KeyQ: 4,
  KeyW: 5,
  KeyE: 6,
  KeyA: 7,
  KeyS: 8,
  KeyD: 9,
} as const;

export const ARROWS = {
  ArrowUp:    [  0, -1 ],
  ArrowDown:  [  0,  1 ],
  ArrowLeft:  [ -1,  0 ],
  ArrowRight: [  1,  0 ],
} as const;

export const COLORS = [
  [ 0.07, 0.07, 0.07, 1 ],
  [ 0.4, 0.4, 0.4, 0.6 ],
  [ 0.7, 0.7, 0.7, 0.6 ],
  hsluv.hsluvToRgb([  10, 100, 60 ]),
  hsluv.hsluvToRgb([  40, 100, 65 ]),
  hsluv.hsluvToRgb([  70, 100, 90 ]).concat(0.8),
  hsluv.hsluvToRgb([ 120, 100, 80 ]),
  hsluv.hsluvToRgb([ 230, 100, 85 ]),
  hsluv.hsluvToRgb([ 260, 100, 55 ]),
  hsluv.hsluvToRgb([ 300, 100, 70 ]),
].map(row => {
  for (let i = 0; i < 3; i++) {
    row[i] *= 255;
    row[i] |= 0;
  }
  row.length < 4 && row.push(0.6);
  return row as [ number, number, number, number ];
});
