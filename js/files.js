// Saving files from the browser: download to the phone, or share (Drive, email…).

export const canShareFiles = () => {
  try { return !!navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.json', { type: 'application/json' })] }); }
  catch { return false; }
};

/** mode 'download' | 'share' → resolves 'downloaded' | 'shared' | 'cancel' */
export async function saveFile(name, mime, content, mode = 'download') {
  const file = new File([content], name, { type: mime });
  if (mode === 'share' && canShareFiles()) {
    try { await navigator.share({ files: [file], title: name }); return 'shared'; }
    catch (e) { if (e.name === 'AbortError') return 'cancel'; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  return 'downloaded';
}

export function readFile(file) { return file.text(); }
