import React from "react";

function formatWithCommas(raw: string) {
  if (!raw) return "";
  const [i, d] = raw.split(".");
  const int = i ? Number(i).toLocaleString("en-US") : "";
  return d != null ? `${int}.${d}` : int;
}

function normalizeRawNumeric(s: string) {
  // keep digits & one dot
  const cleaned = s.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 1) return cleaned;
  const head = parts.shift()!;
  return head + "." + parts.join("").replace(/\./g, "");
}

function countDigits(str: string) {
  return (str.match(/\d/g) || []).length;
}

function indexByDigits(str: string, targetDigits: number) {
  // find first index in `str` that has `targetDigits` digits to its left
  let seen = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (/\d/.test(ch)) seen++;
    if (seen >= targetDigits) return i + 1; // caret sits *after* this char
  }
  return str.length;
}

type AmountInputProps = {
  valueRaw: string;                 // parent keeps the raw number string (no commas, no symbol)
  onChangeRaw: (v: string) => void;
  symbol?: string;                  // default "VATO"
  className?: string;
  placeholder?: string;
  disabled?: boolean;
};

export function AmountInput({
  valueRaw,
  onChangeRaw,
  symbol = "VATO",
  className,
  placeholder,
  disabled,
}: AmountInputProps) {
  const ref = React.useRef<HTMLInputElement>(null);

  // Build the formatted display with suffix inside the input
  const display = (valueRaw ? formatWithCommas(valueRaw) : "") + (symbol ? ` ${symbol}` : "");

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const oldDisplay = input.value;                // what user sees before we set state
    const caret = input.selectionStart ?? oldDisplay.length;

    // how many digits are to the left of the caret now?
    const digitsLeft = countDigits(oldDisplay.slice(0, caret));

    // derive a raw numeric string from what user typed (strip commas and suffix)
    const withoutSuffix = oldDisplay.replace(new RegExp(`\\s*${symbol}$`), "");
    const asRaw = normalizeRawNumeric(withoutSuffix.replace(/,/g, ""));

    // reject invalid (multiple dots etc.) by staying put
    if (asRaw !== "" && !/^\d*\.?\d*$/.test(asRaw)) {
      // no-op
      requestAnimationFrame(() => {
        if (!ref.current) return;
        // snap caret before the suffix in case user jumped into it
        const maxCaret = (ref.current.value ?? "").length - (symbol ? symbol.length + 1 : 0);
        ref.current.setSelectionRange(Math.min(caret, maxCaret), Math.min(caret, maxCaret));
      });
      return;
    }

    onChangeRaw(asRaw);

    // After React updates value, re-position caret based on "digitsLeft"
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const newDisplay = el.value; // formatted + suffix
      const maxBeforeSuffix = newDisplay.length - (symbol ? symbol.length + 1 : 0);
      const ideal = indexByDigits(newDisplay.slice(0, maxBeforeSuffix), digitsLeft);
      const nextCaret = Math.min(ideal, maxBeforeSuffix);
      el.setSelectionRange(nextCaret, nextCaret);
    });
  }

  // Prevent caret from entering the suffix when arrowing/tapping
  function handleClick() {
    const el = ref.current;
    if (!el) return;
    const maxBeforeSuffix = el.value.length - (symbol ? symbol.length + 1 : 0);
    const caret = el.selectionStart ?? 0;
    if (caret > maxBeforeSuffix) el.setSelectionRange(maxBeforeSuffix, maxBeforeSuffix);
  }

  return (
    <input
      ref={ref}
      type="text"
      inputMode="decimal"
      className={className}
      placeholder={placeholder ?? `0.0 ${symbol}`}
      value={display}
      onChange={handleChange}
      onClick={handleClick}
      onKeyUp={handleClick}
      onMouseUp={handleClick}
      disabled={disabled}
      // Optional: prevent selecting into the suffix by keyboard (End key etc.)
      onBlur={() => {
        const el = ref.current;
        if (!el) return;
        const maxBeforeSuffix = el.value.length - (symbol ? symbol.length + 1 : 0);
        el.setSelectionRange(maxBeforeSuffix, maxBeforeSuffix);
      }}
    />
  );
}
