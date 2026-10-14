# Heatzy

Controle sus módulos de hilo piloto [Heatzy](https://heatzy.com) desde Gladys:
el modo de cada radiador eléctrico (Confort, Eco, Antihielo, Apagado, y Confort
-1°C / -2°C en los módulos que los tienen), el modo vacaciones, el bloqueo
infantil y la programación semanal, además de la temperatura ambiente en los
modelos que la miden. Un widget del panel cambia todos los radiadores a la vez,
y las escenas reaccionan cuando un radiador cambia de modo o un módulo se
desconecta.

> **Desarrollada sin el hardware: sus comentarios son bienvenidos.** Esta
> integración se ha construido y probado con una nube Heatzy simulada,
> alimentada con los módulos reales de las pruebas de hass-heatzy (Home
> Assistant), no con una cuenta Heatzy real. Si algo no funciona como se
> describe, dígalo en el [foro de Gladys](https://community.gladysassistant.com)
> o en las [issues](https://github.com/guim31/gladys-heatzy/issues).

## Lo que necesita

- Gladys Assistant 5.1.0 o posterior.
- Una **cuenta Heatzy** (la dirección de correo y la contraseña de la
  aplicación Heatzy), con sus módulos ya instalados en la aplicación.
- Una conexión a Internet: los módulos solo son accesibles a través de la nube
  de Heatzy (Gizwits), no existe una API local.

Módulos compatibles: Pilote v1, Pilote v2 y v3 (Elec Pro incluido), Pilote v4,
Pilote Pro, Glow, Onyx, Inea y Bloom. Otro módulo Heatzy se muestra con el
protocolo común de los módulos recientes.

## Puesta en marcha

1. Instale la integración desde el catálogo de Gladys.
2. En **Configuración**, introduzca la **Dirección de correo** y la
   **Contraseña** de su cuenta Heatzy y guarde.
3. Haga clic en **Probar la conexión**: el mensaje bajo el botón enumera los
   módulos de la cuenta.
4. Abra la pestaña **Descubrimiento**: un dispositivo por módulo, con el nombre
   de la aplicación Heatzy. Haga clic en **Añadir**, elija una habitación y
   guarde.

Opciones:

- **Intervalo de actualización**: la frecuencia de lectura de los módulos, de 1
  a 10 minutos (2 minutos por defecto). Un cambio hecho desde Gladys se muestra
  al instante y se comprueba unos segundos después; un cambio hecho en la
  aplicación Heatzy aparece en la lectura siguiente.
- **Idioma de los nombres**: inglés, francés, alemán o español (francés por
  defecto), para los nombres de las funciones (asignados al añadir un
  dispositivo) y los mensajes de la integración.

## El dispositivo de cada módulo

| Función              | Qué es                                                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Modo hilo piloto     | El modo del radiador, con el selector de hilo piloto de Gladys: Confort, Confort -1°C, Confort -2°C, Eco, Antihielo, Apagado           |
| Bloqueo infantil     | Bloquea los botones del módulo (no en el Pilote v1 ni en el Bloom)                                                                     |
| Programación semanal | Activada: el módulo sigue la programación definida en la aplicación Heatzy; desactivada: mantiene el modo elegido (no en el Pilote v1) |
| Temperatura ambiente | Solo Glow, Onyx, Inea, Bloom y Pilote Pro, solo lectura                                                                                |
| Humedad              | Solo Pilote Pro, solo lectura                                                                                                          |

Confort -1°C y -2°C existen en los Pilote v4, Pilote Pro, Glow, Onyx, Inea y
Bloom: los demás módulos los rechazan con un mensaje. La insignia del
dispositivo indica **Nube** mientras el módulo está conectado a la nube de
Heatzy e **Inaccesible** cuando está desconectado.

Las consignas de confort y eco de los Glow, Onyx, Inea, Bloom y Pilote Pro no
se muestran: Gladys, HomeKit y los asistentes de voz tomarían una consigna por
un termostato, y un hilo piloto no lo es. Ajústelas en la aplicación Heatzy.

## Panel

Añada el widget **Radiadores Heatzy** a un panel. Por defecto enumera todos los
radiadores con su modo (y, tras un punto, vacaciones, boost, programa y la
temperatura ambiente); elija un radiador en su configuración para mostrar solo
ese. Sus cuatro botones actúan sobre lo que muestra el widget:

- **Confort**, **Eco**, **Antihielo**: inmediatamente;
- **Apagado**: tras una confirmación, ya que deja las habitaciones sin
  calefacción.

El botón del modo actual lleva una marca cuando todos los radiadores mostrados
están en él. Confort -1°C y -2°C están en el selector del dispositivo.

## Escenas

### Desencadenantes

- **Modo de un radiador cambiado fuera de Gladys**: la aplicación Heatzy, la
  programación o un botón del módulo ha cambiado el modo de un radiador.
  Filtros: el radiador, el nuevo modo. Variables: nombre y dispositivo del
  radiador, nuevo modo, modo anterior (`comfort`, `comfort_1`, `comfort_2`,
  `eco`, `frost_protection`, `off`), programación activa. Los cambios hechos
  por Gladys no se anuncian (una escena que reaccionara a ellos podría entrar en
  bucle); el desencadenante de dispositivo de Gladys sobre la función _Modo hilo
  piloto_ ve todos los cambios.
- **Módulo Heatzy desconectado**: un módulo ha perdido la conexión con la nube
  (wifi, corte de luz). Filtro: el radiador.
- **Módulo Heatzy conectado de nuevo**: el módulo vuelve a estar conectado.
  Filtro: el radiador.

### Acciones

- **Poner radiadores Heatzy en un modo**: un radiador, o todos si el radiador se
  deja vacío. Unas vacaciones en curso se terminan. En todos los radiadores,
  Confort -1°C y -2°C omiten los módulos que no los tienen. Salida: el número de
  módulos que han aceptado.
- **Iniciar el modo vacaciones de Heatzy**: antihielo durante 1 a 255 días;
  después el módulo vuelve a su programación. No en el Pilote v1.
- **Terminar el modo vacaciones de Heatzy**: termina las vacaciones (o un boost
  iniciado en la aplicación Heatzy).

Para un solo radiador, la acción de Gladys _Controlar un dispositivo_ sobre su
función _Modo hilo piloto_ también funciona.

### Ideas de escenas

- **Salir de casa** (alarma activada): _Poner radiadores Heatzy en un modo_,
  todos los radiadores, **Eco**; al volver: **Confort**.
- **Ventana abierta** (sensor de apertura de la habitación): poner ese radiador
  en **Antihielo**; cerrada de nuevo: **Confort**.
- **Un módulo desconectado por la noche**: _Módulo Heatzy desconectado_ →
  enviar un mensaje: «El radiador {{triggerEvent.data.radiator}} está
  desconectado».

## Solución de problemas

- **«Heatzy rechaza la dirección de correo o la contraseña»**: compruébelas
  iniciando sesión en la aplicación Heatzy. Tras este error, la integración deja
  de intentarlo (para no bloquear la cuenta) hasta que guarde la configuración o
  haga clic en **Probar la conexión**.
- **«Demasiadas solicitudes»**: la nube de Heatzy limita las solicitudes; la
  integración espera diez minutos. Elija un intervalo más largo si vuelve a
  ocurrir.
- **Un radiador no cambia de modo**: compruebe que el módulo está conectado en
  la aplicación Heatzy. Con la programación activada, la programación retoma el
  control en su siguiente franja: desactive la _Programación semanal_ para
  mantener un modo.
- **Un modo se muestra con unos minutos de retraso**: los cambios hechos fuera
  de Gladys se ven en la lectura siguiente (el intervalo de actualización).
- **Más detalles**: los registros de la integración (Ajustes → Integraciones →
  Heatzy). Nunca contienen la contraseña ni el token.

## Límites

- Solo nube: sin Internet, o cuando la nube de Heatzy falla, no se puede
  controlar nada desde Gladys (los módulos mantienen su modo y su programación).
- Lectura como máximo cada minuto: la nube de Heatzy (Gizwits) la comparten
  todos los usuarios de Heatzy y tiene cuotas. Cada lectura cuesta una solicitud
  más una por módulo.
- La programación en sí, las consignas, el boost y la detección de presencia del
  Pilote Pro se ajustan en la aplicación Heatzy.
- El Pilote Pro muestra el modo que aplica (que puede diferir del solicitado,
  por ejemplo cuando detecta una ventana abierta).
- Desarrollada sin el hardware: sus comentarios son bienvenidos.
- Sin relación con Heatzy.
