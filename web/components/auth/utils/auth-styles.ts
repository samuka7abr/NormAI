export function inputClass(dark: boolean, hasError = false) {
  const base =
    "w-full px-4 py-[15px] text-base rounded-lg outline-none transition-colors duration-500 ";
  if (dark)
    return (
      base +
      "text-[#f0f0f0] bg-[#141414] border placeholder-[#6b6b6b] " +
      (hasError
        ? "border-[#ff6b6b] focus:border-[#ff6b6b] focus-visible:ring-2 focus-visible:ring-[#ff6b6b]/20"
        : "border-[#2a2a2a] hover:border-[#3a3a3a] focus:border-[#2ec98d] focus-visible:ring-2 focus-visible:ring-[#2ec98d]/10")
    );
  return (
    base +
    "text-[#065F46] bg-white border placeholder-[#8ab5a8] " +
    (hasError
      ? "border-[#dc2626] focus:border-[#dc2626] focus-visible:ring-2 focus-visible:ring-[#dc2626]/10"
      : "border-[#b8d9d0] hover:border-[#8fb8ad] focus:border-[#15a37b] focus-visible:ring-2 focus-visible:ring-[#15a37b]/15")
  );
}

export function submitClass(dark: boolean, loading = false) {
  const base =
    "mt-3 w-full py-[20px] text-base font-semibold rounded-lg transition-colors duration-500 " +
    (loading ? "cursor-not-allowed opacity-70" : "cursor-pointer") +
    " ";
  if (dark)
    return (
      base +
      "bg-[#9dffa1] hover:bg-[#85e689] active:bg-[#6ecd73] text-[#0d2e1c] " +
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9dffa1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
    );
  return (
    base +
    "bg-[#15a37b] hover:bg-[#0e9268] active:bg-[#047857] text-white " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15a37b] focus-visible:ring-offset-2"
  );
}

export function linkClass(dark: boolean) {
  const color = dark
    ? "text-[#9dffa1] hover:text-[#85e689] after:bg-[#9dffa1]"
    : "text-[#047857] hover:text-[#15a37b] after:bg-[#047857]";
  return (
    "relative cursor-pointer transition-colors duration-500 rounded-sm " +
    color +
    " after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 " +
    "after:transition-[width] after:duration-300 after:ease-out hover:after:w-full " +
    "focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-1"
  );
}

export function errorClass(dark: boolean) {
  return "text-xs mt-1.5 " + (dark ? "text-[#ff9999]" : "text-[#c0392b]");
}
