import { validate } from 'class-validator';
import { NoEmoji, EMOJI_REGEX } from './no-emoji.validator';

class Sample {
  @NoEmoji()
  name?: string | null;
}

describe('NoEmoji validator', () => {
  it('rejects strings containing emoji', async () => {
    const dto = new Sample();
    dto.name = 'Hello 👋';
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.noEmoji).toMatch(/emoji/i);
  });

  it('rejects pictographic / symbol characters', async () => {
    const dto = new Sample();
    dto.name = 'fire ❤️';
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
  });

  it('rejects regional indicator (flags)', async () => {
    const dto = new Sample();
    dto.name = '🇺🇸';
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
  });

  it('accepts plain ASCII names', async () => {
    const dto = new Sample();
    dto.name = "John O'Brien-Smith";
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts unicode letters without emoji', async () => {
    const dto = new Sample();
    dto.name = 'Zoë Müller';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('treats null and undefined as valid', async () => {
    const a = new Sample();
    a.name = null;
    const b = new Sample();
    b.name = undefined;
    expect(await validate(a)).toHaveLength(0);
    expect(await validate(b)).toHaveLength(0);
  });

  it('rejects non-string values', async () => {
    const dto = new Sample();
    (dto as any).name = 123;
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
  });

  it('exports a regex covering common emoji', () => {
    expect(EMOJI_REGEX.test('🚀')).toBe(true);
    expect(EMOJI_REGEX.test('plain')).toBe(false);
  });
});
