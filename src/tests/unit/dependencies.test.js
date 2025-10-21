const express = require('express');
const winston = require('winston');
const joi = require('joi');
const unorm = require('unorm');

describe('Dependencies Installation', () => {
  test('Express.js is installed and available', () => {
    expect(express).toBeDefined();
    expect(typeof express).toBe('function');
  });

  test('Winston is installed and available', () => {
    expect(winston).toBeDefined();
    expect(winston.Logger).toBeDefined();
  });

  test('Joi is installed and available', () => {
    expect(joi).toBeDefined();
    expect(typeof joi.string).toBe('function');
  });

  test('Unorm is installed and available', () => {
    expect(unorm).toBeDefined();
    expect(typeof unorm.nfc).toBe('function');
  });
});
