const path = require('path');

describe('Sketch API polygon JSON helpers', () => {
  let Sketch;
  beforeEach(() => {
    jest.resetModules();
    Sketch = require('./ceditor.js');
  });

  test('empty polygon list returns empty string', () => {
    expect(Sketch.polygonsToJson()).toBe('');
  });

  test('circle round-trips through JSON', () => {
    const circle = { t: 'circle', s: [0, 0], e: [10, 0], ss: '#000', lw: 2, fs: '#ffffff' };
    Sketch.polygonsFromJson([circle]);
    const json = Sketch.polygonsToJson();
    const parsed = JSON.parse(json);
    expect(parsed).toEqual([circle]);
  });
});
