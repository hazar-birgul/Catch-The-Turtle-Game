import { describe, expect, it } from 'vitest';

import { joinBase, normalizeBase, resolveBase } from './paths';

describe('normalizeBase', () => {
  it('treats empty and root values as the domain root', () => {
    expect(normalizeBase('')).toBe('/');
    expect(normalizeBase('/')).toBe('/');
    expect(normalizeBase('   ')).toBe('/');
  });

  it('adds the leading and trailing slashes Vite expects', () => {
    expect(normalizeBase('Catch-The-Turtle-Game')).toBe('/Catch-The-Turtle-Game/');
    expect(normalizeBase('/Catch-The-Turtle-Game')).toBe('/Catch-The-Turtle-Game/');
    expect(normalizeBase('Catch-The-Turtle-Game/')).toBe('/Catch-The-Turtle-Game/');
    expect(normalizeBase('/Catch-The-Turtle-Game/')).toBe('/Catch-The-Turtle-Game/');
  });

  it('collapses redundant edge slashes', () => {
    expect(normalizeBase('//Catch-The-Turtle-Game//')).toBe('/Catch-The-Turtle-Game/');
  });

  it('preserves nested paths', () => {
    expect(normalizeBase('/games/turtle')).toBe('/games/turtle/');
  });

  it('keeps absolute URLs intact', () => {
    expect(normalizeBase('https://cdn.example.com/turtle')).toBe('https://cdn.example.com/turtle/');
    expect(normalizeBase('https://cdn.example.com/turtle/')).toBe(
      'https://cdn.example.com/turtle/',
    );
  });
});

describe('resolveBase', () => {
  it('defaults to the domain root for local development', () => {
    expect(resolveBase({})).toBe('/');
  });

  it('derives the base from GITHUB_REPOSITORY in CI', () => {
    expect(resolveBase({ GITHUB_REPOSITORY: 'hazar-birgul/Catch-The-Turtle-Game' })).toBe(
      '/Catch-The-Turtle-Game/',
    );
  });

  it('uses the domain root for user and organisation GitHub Pages sites', () => {
    expect(resolveBase({ GITHUB_REPOSITORY: 'hazar-birgul/hazar-birgul.github.io' })).toBe('/');
  });

  it('lets an explicit VITE_BASE override the CI-derived value', () => {
    expect(
      resolveBase({
        VITE_BASE: '/preview/',
        GITHUB_REPOSITORY: 'hazar-birgul/Catch-The-Turtle-Game',
      }),
    ).toBe('/preview/');
  });

  it('ignores a blank VITE_BASE rather than producing an empty base', () => {
    expect(resolveBase({ VITE_BASE: '   ' })).toBe('/');
  });

  it('ignores a malformed GITHUB_REPOSITORY value', () => {
    expect(resolveBase({ GITHUB_REPOSITORY: 'no-slash-here' })).toBe('/');
    expect(resolveBase({ GITHUB_REPOSITORY: 'owner/' })).toBe('/');
  });
});

describe('joinBase', () => {
  it('resolves asset paths against the domain root', () => {
    expect(joinBase('/', 'assets/sprites/turtle.png')).toBe('/assets/sprites/turtle.png');
  });

  it('resolves asset paths against a repository subpath', () => {
    expect(joinBase('/Catch-The-Turtle-Game/', 'assets/sprites/turtle.png')).toBe(
      '/Catch-The-Turtle-Game/assets/sprites/turtle.png',
    );
  });

  it('does not produce a double slash when the path is already rooted', () => {
    expect(joinBase('/Catch-The-Turtle-Game/', '/assets/turtle.png')).toBe(
      '/Catch-The-Turtle-Game/assets/turtle.png',
    );
  });

  it('normalises a base that is missing its trailing slash', () => {
    expect(joinBase('/Catch-The-Turtle-Game', 'assets/turtle.png')).toBe(
      '/Catch-The-Turtle-Game/assets/turtle.png',
    );
  });

  it('leaves absolute and protocol-relative URLs untouched', () => {
    expect(joinBase('/Catch-The-Turtle-Game/', 'https://cdn.example.com/turtle.png')).toBe(
      'https://cdn.example.com/turtle.png',
    );
    expect(joinBase('/Catch-The-Turtle-Game/', '//cdn.example.com/turtle.png')).toBe(
      '//cdn.example.com/turtle.png',
    );
  });
});
