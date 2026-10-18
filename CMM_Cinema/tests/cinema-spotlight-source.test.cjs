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

// Deliberate departures from the source, all in service of the glass panel and a softer entrance:
// - the gooey `url(#blob)` filter is dropped (a CSS filter on an ancestor stops backdrop blur from
//   seeing the page) and cleared once the entrance settles;
// - the entrance uses a slower, bouncier spring, with opacity and blur on plain tweens so they never
//   overshoot, and the exit stays a quick tween;
// - shortcut circles fade as they slide, since without the gooey merge they would pile up as dark
//   discs at the end of the pill.
// Every other motion prop must still match.
const departures = [
  [' url(#blob)', ''],
  ['filter:\\"blur(0px)\\",scaleX:1,scaleY:1,y:0}}', 'filter:\\"blur(0px)\\",scaleX:1,scaleY:1,y:0,transitionEnd:{filter:\\"none\\"}}}'],
  ['y:10}}', 'y:10,transition:{duration:.3,ease:\\"easeIn\\"}}}'],
  ['{{stiffness:550,damping:50,type:\\"spring\\"}}', '{{type:\\"spring\\",stiffness:170,damping:17,opacity:{duration:.5,ease:\\"easeOut\\"},filter:{duration:.6,ease:\\"easeOut\\"}}}'],
  ['{{scale:.7,x:-1*(64*(index+1))}}', '{{scale:.7,x:-1*(64*(index+1)),opacity:0}}'],
  ['{{scale:1,x:0}}', '{{scale:1,x:0,opacity:1}}'],
  ['index-1))}}', 'index-1)),opacity:0}}'],
  ['delay:index*.05}}', 'delay:index*.05,opacity:{duration:.3,ease:\\"easeOut\\",delay:index*.05}}}'],
];
const glass = contract => JSON.parse(departures.reduce((json, [from, to]) => json.replaceAll(from, to), JSON.stringify(contract)));

test('every Spotlight motion prop and presence mode matches the supplied source exactly', () => {
  const reference = animationContract(require.resolve('./fixtures/apple-spotlight-source.tsx.txt'));
  const component = animationContract(require.resolve('../components/ui/apple-spotlight.tsx'));
  assert.deepEqual(component, glass(reference));
});
