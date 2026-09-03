// ─────────────────────────────────────────────────────────────────────────────
// Escritor de ZIP mínimo, sin dependencias.
//
// POR QUÉ EXISTE. La spec del ZIP (APPNOTE 4.4.17.1) es explícita: los nombres de
// entrada usan SIEMPRE "/" como separador, en cualquier sistema operativo. El
// `Compress-Archive` de PowerShell 5.1 (que es lo que trae Windows por defecto)
// escribe "\" — y entonces un extractor de Linux, que es donde vive Hostinger, no
// ve carpetas: crea 432 archivos planos llamados literalmente
// "_next\static\chunks\4bd1b696-….js". El index.html carga, todo pedido a
// /_next/static/… da 404, y el sitio se ve sin estilos ni JavaScript.
//
// Pasó de verdad en el primer deploy. Por eso el empaquetado no delega más en la
// herramienta del sistema: acá se escriben los bytes del ZIP a mano, y así el
// resultado es el mismo en Windows, macOS y Linux.
//
// Alcance deliberado: sin ZIP64 (haría falta arriba de 4 GB o 65535 entradas; el
// deploy son ~450 archivos y 57 MB), sin cifrado, sin data descriptors (sabemos el
// tamaño antes de escribir el header porque comprimimos en memoria).
// ─────────────────────────────────────────────────────────────────────────────

import { readFile, stat, readdir, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { deflateRawSync, crc32 } from "node:zlib";

const FIRMA_LOCAL = 0x04034b50;
const FIRMA_CENTRAL = 0x02014b50;
const FIRMA_FIN = 0x06054b50;

/** Versión 2.0 (la que hace falta para deflate). */
const VERSION_NECESARIA = 20;
/** "Hecho en Unix" (3) en el byte alto → habilita los permisos del byte externo. */
const VERSION_CREADOR = (3 << 8) | VERSION_NECESARIA;
/** Bit 11: los nombres van en UTF-8. */
const FLAG_UTF8 = 0x800;

const METODO_STORE = 0;
const METODO_DEFLATE = 8;

/** Formatos que YA vienen comprimidos: volver a comprimirlos gasta CPU para ganar
 *  ~0%, así que se guardan tal cual (método "store"). */
const YA_COMPRIMIDO = new Set([
  ".webp", ".jpg", ".jpeg", ".png", ".gif", ".ico",
  ".mp4", ".webm", ".mp3", ".woff", ".woff2", ".zip", ".gz",
]);

/** Fecha/hora en formato MS-DOS, que es lo que guarda el ZIP. */
function fechaDos(fecha) {
  const anio = Math.max(1980, fecha.getFullYear());
  return {
    hora: (fecha.getHours() << 11) | (fecha.getMinutes() << 5) | (fecha.getSeconds() >> 1),
    dia: ((anio - 1980) << 9) | ((fecha.getMonth() + 1) << 5) | fecha.getDate(),
  };
}

/** Recorre un directorio y devuelve sus archivos y carpetas, con rutas relativas
 *  YA normalizadas a "/" (que es el punto de todo esto). */
async function recorrer(raiz) {
  const carpetas = [];
  const archivos = [];

  async function bajar(dir) {
    for (const entrada of await readdir(dir, { withFileTypes: true })) {
      const completa = join(dir, entrada.name);
      const rel = relative(raiz, completa).split(sep).join("/");
      if (entrada.isDirectory()) {
        carpetas.push(rel + "/");
        await bajar(completa);
      } else if (entrada.isFile()) {
        archivos.push({ rel, completa });
      }
    }
  }

  await bajar(raiz);
  // Orden estable: mismo input → mismo zip byte a byte.
  carpetas.sort();
  archivos.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
  return { carpetas, archivos };
}

/**
 * Comprime `origen` (un directorio) en `destino` (.zip). El CONTENIDO del
 * directorio queda en la raíz del zip, no el directorio en sí.
 */
export async function zipDirectorio(origen, destino) {
  const { carpetas, archivos } = await recorrer(origen);
  const locales = [];
  const centrales = [];
  let offset = 0;

  const agregar = ({ nombre, datos, metodo, crc, tamOriginal, mtime, esCarpeta }) => {
    const nombreBuf = Buffer.from(nombre, "utf8");
    const { hora, dia } = fechaDos(mtime);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(FIRMA_LOCAL, 0);
    local.writeUInt16LE(VERSION_NECESARIA, 4);
    local.writeUInt16LE(FLAG_UTF8, 6);
    local.writeUInt16LE(metodo, 8);
    local.writeUInt16LE(hora, 10);
    local.writeUInt16LE(dia, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(datos.length, 18);
    local.writeUInt32LE(tamOriginal, 22);
    local.writeUInt16LE(nombreBuf.length, 26);
    local.writeUInt16LE(0, 28); // sin campo "extra"
    locales.push(local, nombreBuf, datos);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(FIRMA_CENTRAL, 0);
    central.writeUInt16LE(VERSION_CREADOR, 4);
    central.writeUInt16LE(VERSION_NECESARIA, 6);
    central.writeUInt16LE(FLAG_UTF8, 8);
    central.writeUInt16LE(metodo, 10);
    central.writeUInt16LE(hora, 12);
    central.writeUInt16LE(dia, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(datos.length, 20);
    central.writeUInt32LE(tamOriginal, 24);
    central.writeUInt16LE(nombreBuf.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comentario
    central.writeUInt16LE(0, 34); // disco
    central.writeUInt16LE(0, 36); // atributos internos
    // Permisos Unix en los 16 bits altos: 0755 en carpetas, 0644 en archivos. Sin
    // esto, según el extractor, los archivos pueden quedar con permisos raros en
    // el hosting (y Apache devolviendo 403).
    central.writeUInt32LE(((esCarpeta ? 0o040755 : 0o100644) >>> 0) * 0x10000, 38);
    central.writeUInt32LE(offset, 42);
    centrales.push(central, nombreBuf);

    offset += local.length + nombreBuf.length + datos.length;
  };

  // Las carpetas primero: algunos extractores viejos las necesitan declaradas.
  for (const nombre of carpetas) {
    agregar({
      nombre,
      datos: Buffer.alloc(0),
      metodo: METODO_STORE,
      crc: 0,
      tamOriginal: 0,
      mtime: (await stat(join(origen, nombre))).mtime,
      esCarpeta: true,
    });
  }

  for (const { rel, completa } of archivos) {
    const contenido = await readFile(completa);
    const punto = rel.lastIndexOf(".");
    const ext = punto === -1 ? "" : rel.slice(punto).toLowerCase();
    const guardarTalCual = YA_COMPRIMIDO.has(ext);
    const datos = guardarTalCual ? contenido : deflateRawSync(contenido, { level: 9 });
    agregar({
      nombre: rel,
      datos,
      metodo: guardarTalCual ? METODO_STORE : METODO_DEFLATE,
      crc: crc32(contenido),
      tamOriginal: contenido.length,
      mtime: (await stat(completa)).mtime,
      esCarpeta: false,
    });
  }

  const central = Buffer.concat(centrales);
  const total = carpetas.length + archivos.length;

  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(FIRMA_FIN, 0);
  fin.writeUInt16LE(0, 4); // número de disco
  fin.writeUInt16LE(0, 6); // disco donde arranca el directorio central
  fin.writeUInt16LE(total, 8);
  fin.writeUInt16LE(total, 10);
  fin.writeUInt32LE(central.length, 12);
  fin.writeUInt32LE(offset, 16);
  fin.writeUInt16LE(0, 20); // comentario

  await writeFile(destino, Buffer.concat([...locales, central, fin]));
  return { archivos: archivos.length, carpetas: carpetas.length };
}

/**
 * Lee el DIRECTORIO CENTRAL del zip ya escrito y devuelve los nombres de entrada
 * tal como quedaron en el archivo.
 *
 * No es paranoia: el bug de los "\" no se ve en Windows (el extractor de Windows
 * los tolera), sólo aparece al extraer en el server, cuando ya subiste 48 MB. Leer
 * los bytes de vuelta es la única forma de comprobar lo que se está por subir, en
 * vez de confiar en que el escritor hizo lo correcto.
 */
export async function leerNombresDelZip(ruta) {
  const buf = await readFile(ruta);

  // El EOCD está al final; puede tener hasta 64 KB de comentario, así que se busca
  // la firma desde atrás.
  let fin = -1;
  const desde = Math.max(0, buf.length - 22 - 0xffff);
  for (let i = buf.length - 22; i >= desde; i--) {
    if (buf.readUInt32LE(i) === FIRMA_FIN) {
      fin = i;
      break;
    }
  }
  if (fin === -1) throw new Error(`${ruta}: no encontré el fin del directorio central (¿zip corrupto?)`);

  const total = buf.readUInt16LE(fin + 10);
  let p = buf.readUInt32LE(fin + 16);
  const nombres = [];
  for (let i = 0; i < total; i++) {
    if (buf.readUInt32LE(p) !== FIRMA_CENTRAL) {
      throw new Error(`${ruta}: entrada ${i} corrupta en el directorio central`);
    }
    const largoNombre = buf.readUInt16LE(p + 28);
    const largoExtra = buf.readUInt16LE(p + 30);
    const largoComentario = buf.readUInt16LE(p + 32);
    nombres.push(buf.toString("utf8", p + 46, p + 46 + largoNombre));
    p += 46 + largoNombre + largoExtra + largoComentario;
  }
  return nombres;
}
