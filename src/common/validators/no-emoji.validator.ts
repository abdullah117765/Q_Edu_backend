import {
    registerDecorator,
    ValidationArguments,
    ValidationOptions,
} from 'class-validator';

// Matches emoji presentation, pictographs, symbols, regional indicators, and ZWJ sequences.
// Uses Unicode property escapes (Node 12+).
export const EMOJI_REGEX =
  /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u200D\uFE0F]/u;

export function NoEmoji(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'noEmoji',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (value === null || value === undefined) return true;
          if (typeof value !== 'string') return false;
          return !EMOJI_REGEX.test(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must not contain emoji or pictographic characters`;
        },
      },
    });
  };
}
