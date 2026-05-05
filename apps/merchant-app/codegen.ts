import type { CodegenConfig } from "@graphql-codegen/cli";
import dotenv from "dotenv";
dotenv.config();

const config: CodegenConfig = {
  schema: process.env.PUBLIC_API_URL,
  documents: ["src/**/*.{ts,tsx}", "!src/shared/graphql/**/*"],
  ignoreNoDocuments: true,
  generates: {
    "./src/shared/graphql/": {
      preset: "client",
      presetConfig: {
        fragmentMasking: false,
      },
      plugins: [],
      config: {
        defaultScalarType: "unknown",
        nonOptionalTypename: true,
        skipTypeNameForRoot: true,
        useTypeImports: true,
        namingConvention: {
          enumValues: "keep",
        },
      },
    },
    "./schema.graphql": {
      plugins: ["schema-ast"],
      config: {
        includeDirectives: true,
      },
    },
  },
};

export default config;
