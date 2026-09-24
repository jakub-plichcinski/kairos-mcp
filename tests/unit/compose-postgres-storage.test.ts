import { expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';

interface ComposeService {
  image?: string;
  volumes?: string[];
}

interface ComposeConfig {
  services?: Record<string, ComposeService>;
}

it('mounts PostgreSQL 18 storage at its supported parent directory', () => {
  const compose = load(readFileSync('compose.yaml', 'utf8')) as ComposeConfig;
  const postgres = compose.services?.postgres;

  expect(postgres?.image).toMatch(/^postgres:18(?:\.|-)/);
  expect(postgres?.volumes).toContain('postgres-data:/var/lib/postgresql');
  expect(postgres?.volumes).not.toContain('postgres-data:/var/lib/postgresql/data');
});
