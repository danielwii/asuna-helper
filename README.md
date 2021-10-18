# asuna-helper

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
