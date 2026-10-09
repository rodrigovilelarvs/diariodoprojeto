import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Regra nova do React Compiler: marca setState dentro de useEffect. Os usos do projeto
      // são intencionais (hidratar estado a partir de localStorage/dados da query), então
      // fica como aviso até ser refatorado caso a caso.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Ferramentas auxiliares (geração das capturas do manual)
    "scripts/**",
  ]),
]);

export default eslintConfig;
