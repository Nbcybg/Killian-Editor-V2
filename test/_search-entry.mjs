// test/_search-entry.mjs — search.js + prosemirror ในบันเดิลเดียว (ให้ test/search-lock.test.cjs ใช้สำเนาเดียวกัน)
export * from '../src/search.js';
export { Schema } from 'prosemirror-model';
export { EditorState } from 'prosemirror-state';
