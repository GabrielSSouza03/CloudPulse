import { Decimal } from 'decimal.js';

/** Internal monetary scale. Matches PostgreSQL `NUMERIC(38,12)`. */
export const MONEY_SCALE = 12;

const MoneyDecimal = Decimal.clone({ precision: 50, rounding: Decimal.ROUND_HALF_EVEN });

const DECIMAL_PATTERN = /^-?(0|[1-9][0-9]{0,25})(\.[0-9]{1,30})?$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

/** Minor-unit digits for display rounding. Unknown currencies default to 2. */
const MINOR_UNITS: Readonly<Record<string, number>> = { JPY: 0, KRW: 0, CLP: 0, BHD: 3, KWD: 3 };

export class CurrencyMismatchError extends Error {
  constructor(a: string, b: string) {
    super(`currency mismatch: ${a} vs ${b}`);
    this.name = 'CurrencyMismatchError';
  }
}

export class InvalidMoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidMoneyError';
  }
}

/**
 * Immutable monetary amount. Never constructed from a JS number: floats cannot represent
 * per-token prices exactly. Every result is normalized to {@link MONEY_SCALE} with HALF_EVEN.
 */
export class Money {
  private constructor(
    private readonly value: Decimal,
    readonly currency: string,
  ) {}

  static of(amount: string, currency: string): Money {
    if (typeof amount !== 'string' || !DECIMAL_PATTERN.test(amount)) {
      throw new InvalidMoneyError(`invalid decimal amount: ${String(amount)}`);
    }
    if (!CURRENCY_PATTERN.test(currency)) {
      throw new InvalidMoneyError(`invalid ISO 4217 currency: ${currency}`);
    }
    return new Money(Money.normalize(new MoneyDecimal(amount)), currency);
  }

  static zero(currency: string): Money {
    return Money.of('0', currency);
  }

  private static normalize(d: Decimal): Decimal {
    const n = d.toDecimalPlaces(MONEY_SCALE, Decimal.ROUND_HALF_EVEN);
    return n.isZero() ? new MoneyDecimal(0) : n;
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(Money.normalize(this.value.plus(other.value)), this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(Money.normalize(this.value.minus(other.value)), this.currency);
  }

  /** Multiplies by a decimal factor given as a string (e.g. a quantity or an FX rate). */
  multiply(factor: string): Money {
    if (!DECIMAL_PATTERN.test(factor)) throw new InvalidMoneyError(`invalid factor: ${factor}`);
    return new Money(Money.normalize(this.value.times(new MoneyDecimal(factor))), this.currency);
  }

  /** Divides by a positive decimal string, e.g. a pricing unit size such as `1000000`. */
  divide(divisor: string): Money {
    if (!DECIMAL_PATTERN.test(divisor)) throw new InvalidMoneyError(`invalid divisor: ${divisor}`);
    const d = new MoneyDecimal(divisor);
    if (d.isZero()) throw new InvalidMoneyError('division by zero');
    return new Money(Money.normalize(this.value.dividedBy(d)), this.currency);
  }

  negate(): Money {
    return new Money(Money.normalize(this.value.negated()), this.currency);
  }

  compare(other: Money): -1 | 0 | 1 {
    this.assertSameCurrency(other);
    return this.value.comparedTo(other.value) as -1 | 0 | 1;
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.value.equals(other.value);
  }

  isZero(): boolean {
    return this.value.isZero();
  }

  isNegative(): boolean {
    return this.value.isNegative() && !this.value.isZero();
  }

  /** Full-scale canonical string, suitable for storage and JSON (`"0.004200000000"`). */
  toString(): string {
    return this.value.toFixed(MONEY_SCALE);
  }

  /** Rounded to the currency's minor unit (HALF_EVEN). For display and invoice matching only. */
  toDisplayString(): string {
    return this.value.toFixed(MINOR_UNITS[this.currency] ?? 2, Decimal.ROUND_HALF_EVEN);
  }

  toJSON(): { amount: string; currency: string } {
    return { amount: this.toString(), currency: this.currency };
  }

  private assertSameCurrency(other: Money): void {
    if (other.currency !== this.currency)
      throw new CurrencyMismatchError(this.currency, other.currency);
  }
}
