import { v7, validate, version } from 'uuid';

/** Time-ordered UUIDv7. Sorts by creation time, which keeps B-tree inserts append-mostly. */
export function newId(): string {
  return v7();
}

export function isUuid(value: string): boolean {
  return validate(value);
}

export function isUuidV7(value: string): boolean {
  return validate(value) && version(value) === 7;
}
