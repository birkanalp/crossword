import { v4 as uuidv4 } from 'uuid';
import type { GuestUser } from './types';

// ─── Guest ID Generation ──────────────────────────────────────────────────────
// IMPORTANT: guest_id is stored in a UUID column on the backend (db.schema.sql).
// It MUST be a plain UUID v4 string — no prefixes. Use user.type === 'guest'
// to distinguish guest sessions in the frontend, not the ID format.

/**
 * Generates a UUID v4 guest ID.
 * Contract: api.contract.json#/auth/schemes/guestId — format: <uuid-v4>
 */
export function generateGuestId(): string {
  return uuidv4();
}

/**
 * Creates a new GuestUser object with a freshly generated ID.
 */
export function createGuestUser(): GuestUser {
  return {
    type: 'guest',
    guestId: generateGuestId(),
    createdAt: new Date().toISOString(),
  };
}
