import React from 'react';

/**
 * AppImage — sirve la variante WebP cuando existe, con fallback al original.
 *
 * POR QUE EXISTE
 * Las imagenes de productos eran PNG de 400 a 960 KB: la landing descargaba
 * 5.4 MB por visita, ocho veces mas que todo el JavaScript. Convertidas a
 * WebP pesan 1.1 MB en total (86% menos) con una diferencia visual medida
 * por debajo del 2% (imperceptible).
 *
 * POR QUE NO SE RENOMBRARON LOS ARCHIVOS
 * Las rutas /menu/*.png estan guardadas en la base de datos
 * (productos.imagen) y tambien hardcodeadas en el frontend. Renombrar
 * habria exigido una migracion de datos. En cambio cada asset tiene un
 * gemelo <archivo>.<ext>.webp y aqui se DERIVA del src: cero cambios en la BD.
 *
 * POR QUE display:contents
 * <picture> es un elemento inline. Sin esto podria introducir un hueco de
 * linea base bajo la imagen en contenedores sin overflow:hidden. Con
 * display:contents la caja del <picture> desaparece del layout y el <img>
 * se posiciona como si fuera hijo directo del contenedor.
 * Verificado en Chrome headless: la geometria es identica a un <img> suelto.
 *
 * El navegador elige solo: si soporta WebP pide el .webp, si no pide el
 * original. Funciona en cualquier host, sin depender de nginx.
 *
 * ADVERTENCIA IMPORTANTE — NO USAR CON RUTAS DINAMICAS
 * Si el <source> da 404, el navegador muestra imagen ROTA: por especificacion
 * NO reintenta con el <img>. Por eso este componente se usa SOLO con rutas
 * fijas del codigo, cuyo gemelo .webp esta garantizado y verificado por
 * scripts/verificar-webp.mjs.
 * Para imagenes que vienen de la base de datos (productos.imagen) se usa un
 * <img> normal: ahi la optimizacion la hace nginx con try_files, que SI cae
 * al original cuando no existe el .webp.
 */
const AppImage = ({ src, alt = '', className = '', loading = 'lazy', ...rest }) => {
    if (!src) return null;

    // Solo los assets locales raster tienen gemelo .webp. Una URL externa,
    // un data: URI o un SVG se sirven tal cual.
    const tieneWebp = /^\/[^?#]+\.(png|jpe?g)$/i.test(src);

    if (!tieneWebp) {
        return <img src={src} alt={alt} className={className} loading={loading} {...rest} />;
    }

    return (
        <picture style={{ display: 'contents' }}>
            <source srcSet={`${src}.webp`} type="image/webp" />
            <img src={src} alt={alt} className={className} loading={loading} {...rest} />
        </picture>
    );
};

export default AppImage;
