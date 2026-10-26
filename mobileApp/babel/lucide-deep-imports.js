/**
 * Rewrites `import { Mail, X } from 'lucide-react-native'` into one import per icon file
 * (`lucide-react-native/icons/mail`). Metro does not tree-shake, so the barrel import would
 * otherwise bundle all ~1,900 icons (~2MB of JS) and load them at startup.
 *
 * Icon names are resolved from the package's own barrel file, so aliases such as
 * CheckCircle2 → circle-check keep working.
 */
const fs = require('fs');
const path = require('path');

const PKG = 'lucide-react-native';
let iconFiles;

function loadIconFiles() {
  if (iconFiles) return iconFiles;
  // The package's "exports" map hides package.json, so locate the barrel from node_modules directly.
  const barrel = path.join(__dirname, '..', 'node_modules', PKG, 'dist/esm/lucide-react-native.mjs');
  const source = fs.readFileSync(barrel, 'utf8');
  iconFiles = new Map();
  const exportRe = /export \{([^}]+)\} from '\.\/icons\/([\w-]+)\.mjs'/g;
  let match;
  while ((match = exportRe.exec(source))) {
    for (const spec of match[1].split(',')) {
      const name = spec.trim().replace(/^default as /, '');
      iconFiles.set(name, match[2]);
    }
  }
  return iconFiles;
}

module.exports = function lucideDeepImports({ types: t }) {
  return {
    name: 'lucide-deep-imports',
    visitor: {
      ImportDeclaration(nodePath) {
        if (nodePath.node.source.value !== PKG) return;
        const specifiers = nodePath.node.specifiers;
        const files = loadIconFiles();
        // Anything other than plain named icon imports (default/namespace imports, helpers like
        // createLucideIcon) is left on the barrel import.
        const icons = specifiers.filter(
          s => t.isImportSpecifier(s) && files.has(s.imported.name || s.imported.value),
        );
        if (!icons.length) return;
        const rest = specifiers.filter(s => !icons.includes(s));
        const deep = icons.map(s =>
          t.importDeclaration(
            [t.importDefaultSpecifier(t.identifier(s.local.name))],
            t.stringLiteral(`${PKG}/icons/${files.get(s.imported.name || s.imported.value)}`),
          ),
        );
        if (rest.length) {
          nodePath.node.specifiers = rest;
          nodePath.insertAfter(deep);
        } else {
          nodePath.replaceWithMultiple(deep);
        }
      },
    },
  };
};
