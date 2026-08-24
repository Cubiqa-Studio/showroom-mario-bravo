import { NextResponse, type NextRequest } from "next/server";

// Protege SÓLO el editor y su API (/admin, /api/admin). El showroom público
// NO está en el matcher → nunca pide clave.
//   - EDITOR DE POLÍGONOS DESHABILITADO por defecto: en producción NO se accede
//     por ninguna URL (se responde 404). El código del editor queda en el repo
//     como herramienta interna reutilizable en futuros showrooms; para reactivarlo
//     se setea ENABLE_POLYGON_EDITOR=true.
//   - Con el editor habilitado + ADMIN_PASSWORD → pide Basic Auth SIEMPRE.
//   - Con el editor habilitado sin ADMIN_PASSWORD → libre en dev, bloqueado en prod.
export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

function unauthorized() {
  return new NextResponse("Acceso restringido — Cubiqa admin.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Cubiqa admin", charset="UTF-8"' },
  });
}

export function middleware(req: NextRequest) {
  // Defensa: gateá SOLO el editor y su API, aunque el host no respete el `matcher`
  // (el runtime de Netlify a veces corre el middleware en todas las rutas) → así
  // el showroom público NUNCA pide clave.
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/admin") && !pathname.startsWith("/api/admin")) {
    return NextResponse.next();
  }

  // Editor de polígonos apagado → todo /admin y /api/admin no existe (404). Ni
  // siquiera se muestra el prompt de Basic Auth. Reactivar con ENABLE_POLYGON_EDITOR=true.
  if (process.env.ENABLE_POLYGON_EDITOR !== "true") {
    return new NextResponse("Not found", { status: 404 });
  }

  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    return process.env.NODE_ENV === "production" ? unauthorized() : NextResponse.next();
  }

  const header = req.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    let pass = "";
    try {
      pass = atob(encoded).split(":").slice(1).join(":");
    } catch {
      pass = "";
    }
    if (pass === expected) return NextResponse.next();
  }
  return unauthorized();
}
