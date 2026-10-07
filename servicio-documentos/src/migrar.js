import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directorio = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations');

// Migrador mínimo: aplica en orden db/migrations/V<n>__*.sql una sola vez cada uno.
// El lock de MySQL evita que dos réplicas migren a la vez.
export async function migrar(pool, registro = console) {
  const cx = await pool.getConnection();
  try {
    await cx.query("select get_lock('migraciones_documentos', 30)");
    await cx.query(`create table if not exists schema_migraciones (
      version int not null primary key, nombre varchar(200) not null, aplicada_en datetime(6) not null default current_timestamp(6)
    ) engine = InnoDB default charset = utf8mb4`);
    const [aplicadas] = await cx.query('select version from schema_migraciones');
    const hechas = new Set(aplicadas.map((f) => f.version));
    const archivos = (await readdir(directorio)).filter((f) => /^V\d+__.+\.sql$/.test(f))
      .sort((a, b) => Number(a.match(/^V(\d+)/)[1]) - Number(b.match(/^V(\d+)/)[1]));
    for (const archivo of archivos) {
      const version = Number(archivo.match(/^V(\d+)/)[1]);
      if (hechas.has(version)) continue;
      const sql = await readFile(path.join(directorio, archivo), 'utf8');
      // Cada archivo se ejecuta sentencia por sentencia; el DDL de MySQL confirma solo.
      for (const sentencia of sql.split(/;\s*\n/).map((s) => s.replace(/^\s*--.*$/gm, '').trim()).filter(Boolean)) {
        await cx.query(sentencia);
      }
      await cx.query('insert into schema_migraciones (version, nombre) values (?, ?)', [version, archivo]);
      registro.info(`Migración aplicada: ${archivo}`);
    }
  } finally {
    await cx.query("select release_lock('migraciones_documentos')").catch(() => {});
    cx.release();
  }
}
