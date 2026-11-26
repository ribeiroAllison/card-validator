import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

/**
 * Senha única via HTTP Basic Auth (o navegador mostra o pop-up de login).
 * Ativada quando APP_PASSWORD está definida; o usuário pode ser qualquer um.
 * Protege a cota da IA quando o app está publicado com um link público.
 */
export function basicAuth(password: string): RequestHandler {
  const expected = Buffer.from(password);
  return (req, res, next) => {
    if (req.path === "/api/health") return next(); // health check do Render
    const header = req.headers.authorization ?? "";
    const [scheme, encoded] = header.split(" ");
    if (scheme === "Basic" && encoded) {
      const decoded = Buffer.from(encoded, "base64").toString();
      const given = Buffer.from(decoded.slice(decoded.indexOf(":") + 1));
      if (given.length === expected.length && timingSafeEqual(given, expected)) return next();
    }
    res.set("WWW-Authenticate", 'Basic realm="Card Validator", charset="UTF-8"').status(401).send("Acesso restrito.");
  };
}
