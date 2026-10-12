import bcrypt from "bcryptjs";

function promptHidden(question) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
      reject(new Error("Ejecuta este script en una terminal interactiva."));
      return;
    }

    process.stdout.write(question);
    let value = "";
    const onData = (chunk) => {
      const input = chunk.toString("utf8");
      for (const character of input) {
        if (character === "\u0003") {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          reject(new Error("Cancelado."));
          return;
        }
        if (character === "\r" || character === "\n") {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener("data", onData);
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
        } else {
          value += character;
        }
      }
    };

    process.stdin.resume();
    process.stdin.setRawMode(true);
    process.stdin.on("data", onData);
  });
}

function quoteSql(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

const username = process.argv[2]?.trim();
if (!username || username.length > 120) {
  console.error("Uso: pnpm run admin:sql -- nombre-de-usuario");
  process.exit(1);
}

const password = await promptHidden("Contraseña nueva (no se mostrará): ");
if (password.length < 12 || password.length > 72) {
  console.error("Usa una contraseña de entre 12 y 72 caracteres.");
  process.exit(1);
}

const passwordHash = (await bcrypt.hash(password, 12)).replace(/^\$2b\$/u, "$2a$");
console.log("\nCopia y ejecuta este SQL en Supabase:\n");
console.log(
  `insert into public.admin_users (username, password_hash)\n` +
    `values (${quoteSql(username)}, ${quoteSql(passwordHash)})\n` +
    `on conflict (username) do update set password_hash = excluded.password_hash;`,
);
