import { z } from "zod";
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";

export type SignupCountry = CountryCode;
export const DEFAULT_PHONE_COUNTRY: SignupCountry = "SN";
type SignupLocale = "fr" | "en";
type PhoneCountry = { country: SignupCountry; name: string; dialCode: string };
const countryOptions = new Map<SignupLocale, PhoneCountry[]>();

/** All supported territories come from phone metadata, names/order from locale data. */
export function getPhoneCountries(locale: SignupLocale): PhoneCountry[] {
  const cached = countryOptions.get(locale);
  if (cached) return cached;
  const names = new Intl.DisplayNames([locale], { type: "region" });
  const collator = new Intl.Collator(locale);
  const options = getCountries().map(country => ({
    country, name: names.of(country) ?? country, dialCode: `+${getCountryCallingCode(country)}`,
  })).sort((a, b) => collator.compare(a.name, b.name));
  countryOptions.set(locale, options);
  return options;
}

export function makeSignupSchema(locale: SignupLocale = "fr", country: SignupCountry = DEFAULT_PHONE_COUNTRY) {
  const t = (fr: string, en: string) => locale === "fr" ? fr : en;
  return z.object({
    email: z.string().trim().max(254).refine(value => value === "" || z.email().safeParse(value).success, t("Vérifie l’adresse e-mail.", "Check your email address.")),
    phone: z.string().trim().transform((value, ctx) => {
      if (!value) return "";
      const invalid = t("Vérifie le numéro pour le pays choisi (longueur et chiffres).", "Check the number for the selected country (length and digits).");
      // Do not extract a number from prose, accept extensions, or truncate pasted data.
      if (value.length > 64 || !/^\+?[\d\s().-]+$/u.test(value)) {
        ctx.addIssue({ code: "custom", message: invalid });
        return z.NEVER;
      }
      const phone = parsePhoneNumberFromString(value, { defaultCountry: country, extract: false });
      if (!phone?.isValid() || !phone.isPossible() || phone.ext) {
        ctx.addIssue({ code: "custom", message: invalid });
        return z.NEVER;
      }
      // A full pasted number must agree with the explicit selection, including shared codes.
      if (phone.country !== country) {
        const destination = getPhoneCountries(locale).find(option => option.country === phone.country);
        const label = destination ? `${destination.name} (${destination.dialCode})` : `+${phone.countryCallingCode}`;
        ctx.addIssue({ code: "custom", message: t(
          `Ce numéro correspond à ${label}. Choisis ce pays ou corrige le numéro.`,
          `This number matches ${label}. Select that country or correct the number.`,
        ) });
        return z.NEVER;
      }
      return phone.number;
    }),
    note: z.string().trim().max(1000, t("1 000 caractères maximum.", "Up to 1,000 characters.")),
    consent: z.boolean().refine(value => value, t("Ton accord est nécessaire pour te recontacter.", "Permission is required to contact you.")),
  }).superRefine((value, ctx) => {
    if (Boolean(value.email) === Boolean(value.phone)) {
      const message = t("Indique un e-mail OU un téléphone, pas les deux.", "Enter an email OR a phone number, not both.");
      ctx.addIssue({ code: "custom", path: ["email"], message });
      ctx.addIssue({ code: "custom", path: ["phone"], message });
    }
  });
}
export const signupSchema = makeSignupSchema();
export type SignupValues = z.infer<typeof signupSchema>;
