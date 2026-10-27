import { Client } from 'minio';

/**
 * Almacén de objetos (MinIO) para los anexos (HU-025…HU-029).
 *
 * El bucket se crea la primera vez que se usa, no al arrancar: si MinIO todavía no
 * está listo, el servicio sigue atendiendo radicación y el primer cargue lo crea.
 * Los errores se reintentan en la siguiente llamada (la promesa fallida no se guarda).
 */
export function crearAlmacen({ endPoint, port, useSSL, accessKey, secretKey, bucket, region }) {
  const cliente = new Client({ endPoint, port, useSSL, accessKey, secretKey });
  let preparacion = null;

  async function bucketListo() {
    if (!preparacion) {
      preparacion = (async () => {
        if (!(await cliente.bucketExists(bucket))) {
          await cliente.makeBucket(bucket, region);
        }
      })().catch((error) => {
        preparacion = null;
        throw error;
      });
    }
    return preparacion;
  }

  return {
    async guardar(clave, contenido, tipoMime) {
      await bucketListo();
      await cliente.putObject(bucket, clave, contenido, contenido.length, { 'Content-Type': tipoMime });
    },
    async abrir(clave) {
      await bucketListo();
      return cliente.getObject(bucket, clave);
    },
    async comprobar() {
      await bucketListo();
    },
    async eliminar(clave) {
      await bucketListo();
      await cliente.removeObject(bucket, clave);
    },
  };
}
