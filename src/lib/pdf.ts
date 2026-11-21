import { getLogoDataUrl } from "@/lib/empresa"
import { calcularTotales, formatMoney } from "@/lib/money"
import {
  fechaVisible,
  fechaVencimiento,
  tipoVisible,
} from "@/lib/cotizacion-vista"
import type { CotizacionConDetalle, Empresa } from "@/lib/types"

export function nombrePdf(cot: CotizacionConDetalle) {
  const cliente =
    cot.cliente.razon_social
      // eslint-disable-next-line no-control-regex -- Los nombres de archivo de Windows excluyen los caracteres de control ASCII 0 a 31.
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
      .replace(/[. ]+$/, "")
      .trim() || "cliente"
  return `${cot.numero} - ${cliente}.pdf`
}
export async function generarPdf(
  cot: CotizacionConDetalle,
  empresa: Empresa
): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ])
  const doc = new jsPDF({ format: "a4", orientation: "portrait", unit: "mm" })
  const azul: [number, number, number] = [35, 79, 105]
  const gris: [number, number, number] = [82, 91, 99]
  const money = (n: number) =>
    formatMoney(Number(n), cot.moneda).replace(/\u00a0/g, " ")
  let y = 15
  if (empresa.logo_path) {
    const logo = await getLogoDataUrl(empresa.logo_path)
    const props = doc.getImageProperties(logo)
    const escala = Math.min(40 / props.width, 20 / props.height)
    doc.addImage(
      logo,
      props.fileType,
      15,
      y,
      props.width * escala,
      props.height * escala
    )
    y += props.height * escala + 4
  }
  autoTable(doc, {
    startY: y,
    margin: { left: 15, right: 15, bottom: 22 },
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 0,
      textColor: gris,
      overflow: "linebreak",
    },
    columnStyles: {
      0: { cellWidth: 105 },
      1: { cellWidth: 75, halign: "right" },
    },
    body: [
      [
        `${empresa.razon_social}\nRUC ${empresa.ruc}${empresa.direccion ? `\n${empresa.direccion}` : ""}${empresa.telefono ? `\n${empresa.telefono}` : ""}${empresa.email ? `\n${empresa.email}` : ""}${empresa.web ? `\n${empresa.web}` : ""}`,
        `COTIZACIÓN\n${cot.numero}\nFecha: ${fechaVisible(cot.fecha)}\nVálida hasta ${fechaVencimiento(cot.fecha, cot.validez_dias)}`,
      ],
    ],
    didParseCell: (data) => {
      if (data.column.index === 1) {
        data.cell.styles.fillColor = [239, 244, 246]
        data.cell.styles.textColor = azul
        data.cell.styles.cellPadding = 4
        data.cell.styles.fontStyle = "bold"
      }
    },
  })
  y =
    (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 9
  const cliente = cot.cliente
  autoTable(doc, {
    startY: y,
    margin: { left: 15, right: 15, bottom: 22 },
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 2,
      textColor: gris,
      overflow: "linebreak",
    },
    columnStyles: {
      0: { cellWidth: 29, fontStyle: "bold", textColor: azul },
      1: { cellWidth: 151 },
    },
    body: [
      ["Señor(es)", cliente.razon_social],
      [cliente.tipo_doc, cliente.num_doc],
      ...(cliente.direccion ? [["Dirección", cliente.direccion]] : []),
      ...(cliente.contacto ? [["Contacto", cliente.contacto]] : []),
      ...(cliente.email ? [["Correo", cliente.email]] : []),
      ...(cliente.telefono ? [["Teléfono", cliente.telefono]] : []),
    ],
  })
  y =
    (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 7
  const descuento = cot.items.some((i) => Number(i.descuento_pct) > 0)
  const encabezado = [
    "#",
    "Descripción",
    "Und.",
    "Cant.",
    "P. Unit.",
    ...(descuento ? ["Desc."] : []),
    "Total",
  ]
  autoTable(doc, {
    startY: y,
    margin: { left: 15, right: 15, bottom: 22 },
    head: [encabezado],
    body: cot.items.map((item, i) => [
      String(i + 1),
      item.descripcion.toUpperCase(),
      tipoVisible(item.unidad),
      String(item.cantidad),
      money(item.precio_unitario),
      ...(descuento ? [String(item.descuento_pct)] : []),
      money(item.total_linea),
    ]),
    theme: "striped",
    showHead: "everyPage",
    rowPageBreak: "avoid",
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 2,
      overflow: "linebreak",
      valign: "top",
    },
    headStyles: { fillColor: azul, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [246, 248, 249] },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 18 },
      3: { cellWidth: 15, halign: "right" },
      4: { cellWidth: 27, halign: "right" },
      ...(descuento
        ? {
            5: { cellWidth: 12, halign: "right" as const },
            6: { cellWidth: 28, halign: "right" as const },
          }
        : { 5: { cellWidth: 28, halign: "right" as const } }),
    },
    didParseCell: (data) => {
      if (data.section === "head")
        data.cell.styles.halign =
          data.column.index === 0
            ? "center"
            : data.column.index >= 3
              ? "right"
              : "left"
    },
  })
  y =
    (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 5
  const totales = calcularTotales(cot.items, cot)
  const filas = [
    ["Suma de ítems", money(totales.suma_items)],
    ...(Number(cot.descuento_global) > 0
      ? [["Descuento global", `- ${money(cot.descuento_global)}`]]
      : []),
    [
      cot.aplica_igv ? "Op. gravada / Subtotal" : "Subtotal",
      money(cot.subtotal),
    ],
    ...(cot.aplica_igv ? [[`IGV ${cot.igv_pct}%`, money(cot.igv)]] : []),
    ["TOTAL", money(cot.total)],
  ]
  autoTable(doc, {
    startY: y,
    margin: { left: 115, right: 15, bottom: 22 },
    pageBreak: "avoid",
    rowPageBreak: "avoid",
    theme: "plain",
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2 },
    columnStyles: { 1: { halign: "right" } },
    body: filas,
    didParseCell: (data) => {
      if (data.row.index === filas.length - 1) {
        data.cell.styles.fontStyle = "bold"
        data.cell.styles.textColor = azul
        data.cell.styles.fillColor = [239, 244, 246]
      }
    },
  })
  y =
    (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 3
  const condiciones = [
    ...(cot.aplica_igv
      ? [
          [
            "Precios",
            cot.precios_incluyen_igv
              ? "Precios incluyen IGV"
              : "Precios no incluyen IGV",
          ],
        ]
      : []),
    ...(cot.forma_pago ? [["Forma de pago", cot.forma_pago]] : []),
    ...(cot.plazo_entrega ? [["Plazo de entrega", cot.plazo_entrega]] : []),
    ...(cot.notas ? [["Notas / condiciones", cot.notas]] : []),
  ]
  if (condiciones.length) {
    autoTable(doc, {
      startY: y + 4,
      margin: { left: 15, right: 15, bottom: 22 },
      head: [["CONDICIONES", ""]],
      body: condiciones,
      pageBreak: "avoid",
      rowPageBreak: "avoid",
      theme: "plain",
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 2,
        overflow: "linebreak",
      },
      headStyles: { textColor: azul, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 38, fontStyle: "bold" },
        1: { cellWidth: 142 },
      },
    })
    y =
      (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 5
  }
  const cuentas = [...(empresa.cuentas_bancarias || [])].sort(
    (a, b) => Number(b.moneda === cot.moneda) - Number(a.moneda === cot.moneda)
  )
  if (cuentas.length)
    autoTable(doc, {
      startY: y + 3,
      margin: { left: 15, right: 15, bottom: 22 },
      pageBreak: "avoid",
      rowPageBreak: "avoid",
      head: [
        [
          {
            content: "CUENTAS BANCARIAS",
            colSpan: 4,
            styles: {
              fillColor: false,
              textColor: azul,
              fontSize: 9,
              fontStyle: "bold",
            },
          },
        ],
        ["Banco", "Moneda", "Número", "CCI"],
      ],
      body: cuentas.map((c) => [c.banco, c.moneda, c.numero, c.cci]),
      theme: "striped",
      styles: {
        font: "helvetica",
        fontSize: 8,
        cellPadding: 2,
        overflow: "linebreak",
      },
      headStyles: { fillColor: azul },
      didDrawPage: () => {},
    })
  const paginas = doc.getNumberOfPages()
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p)
    doc.setDrawColor(210)
    doc.line(15, 281, 195, 281)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(100)
    const contacto = [empresa.telefono, empresa.email, empresa.web]
      .filter(Boolean)
      .join(" · ")
    doc.text(doc.splitTextToSize(contacto, 135).slice(0, 2), 15, 286)
    doc.text(`Página ${p} de ${paginas}`, 195, 286, { align: "right" })
  }
  return doc.output("blob")
}
