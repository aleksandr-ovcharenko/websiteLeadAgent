// Fact validation: DOM/regex extraction produces FactCandidates; only
// validated candidates become business facts. Rejected candidates are kept
// with a rejection reason for diagnostics — UNKNOWN is better than wrong.
// ---------------------------------------------------------------------------
// Shared patterns
// ---------------------------------------------------------------------------
const YEAR_RANGE_RE = /(?<![\p{L}\p{N}])(18|19|20)\d{2}\s*[-–—\/]\s*(?:(18|19|20)\d{2}|\d{2})(?![\p{L}\p{N}])/u;
const REGISTRATION_CTX_RE = /(унп|инн|учнп|регистрац|рег\.?\s*№|рег\.?\s*номер|registration|tax\s*id|tax\s*number|vat|идентификац)/iu;
const BANK_CTX_RE = /(iban|bic|swift|р\/с|расч[её]тный|сч[её]т|account|банк|банковск|корр\.?\s*сч)/iu;
const EMPLOYEE_WORD_RE = /(сотрудник|работник|человек|персонал|persone|mitarbeiter|employee|staff|team\s*member|dipendente|collaborator)/iu;
const DAY_TOKEN_RE = /(пн|вт|ср|чт|пт|сб|вс|понедельник|вторник|среда|четверг|пятница|суббота|воскресенье|mon|tue|wed|thu|fri|sat|sun)/iu;
const TIMEISH_RE = /\d{1,2}[:.]\d{2}|\d{1,2}[-–—]\d{2}\s*(до|[-–—])\s*\d{1,2}[-–—]\d{2}/iu;
const OPENING_HOURS_RE = /(\d{1,2}[:.]\d{2}\s*[-–—]\s*\d{1,2}[:.]\d{2})|((пн|вт|ср|чт|пт|сб|вс|mon|tue|wed|thu|fri|sat|sun)[-.,]?\s*\d{1,2}[:.-]\d{2})|(\d{1,2}[-–—.]\d{2}\s*до\s*\d{1,2}[-–—.]\d{2})/iu;
const CATALOG_OR_SERVICE_TEXT_RE = /(каталог|проект[ыаеу]|дома|домов|\bм2\b|м²|кв\.?\s*м|от\s*\d+\s*до\s*\d+|до\s*\d+\s*м|цена|стоимость|руб|заказать|купить|услуг|portfolio|catalog|price|order|sqm|sq\.?\s*m)/iu;
// Street-type tokens: abbreviations must carry their dot (ул., пр-т, пер.)
// so words merely starting with the same letters (Приемная, Проект) don't
// count as an address signal.
const STREET_TOKEN_RE = /(ул\.|улица|улицу|проспект|пр[-.]т|пр\.|переулок|пер\.|площадь|пл\.|бульвар|бул\.|шоссе|набережная|наб\.|проезд|пр-д|просп\.|тракт|str\.|straße|strasse|street|road|avenue|ave\.|boulevard|blvd|lane|weg|platz|gasse|via|viale|rue|calles?)/iu;
const ADDRESS_LABEL_RE = /(адрес|address|находимся|расположен|located|office|офис|штаб-квартира|наш\s+офис|юридический\s+адрес|юр\.?\s*адрес)/iu;
const TIME_RE = /\b\d{1,2}[:.]\d{2}\b/;
// ---------------------------------------------------------------------------
// Phone
// ---------------------------------------------------------------------------
export function validatePhoneCandidate(raw, context = '') {
    const value = raw.replace(/\s+/g, ' ').trim();
    if (!value)
        return { ok: false, rejectionReason: 'EMPTY' };
    if (/[a-zA-Zа-яА-Я@]/.test(value))
        return { ok: false, rejectionReason: 'CONTAINS_NON_PHONE_CHARS' };
    if (YEAR_RANGE_RE.test(value))
        return { ok: false, rejectionReason: 'YEAR_RANGE' };
    if (BANK_CTX_RE.test(context) || BANK_CTX_RE.test(value))
        return { ok: false, rejectionReason: 'BANK_ACCOUNT' };
    // Concatenated unrelated numbers: more than one phone-length digit run.
    const digitRuns = value.match(/\d[\d\s()\-]{5,}\d/g) || [];
    if (digitRuns.length > 1)
        return { ok: false, rejectionReason: 'CONCATENATED' };
    const digits = value.replace(/\D/g, '');
    if (digits.length < 7)
        return { ok: false, rejectionReason: 'TOO_FEW_DIGITS' };
    if (digits.length > 15)
        return { ok: false, rejectionReason: 'TOO_MANY_DIGITS' };
    // Registration / tax IDs must not become phones.
    if (digits.length === 9 && REGISTRATION_CTX_RE.test(context)) {
        return { ok: false, rejectionReason: 'REGISTRATION_ID' };
    }
    // A bare 9-digit number with no phone formatting or context is ambiguous.
    if (digits.length === 9 && !/[+()]/.test(value) && !REGISTRATION_CTX_RE.test(context)) {
        return { ok: false, rejectionReason: 'AMBIGUOUS_NINE_DIGIT' };
    }
    // A 4-digit year embedded as a complete "number" (e.g. just "2023").
    if (/^(18|19|20)\d{2}$/.test(digits))
        return { ok: false, rejectionReason: 'YEAR' };
    return { ok: true, value };
}
// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------
const STRICT_EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const EMAIL_EXTRACT_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const IMAGE_OR_ASSET_RE = /\.(png|jpe?g|gif|svg|webp|css|js|woff2?|ico)$/i;
const PLACEHOLDER_DOMAIN_RE = /^(example|test|email|domain|your-?mail|sample|placeholder)\.[a-z]{2,}$/i;
export function validateEmailCandidate(raw, _context = '') {
    const match = raw.match(EMAIL_EXTRACT_RE);
    if (!match)
        return { ok: false, rejectionReason: 'NOT_AN_EMAIL' };
    let email = match[0];
    if (IMAGE_OR_ASSET_RE.test(email))
        return { ok: false, rejectionReason: 'IMAGE_FILENAME' };
    const at = email.indexOf('@');
    let local = email.slice(0, at);
    const domain = email.slice(at + 1);
    // A phone-tail glued to the local part (e.g. "100-38-88info@x.com") is
    // unrelated source noise — strip it only when it looks like a digit run.
    // A local part made only of digits/dashes is a phone fragment, not a mailbox.
    if (/^[\d.\-_]+$/.test(local))
        return { ok: false, rejectionReason: 'NUMERIC_LOCAL' };
    const noisy = local.match(/^[\d][\d.\-_]{3,}(?=[A-Za-z])/);
    if (noisy) {
        local = local.slice(noisy[0].length);
        if (local.length < 2)
            return { ok: false, rejectionReason: 'NOISY_PREFIX' };
        email = `${local}@${domain}`;
    }
    if (PLACEHOLDER_DOMAIN_RE.test(domain))
        return { ok: false, rejectionReason: 'PLACEHOLDER' };
    if (!STRICT_EMAIL_RE.test(email))
        return { ok: false, rejectionReason: 'INVALID_SYNTAX' };
    return { ok: true, value: email.toLowerCase() };
}
// ---------------------------------------------------------------------------
// Address
// ---------------------------------------------------------------------------
export function validateAddressCandidate(raw, context = '', source = '') {
    let value = raw.replace(/\s+/g, ' ').trim();
    // Candidates are often windowed text: "…помещений: ул. Цвирко, д. 78. Прием …"
    // When a label-colon precedes the street part, keep only the address tail and
    // cut the trailing sentence fragment after the address. Scan colons right to
    // left for the last split whose tail still looks like a postal address.
    for (let i = value.length - 1; i > 0; i--) {
        if (value[i] !== ':')
            continue;
        const tail = value.slice(i + 1).trim();
        if (STREET_TOKEN_RE.test(tail) && /\d/.test(tail)) {
            // Cut a trailing sentence fragment — but ". " after a known abbreviation
            // (д. 78, г. Минск, офис 414) is part of the address, not a sentence end.
            const ABBR_DOT = /(?:ул|д|г|им|пр|пер|стр|корп|оф|пом|эт|пл|наб|б-р|мкр)$/i;
            let sentEnd = -1;
            for (let j = tail.indexOf('. '); j !== -1; j = tail.indexOf('. ', j + 2)) {
                if (!ABBR_DOT.test(tail.slice(0, j).trimEnd().split(/\s+/).pop() || '')) {
                    sentEnd = j;
                    break;
                }
            }
            value = (sentEnd > 0 ? tail.slice(0, sentEnd) : tail).trim();
            break;
        }
    }
    if (value.length < 10)
        return { ok: false, rejectionReason: 'TOO_SHORT' };
    if (value.length > 160)
        return { ok: false, rejectionReason: 'TOO_LONG' };
    if (/@/.test(value))
        return { ok: false, rejectionReason: 'CONTAINS_EMAIL' };
    if (OPENING_HOURS_RE.test(value) || (TIMEISH_RE.test(value) && DAY_TOKEN_RE.test(value)) ||
        (TIME_RE.test(value) && !STREET_TOKEN_RE.test(value))) {
        return { ok: false, rejectionReason: 'OPENING_HOURS' };
    }
    if (BANK_CTX_RE.test(value))
        return { ok: false, rejectionReason: 'BANK_ACCOUNT' };
    if (/\d[\d\s()\-]{6,}\d/.test(value)) {
        return { ok: false, rejectionReason: 'CONTAINS_PHONE' };
    }
    if (CATALOG_OR_SERVICE_TEXT_RE.test(value))
        return { ok: false, rejectionReason: 'CATALOG_OR_SERVICE_TEXT' };
    // Structured / labelled evidence wins outright.
    if (/jsonld|postaladdress|schema/i.test(source))
        return { ok: true, value };
    if (ADDRESS_LABEL_RE.test(context) || ADDRESS_LABEL_RE.test(value))
        return { ok: true, value };
    // Otherwise require a street-type token AND a house/number component.
    if (STREET_TOKEN_RE.test(value) && /\d/.test(value))
        return { ok: true, value };
    return { ok: false, rejectionReason: 'NO_ADDRESS_SIGNAL' };
}
// ---------------------------------------------------------------------------
// Employee count
// ---------------------------------------------------------------------------
export function validateEmployeeCount(raw, _context = '') {
    const value = raw.replace(/\s+/g, ' ').trim();
    if (!EMPLOYEE_WORD_RE.test(value))
        return { ok: false, rejectionReason: 'NO_EMPLOYEE_CONTEXT' };
    const numMatch = value.match(/\d[\d\s]*/);
    if (!numMatch)
        return { ok: false, rejectionReason: 'NO_NUMBER' };
    const num = Number(numMatch[0].replace(/\s/g, ''));
    if (!Number.isFinite(num))
        return { ok: false, rejectionReason: 'NO_NUMBER' };
    // Animation/counter defaults ("0 сотрудников") are not a business fact.
    if (num === 0)
        return { ok: false, rejectionReason: 'COUNTER_ZERO' };
    if (num > 10_000_000)
        return { ok: false, rejectionReason: 'IMPLAUSIBLE' };
    return { ok: true, value };
}
// ---------------------------------------------------------------------------
// Founding date
// ---------------------------------------------------------------------------
export function validateFoundingDate(raw, _context = '') {
    const value = raw.trim();
    if (YEAR_RANGE_RE.test(value))
        return { ok: false, rejectionReason: 'YEAR_RANGE' };
    const m = value.match(/(?<!\d)(18\d{2}|19\d{2}|20\d{2})(?!\d)/);
    if (!m)
        return { ok: false, rejectionReason: 'NO_YEAR' };
    const year = Number(m[0]);
    if (year < 1800 || year > new Date().getFullYear() + 1)
        return { ok: false, rejectionReason: 'IMPLAUSIBLE_YEAR' };
    return { ok: true, value: String(year) };
}
// ---------------------------------------------------------------------------
// Registration / tax ID — its own fact type, never a phone
// ---------------------------------------------------------------------------
export function validateRegistrationId(raw, context = '') {
    const digits = raw.replace(/\D/g, '');
    if (digits.length !== 9)
        return { ok: false, rejectionReason: 'NOT_NINE_DIGITS' };
    if (!REGISTRATION_CTX_RE.test(context))
        return { ok: false, rejectionReason: 'REGISTRATION_WITHOUT_LABEL' };
    return { ok: true, value: digits };
}
// ---------------------------------------------------------------------------
// Gate — validate a candidate, record the rejection when it fails
// ---------------------------------------------------------------------------
export function validateFactCandidate(c) {
    switch (c.attemptedType) {
        case 'PHONE': return validatePhoneCandidate(c.rawValue, c.context);
        case 'EMAIL': return validateEmailCandidate(c.rawValue, c.context);
        case 'ADDRESS': return validateAddressCandidate(c.rawValue, c.context, c.source);
        case 'EMPLOYEE_COUNT': return validateEmployeeCount(c.rawValue, c.context);
        case 'FOUNDING_DATE': return validateFoundingDate(c.rawValue, c.context);
        case 'REGISTRATION_ID': return validateRegistrationId(c.rawValue, c.context);
    }
}
export class FactGate {
    rejected = [];
    /** Returns the accepted value, or records the rejection and returns undefined. */
    accept(c) {
        const r = validateFactCandidate(c);
        if (r.ok)
            return r.value;
        this.rejected.push({ ...c, rejectionReason: r.rejectionReason });
        return undefined;
    }
    drain() {
        const out = [...this.rejected];
        this.rejected.length = 0;
        return out;
    }
}
