export async function compartirPdf(
  blob: Blob,
  nombre: string,
  texto: string
): Promise<boolean> {
  const file = new File([blob], nombre, { type: "application/pdf" })
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: nombre, text: texto })
    return true
  }
  return false
}
export function descargarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement("a")
  enlace.href = url
  enlace.download = nombre
  enlace.click()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
export function whatsappUrl(texto: string, telefono?: string | null) {
  let numero = (telefono || "").replace(/\D/g, "")
  if (numero.length === 9) numero = `51${numero}`
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`
}
export function mailtoUrl(
  email: string | null | undefined,
  asunto: string,
  cuerpo: string
) {
  return `mailto:${encodeURIComponent(email || "")}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`
}
