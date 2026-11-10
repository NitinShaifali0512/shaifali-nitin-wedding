import autoprefixer from 'autoprefixer';
import tailwindcss from 'tailwindcss';

/**
 * Expands the `inset` shorthand into top/right/bottom/left so that the layout
 * also holds on older iPhones (Safari before 14.1 ignores `inset`).
 */
function insetFallback() {
  return {
    postcssPlugin: 'inset-fallback',
    Declaration(decl) {
      if (decl.prop !== 'inset') return;
      const parts = decl.value.trim().split(/\s+(?![^(]*\))/);
      if (parts.length < 1 || parts.length > 4) return;
      const top = parts[0];
      const right = parts[1] ?? top;
      const bottom = parts[2] ?? top;
      const left = parts[3] ?? right;
      decl.cloneBefore({ prop: 'top', value: top });
      decl.cloneBefore({ prop: 'right', value: right });
      decl.cloneBefore({ prop: 'bottom', value: bottom });
      decl.cloneBefore({ prop: 'left', value: left });
      decl.remove();
    },
  };
}
insetFallback.postcss = true;

export default {
  plugins: [tailwindcss(), autoprefixer(), insetFallback()],
};
