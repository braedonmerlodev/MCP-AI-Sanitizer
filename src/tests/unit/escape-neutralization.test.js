/* eslint-env jest */

const EscapeNeutralization = require('../../components/SanitizationPipeline/escape-neutralization.js');

describe('EscapeNeutralization', () => {
  let neutralizer;

  beforeEach(() => {
    neutralizer = new EscapeNeutralization();
  });

  test('removes ANSI color code', () => {
    const input = 'Hello\u001B[31mWorld\u001B[0m';
    const expected = 'HelloWorld';
    expect(neutralizer.sanitize(input)).toBe(expected);
  });

  test('removes ANSI cursor movement', () => {
    const input = 'Text\u001B[2JClear';
    const expected = 'TextClear';
    expect(neutralizer.sanitize(input)).toBe(expected);
  });

  test('removes multiple ANSI sequences', () => {
    const input = '\u001B[1mBold\u001B[0m and \u001B[32mGreen\u001B[0m';
    const expected = 'Bold and Green';
    expect(neutralizer.sanitize(input)).toBe(expected);
  });

  test('handles incomplete ANSI sequence', () => {
    const input = 'Test\u001B[31';
    const expected = 'Test\u001B[31'; // Incomplete not removed
    expect(neutralizer.sanitize(input)).toBe(expected);
  });

  test('keeps valid text without escapes', () => {
    const input = 'Normal text here';
    const expected = 'Normal text here';
    expect(neutralizer.sanitize(input)).toBe(expected);
  });

  test('removes ANSI with parameters', () => {
    const input = 'Start\u001B[1;31mRed Bold\u001B[0mEnd';
    const expected = 'StartRed BoldEnd';
    expect(neutralizer.sanitize(input)).toBe(expected);
  });

  test('handles empty string', () => {
    const input = '';
    const expected = '';
    expect(neutralizer.sanitize(input)).toBe(expected);
  });

  test('mixed valid and ANSI', () => {
    const input = 'Valid\u001B[31mRed\u001B[0mMore';
    const expected = 'ValidRedMore';
    expect(neutralizer.sanitize(input)).toBe(expected);
  });

  test('ANSI at start and end', () => {
    const input = '\u001B[2mStart\u001B[0m';
    const expected = 'Start';
    expect(neutralizer.sanitize(input)).toBe(expected);
  });
});
