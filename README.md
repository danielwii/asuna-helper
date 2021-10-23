# asuna-helper

---
```json5
// package.json
"exports": {
  ".": {
    "import": "./dist/index.mjs",
    "require": "./dist/index.js"
  },
  "./*": {
    "import": "./dist/*.mjs",
    "require": "./dist/*.js"
  }
},
"typesVersions": {
  "*": {
    "*": [
      "dist/*.d.ts"
    ]
  }
},
```

---

```json5
{
  exports: {
    '.': {
      import: './dist/index.mjs',
      require: './dist/index.js',
    },
    './*': {
      import: './dist/*.mjs',
      require: './dist/*.js',
    },
  },
}
```
