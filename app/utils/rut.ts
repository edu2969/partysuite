/**
 * Validación de RUT chileno.
 *
 * Recibe el RUT completo SIN guión (ej: "123456785"), tal como lo dejaba
 * el código original después de `rut.replace("-", "")` + remover puntos.
 * El último carácter es el dígito verificador (0-9 o k/K).
 *
 * Equivalente a la función global `CheckRut` usada en el método Meteor original.
 */
export function checkRut(rutSinGuion: string): boolean {
  const clean = rutSinGuion.replace(/\./g, "").trim();

  if (!/^[0-9]+[0-9kK]$/.test(clean)) return false;

  const cuerpo = clean.slice(0, -1);
  const dvIngresado = clean.slice(-1).toLowerCase();

  return calcularDv(cuerpo) === dvIngresado;
}

export function calcularDv(cuerpo: string): string {
  let suma = 0;
  let multiplo = 2;

  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i], 10) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }

  const resto = 11 - (suma % 11);
  if (resto === 11) return "0";
  if (resto === 10) return "k";
  return String(resto);
}

export function formatRut(rutSinFormato: string): string {
  const clean = rutSinFormato.replace(/\./g, "").replace(/\s+/g, "").trim();

  if (!clean) return "";

  const cuerpo = clean.replace(/[^0-9kK]/g, "");

  if (!cuerpo) return rutSinFormato;

  const dv = cuerpo.slice(-1).toUpperCase();
  const numero = cuerpo.slice(0, -1);

  if (!/^[0-9]+$/.test(numero) || !/^[0-9K]$/.test(dv)) {
    return rutSinFormato;
  }

  const numeroFormateado = numero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${numeroFormateado}-${dv}`;
}
