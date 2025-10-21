/* eslint-env jest */

const SymbolStripping = require('../../components/SanitizationPipeline/symbol-stripping.js');

describe('SymbolStripping', () => {
  let stripper;

  beforeEach(() => {
    stripper = new SymbolStripping();
  });

  test('removes zero-width space', () => {
    const input = 'Hello\u200BWorld';
    const expected = 'HelloWorld';
    expect(stripper.sanitize(input)).toBe(expected);
  });

  test('removes zero-width non-joiner', () => {
    const input = 'Test\u200CData';
    const expected = 'TestData';
    expect(stripper.sanitize(input)).toBe(expected);
  });

  test('removes zero-width joiner', () => {
    const input = 'Join\u200DHere';
    const expected = 'JoinHere';
    expect(stripper.sanitize(input)).toBe(expected);
  });

  test('removes left-to-right mark', () => {
    const input = 'LTR\u200EMark';
    const expected = 'LTRMark';
    expect(stripper.sanitize(input)).toBe(expected);
  });

  test('removes right-to-left mark', () => {
    const input = 'RTL\u200FMark';
    const expected = 'RTLMark';
    expect(stripper.sanitize(input)).toBe(expected);
  });

  test('removes byte order mark', () => {
    const input = '\uFEFFStart';
    const expected = 'Start';
    expect(stripper.sanitize(input)).toBe(expected);
  });

  test('removes control characters', () => {
    const input = 'Line\u0000Control\u001FEnd';
    const expected = 'LineControlEnd';
    expect(stripper.sanitize(input)).toBe(expected);
  });

  test('keeps tab, line feed, carriage return', () => {
    const input = 'Tab\tLF\nCR\r';
    const expected = 'Tab\tLF\nCR\r';
    expect(stripper.sanitize(input)).toBe(expected);
  });

  test('handles empty string', () => {
    const input = '';
    const expected = '';
    expect(stripper.sanitize(input)).toBe(expected);
  });

  test('handles string with only bad characters', () => {
    const input = '\u200B\u0000\u200C';
    const expected = '';
    expect(stripper.sanitize(input)).toBe(expected);
  });

  test('mixed valid and invalid characters', () => {
    const input = 'Valid\u200BText\u0001More\u200D';
    const expected = 'ValidTextMore';
    expect(stripper.sanitize(input)).toBe(expected);
  });

  test('no changes for valid string', () => {
    const input = 'Hello World 123 !@#';
    const expected = 'Hello World 123 !@#';
    expect(stripper.sanitize(input)).toBe(expected);
  });
});
