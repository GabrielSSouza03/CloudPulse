// Deliberate violations, asserted by test/unit/boundaries.test.ts. Never import this file.
import { Injectable } from '@nestjs/common';
import { secretOf } from '../../ledger/internal/secret.js';
import { InvoiceRepository } from '../infrastructure/invoice.repository.js';

@Injectable()
export class Invoice {
  readonly secret = secretOf();
  readonly repository = InvoiceRepository;
}
