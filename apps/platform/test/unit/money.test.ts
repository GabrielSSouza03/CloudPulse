import { describe, expect, it } from 'vitest';
import { CurrencyMismatchError, InvalidMoneyError, Money } from '../../src/shared-kernel/money.js';

describe('Money', () => {
  it('keeps per-token prices exact where floats drift', () => {
    const perToken = Money.of('3', 'USD').divide('1000000');
    const total = perToken.multiply('1400');
    expect(total.toString()).toBe('0.004200000000');
    // 0.1 + 0.2 in floating point is 0.30000000000000004
    expect(Money.of('0.1', 'USD').add(Money.of('0.2', 'USD')).toString()).toBe('0.300000000000');
  });

  it('rounds to 12 decimal places with HALF_EVEN', () => {
    expect(Money.of('0.0000000000005', 'USD').toString()).toBe('0.000000000000');
    expect(Money.of('0.0000000000015', 'USD').toString()).toBe('0.000000000002');
    expect(Money.of('1', 'USD').divide('3').toString()).toBe('0.333333333333');
  });

  it('rounds display amounts to the currency minor unit with HALF_EVEN', () => {
    expect(Money.of('2.345', 'USD').toDisplayString()).toBe('2.34');
    expect(Money.of('2.355', 'USD').toDisplayString()).toBe('2.36');
    expect(Money.of('1234.5', 'JPY').toDisplayString()).toBe('1234');
    expect(Money.of('1.2345', 'KWD').toDisplayString()).toBe('1.234');
  });

  it('refuses numbers, malformed strings and bad currencies', () => {
    expect(() => Money.of(0.1 as unknown as string, 'USD')).toThrow(InvalidMoneyError);
    expect(() => Money.of('1e5', 'USD')).toThrow(InvalidMoneyError);
    expect(() => Money.of('01.5', 'USD')).toThrow(InvalidMoneyError);
    expect(() => Money.of('1', 'usd')).toThrow(InvalidMoneyError);
    expect(() => Money.of('1', 'USD').divide('0')).toThrow(InvalidMoneyError);
  });

  it('never mixes currencies', () => {
    expect(() => Money.of('1', 'USD').add(Money.of('1', 'EUR'))).toThrow(CurrencyMismatchError);
    expect(() => Money.of('1', 'USD').compare(Money.of('1', 'EUR'))).toThrow(CurrencyMismatchError);
    expect(Money.of('1', 'USD').equals(Money.of('1', 'EUR'))).toBe(false);
  });

  it('compares, negates and serializes', () => {
    const a = Money.of('1.5', 'USD');
    expect(a.compare(Money.of('1.50', 'USD'))).toBe(0);
    expect(a.subtract(Money.of('2', 'USD')).isNegative()).toBe(true);
    expect(Money.of('-0', 'USD').isNegative()).toBe(false);
    expect(a.negate().negate().equals(a)).toBe(true);
    expect(JSON.parse(JSON.stringify(a))).toEqual({ amount: '1.500000000000', currency: 'USD' });
  });
});
