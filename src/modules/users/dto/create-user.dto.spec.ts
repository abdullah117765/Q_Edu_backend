import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

const baseInput = {
  email: 'user@example.com',
  password: 'StrongPass123',
  firstName: 'Jane',
  lastName: 'Doe',
  phoneNumber: '+1 555 123 4567',
};

async function check(overrides: Partial<Record<string, unknown>>) {
  const dto = plainToInstance(CreateUserDto, { ...baseInput, ...overrides });
  return validate(dto);
}

describe('CreateUserDto', () => {
  it('accepts valid baseline payload', async () => {
    const errors = await check({});
    expect(errors).toHaveLength(0);
  });

  it('rejects emoji in firstName', async () => {
    const errors = await check({ firstName: 'Jane🚀' });
    expect(errors.some((e) => e.property === 'firstName')).toBe(true);
  });

  it('rejects emoji in email', async () => {
    const errors = await check({ email: 'jane🚀@example.com' });
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejects malformed email', async () => {
    const errors = await check({ email: 'not-an-email' });
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejects too-short password', async () => {
    const errors = await check({ password: '1234567' });
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('rejects too-long password', async () => {
    const errors = await check({ password: 'a'.repeat(129) });
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('rejects firstName longer than 80 characters', async () => {
    const errors = await check({ firstName: 'a'.repeat(81) });
    expect(errors.some((e) => e.property === 'firstName')).toBe(true);
  });

  it('rejects empty firstName', async () => {
    const errors = await check({ firstName: '' });
    expect(errors.some((e) => e.property === 'firstName')).toBe(true);
  });

  it('rejects email longer than 254 characters', async () => {
    const local = 'a'.repeat(245);
    const errors = await check({ email: `${local}@ex.com` });
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejects phone number with letters', async () => {
    const errors = await check({ phoneNumber: 'abc12345' });
    expect(errors.some((e) => e.property === 'phoneNumber')).toBe(true);
  });

  it('rejects phone number longer than 32 characters', async () => {
    const errors = await check({ phoneNumber: '+' + '1'.repeat(33) });
    expect(errors.some((e) => e.property === 'phoneNumber')).toBe(true);
  });

  it('allows lastName to be omitted', async () => {
    const errors = await check({ lastName: undefined });
    expect(errors).toHaveLength(0);
  });
});
