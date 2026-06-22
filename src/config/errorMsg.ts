export const errorMsg = (error: unknown, errText: string) => {
  const msg =
    (error as { shortMessage?: string; message?: string })?.shortMessage ||
    (error as Error)?.message ||
    errText;
  console.error(errText + ':', error);
  return msg;
};
