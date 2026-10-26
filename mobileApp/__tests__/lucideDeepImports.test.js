const { transformSync } = require('@babel/core');
const plugin = require('../babel/lucide-deep-imports');

const transform = (code) =>
  transformSync(code, { babelrc: false, configFile: false, plugins: [plugin] }).code;

describe('lucide deep-import babel plugin', () => {
  it('imports each icon from its own file, including aliases and renames', () => {
    const out = transform("import { Mail, CheckCircle2, Image as ImageIcon } from 'lucide-react-native';");
    expect(out).toContain('import Mail from "lucide-react-native/icons/mail"');
    expect(out).toContain('import CheckCircle2 from "lucide-react-native/icons/circle-check"');
    expect(out).toContain('import ImageIcon from "lucide-react-native/icons/image"');
    expect(out).not.toContain("'lucide-react-native'");
  });

  it('leaves non-icon imports on the package entry', () => {
    const out = transform("import { X, createLucideIcon } from 'lucide-react-native';");
    expect(out).toContain("import { createLucideIcon } from 'lucide-react-native'");
    expect(out).toContain('import X from "lucide-react-native/icons/x"');
  });
});
