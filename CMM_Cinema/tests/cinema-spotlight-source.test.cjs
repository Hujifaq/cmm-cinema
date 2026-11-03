const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { transformSync } = require('esbuild');

// Use the project's TSX compiler to normalize both files, then compare every
// motion prop. Skin, cinema data, and event wiring are deliberately excluded.
function animationContract(path) {
  const code = transformSync(readFileSync(path, 'utf8'), { loader: 'tsx', jsx: 'preserve', minifyWhitespace: true }).code;
  const keys = new Set(['initial', 'animate', 'exit', 'transition', 'layout', 'layoutId', 'mode']);
  const contract = [];
  const tags = /<(motion\.\w+|AnimatePresence)\b/g;
  const quotedEnd = start => {
    const quote = code[start];
    let cursor = start + 1;
    while (cursor < code.length) {
      if (code[cursor] === '\\') cursor += 2;
      else if (code[cursor++] === quote) return cursor;
    }
    throw new Error('Unclosed string');
  };
  let tag;
  while ((tag = tags.exec(code))) {
    let cursor = tags.lastIndex;
    const attributes = [];
    while (cursor < code.length) {
      while (/\s/.test(code[cursor])) cursor++;
      if (code[cursor] === '>' || code[cursor] === '/') break;
      const name = /^[\w:-]+/.exec(code.slice(cursor));
      assert.ok(name, 'expected a JSX attribute');
      cursor += name[0].length;
      while (/\s/.test(code[cursor])) cursor++;
      let value = true;
      if (code[cursor] === '=') {
        cursor++;
        const start = cursor;
        if (code[cursor] === '{') {
          let depth = 1;
          cursor++;
          while (depth) {
            if ('\'"`'.includes(code[cursor])) cursor = quotedEnd(cursor);
            else {
              if (code[cursor] === '{') depth++;
              if (code[cursor] === '}') depth--;
              cursor++;
            }
          }
        } else cursor = quotedEnd(cursor);
        value = code.slice(start, cursor);
      }
      if (keys.has(name[0])) attributes.push([name[0], value]);
    }
    contract.push({ tag: tag[1], attributes });
    tags.lastIndex = cursor;
  }
  return contract;
}

test('every Spotlight motion prop and presence mode matches the supplied source exactly', () => {
  const reference = animationContract(require.resolve('./fixtures/apple-spotlight-source.tsx.txt'));
  const component = animationContract(require.resolve('../components/ui/apple-spotlight.tsx'));
  assert.deepEqual(component, reference);
});
